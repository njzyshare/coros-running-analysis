---
name: 高驰运动数据分析
description: 当用户提到训练分析、跑步数据、运动表现、训练计划评估、跑量统计、睡眠恢复分析，或想查询 COROS 高驰手表的运动记录、训练负荷、恢复状态、睡眠质量、HRV 等数据时使用。提供从 MCP 配置到分析输出的完整能力。
agent_created: true
---

# 高驰运动数据分析

用于分析 COROS 高驰手表用户的训练数据、运动表现和恢复状态。

---

## 一、MCP 服务器配置

### 1.1 coros-mcp 安装

```bash
# 全局安装 coros-mcp CLI
npm install -g coros-mcp

# 或本地安装到工作区
mkdir -p ~/.workbuddy/.tmp
cd ~/.workbuddy/.tmp
npm install coros-mcp
```

### 1.2 mcp.json 配置

> ⚠️ **cache-root 一致性**：CLI 默认缓存路径为 `~/.coros-mcp-skill-gateway-ts`。如果指定了 `--cache-root`，则登录和后续所有调用都需要使用同一个路径，否则会找不到 token。

在 AI 工具的配置文件中添加 MCP 服务器。以下是不同工具的配置格式：

#### WorkBuddy (codebuddy) 格式
```json
{
  "mcpServers": {
    "coros": {
      "command": "node",
      "args": [
        "PATH_TO_COROS_MCP/cli.js",
        "--cache-root",
        "PATH_TO_CACHE"
      ],
      "env": {}
    }
  }
}
```

#### Claude Desktop / 其他 MCP 客户端格式
```json
{
  "mcpServers": {
    "coros": {
      "command": "node",
      "args": [
        "PATH_TO_COROS_MCP/dist/cli.js"
      ]
    }
  }
}
```

### 1.3 路径发现（动态）

不要硬编码固定路径。使用以下策略自动发现：

```javascript
const path = require('path');
const os = require('os');
const fs = require('fs');

function findCorosMcp() {
  // 候选路径列表（按优先级）
  const candidates = [
    // npm 全局安装
    path.join(os.homedir(), 'node_modules/coros-mcp/dist/cli.js'),
    path.join(os.homedir(), '.workbuddy/.tmp/coros-mcp-local/node_modules/coros-mcp/dist/cli.js'),
    path.join(os.homedir(), '.workbuddy/.tmp/node_modules/coros-mcp/dist/cli.js'),
    // 工作区安装
    path.join(process.cwd(), '.tmp/coros-mcp-local/node_modules/coros-mcp/dist/cli.js'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return { cli: p, baseDir: path.dirname(path.dirname(path.dirname(p))) };
  }

  // 向上遍历查找
  let dir = os.homedir();
  for (let i = 0; i < 4; i++) {
    for (const sub of ['.workbuddy/.tmp/coros-mcp-local', '.workbuddy/.tmp']) {
      const tryPath = path.join(dir, sub, 'node_modules/coros-mcp/dist/cli.js');
      if (fs.existsSync(tryPath)) return { cli: tryPath, baseDir: path.join(dir, sub) };
    }
    dir = path.dirname(dir);
  }

  return null; // 未找到
}

const found = findCorosMcp();
if (found) {
  console.log('CLI:', found.cli);
  console.log('Cache:', path.join(found.baseDir, 'corOs-cache'));
}
```

### 1.4 认证配置

coros-mcp 需要 COROS 账号认证。每次重装或切换缓存路径后需要重新登录：

```bash
# 第一步：启动登录，获取浏览器 URL
node CLI_PATH login

# 第二步：用户浏览器打开 URL 完成认证

# 第三步：确认登录状态
node CLI_PATH login-status
# → "no token" 则尚未完成

# 第四步：完成登录
node CLI_PATH login-finish
# → "login ok" 即成功
```

也可以使用 `login-start` / `login-finish` 分步完成。

---

## 二、工具调用

### 2.1 调用方式

**优先使用 MCP 服务器**（`mcp__coros__*` 工具）。若 MCP 未配置，使用 CLI 兜底：

```javascript
// CLI 兜底
const { spawnSync } = require('child_process');

function call(tool, args) {
  const found = findCorosMcp();
  if (!found) return { error: 'coros-mcp not found' };

  const r = spawnSync('node', [
    found.cli,
    '--cache-root', path.join(found.baseDir, 'corOs-cache'),
    'call-tool',
    '--tool', tool,
    '--arguments-json', JSON.stringify(args)
  ], { encoding: 'utf8', timeout: 30000 });

  try { return JSON.parse(r.stdout); }
  catch (e) { return { raw: r.stdout, error: r.stderr }; }
}
```

### 2.2 工具速查表

| 工具 | 用途 | 必填参数 |
|------|------|---------|
| `querySportRecords` | 运动记录列表 | startDate, endDate, sportTypeCodes, limit, timezone |
| `getActivityDetail` | 单次运动汇总（含最佳1km配速） | labelId, sportType |
| `analyzeActivityDetail` | 教练式文字诊断（无分段） | labelId, sportType, focus |
| `querySleepData` | 睡眠数据 | startDate, endDate, days, timezone |
| `queryRecoveryStatus` | 恢复状态 | — |
| `queryTrainingLoadAssessment` | 训练负荷 | days |
| `queryFitnessAssessmentOverview` | 高驰预估 | — |
| `queryDailyHealthData` | 健康汇总 | days, timezone |
| `queryHrvAssessment` | HRV 评估 | days, timezone |

### 2.3 常用调用示例

```javascript
// 近30天户外跑记录（日期按实际查询范围替换）
call('querySportRecords', {
  startDate: 'YYYYMMDD', endDate: 'YYYYMMDD',
  sportTypeCodes: [100],
  limit: 100,
  timezone: 'Asia/Shanghai'
})

// 单次运动汇总数据（含最佳1km配速，分析必用）
call('getActivityDetail', {
  labelId: '{LABEL_ID}',
  sportType: 100
})

// 高驰预估（首次分析必用）
call('queryFitnessAssessmentOverview', {})

// 近7天健康数据
call('queryDailyHealthData', {
  days: 7,
  timezone: 'Asia/Shanghai'
})

// 30天训练负荷
call('queryTrainingLoadAssessment', { days: 30 })

// 当前恢复状态
call('queryRecoveryStatus', {})

// 近7天HRV
call('queryHrvAssessment', { days: 7, timezone: 'Asia/Shanghai' })

// 睡眠数据（注意日期错位规则，见 3.3）
// 查"N晚"睡眠 → endDate 设为 N+1
call('querySleepData', {
  startDate: 'YYYYMMDD', endDate: 'YYYYMMDD',
  days: 2,
  timezone: 'Asia/Shanghai'
})
```

---

## 三、排查规则

### 3.1 ⚠️ 运动记录无时间戳

**问题**：`querySportRecords` 的日期字段只有 `yyyy-MM-dd`，**不含时分秒**。记录顺序不保证是时间顺序。

**正确做法**：
- 永远不以记录顺序推断上午/下午
- 同一天多次运动，必须询问用户时段分配
- 以用户告知为准

### 3.2 ⚠️ 睡眠日期错位

**问题**：`querySleepData` 返回的日期字段 = **醒来当天**，不是入睡当天。

**换算表**：

| API 返回日期 | 实际入睡日期 |
|------------|------------|
| M/D 的记录 | **(M/(D-1)) 晚** 的睡眠 |
| N 日的记录 | **(N-1) 日** 的睡眠 |

**正确查询**：查"N晚"睡眠 → endDate 设为 N+1（如查 5/18 晚 → endDate = YYYYMMDD 格式的 5/19）

### 3.3 通用排查

1. 数据疑似不对 → 先确认工具 inputSchema，核对参数名
2. 用 `queryDailyHealthData` 交叉比对（该接口最稳定）
3. 多次请求返回内容完全相同 → 参数名写错

---

## 四、分析流程

### 4.1 首次分析流程（用户基础信息收集）

**首次分析时**，必须先并行拉取以下数据，再生成报告：

```javascript
// 第一步：并行拉取核心数据
fitness   = call('queryFitnessAssessmentOverview', {})
health    = call('queryDailyHealthData', { days: 7, timezone: 'Asia/Shanghai' })
records   = call('querySportRecords', { startDate: 'YYYYMMDD', endDate: 'YYYYMMDD', sportTypeCodes: [100], limit: 100, timezone: 'Asia/Shanghai' })
recovery  = call('queryRecoveryStatus', {})
load      = call('queryTrainingLoadAssessment', { days: 30 })
hrv       = call('queryHrvAssessment', { days: 7, timezone: 'Asia/Shanghai' })
```

从 `queryFitnessAssessmentOverview` 提取：

| 字段 | 含义 | 用途 |
|------|------|------|
| vo2max | 最大摄氧量 | 体能级别 |
| predictedFullMarathon | 高驰预估全马 | **默认目标** |
| predictedHalfMarathon | 高驰预估半马 | **默认目标** |
| thresholdPace | 阈值配速（MP） | 主课段参考 |
| thresholdHeartRate | 阈值心率 | 强度参考 |
| anaerobicThresholdHeartRate | 乳酸阈心率 | 间歇/MP 上限 |

### 4.2 天气数据采集流程

**每次分析关键训练（MP跑/长距离/间歇）时，必须采集训练当天的天气数据。**

COROS MCP 工具不提供天气数据，但可通过以下流程获取：

1. **从 `querySportRecords` 提取坐标**：每条活动记录包含 `Start Coordinates: 纬度, 经度`（示例: 纬度, 经度）
2. **用坐标查询开源天气 API**（推荐 Open-Meteo Archive API，免费、无需API Key）：
   ```
   https://archive-api.open-meteo.com/v1/archive?
     latitude={lat}&longitude={lon}&
     start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}&
     hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code&
     timezone=Asia/Shanghai
   ```
3. **WMO 天气代码→中文映射**：
   ```python
   wmo = {0:"晴",1:"晴间多云",2:"多云",3:"阴",
          45:"雾",51:"小毛毛雨",53:"中毛毛雨",61:"小雨",
          63:"中雨",80:"阵雨",81:"中阵雨",95:"雷暴"}
   ```
4. **训练时段取数**：按训练时长估算时段（如 30K≈5-9am，20K≈5-8am，10K≈5-7am）
5. **若无坐标可用**：询问用户训练大致位置，用城市名拼坐标查询

**分析原则**：
- **疲劳 > 天气 > 训练意图**：温湿度影响表现是合理推断，但同温湿度的两场训练表现可能截然不同（主因通常是累积疲劳而非天气变化）。关键课（MP/长距离）前的1-3天跑量和休息日安排是更重要的变量。
- 同时考虑累积疲劳、训练意图、睡眠因素进行综合解读
- 不将单次表现差异全部归因于天气——优先核查：①前3天跑量 ②睡眠质量 ③训练意图

### 4.3 温湿度与不适指数（DI）量化分析

> 本节提供温湿度量化分析框架，基于夏季晨间训练数据推导。其他气候区域需根据本地条件重新校准阈值。

#### 不适指数（Discomfort Index）公式

```
DI = T - 0.55 × (1 - 0.01 × H) × (T - 14.5)
其中 T = 温度(°C), H = 相对湿度(%)
```

DI 越低越舒适，>=21 时即使短距离也会明显感知。

#### DI 参考阈值（基于实际训练数据）

| DI 范围 | 影响级别 | 典型表现 |
|---------|---------|---------|
| **< 17** | ✅ 最佳区 | 15-17°C + 60-80%RH → 正常发挥，可冲刺Best |
| **17 - 19** | ⚠️ 轻度影响 | 配速惩罚约+5~10s/km |
| **> 19** | 🔴 明显影响 | 配速惩罚可感知，但训练意图可部分抵消（如MP跑时意志可覆盖天气劣势） |

#### 温度量化影响（粗估公式）

```
基准温度: 17°C（晨间低温基准线）
  ≤18°C: 基准表现区
  20°C:  配速惩罚 +5s/km vs 17°C
  22°C:  配速惩罚 +10s/km vs 17°C（训练意图强时可忽略此惩罚）
```

#### 湿度量化影响（粗估公式）

```
同温下每+10%RH ≈ +3-5s/km 配速惩罚（中度可信，6-10场数据推导）
湿度 60-70% ≈ 最舒适，80-95% ≈ 可感知但非致命
```

#### 关键分析原则：疲劳 > 天气

典型例子（两场同温湿度 30K 对比）：
- 训练 A（前1天休息）→ 均配速较佳，完成质量高
- 训练 B（前3天连续跑~30km累积疲劳）→ 均配速断崖下降

**结论**：纯温湿度解释力 < 10%，疲劳累积解释力 > 80%。**查天气前，先查前3天跑量。**

#### 数据获取流程

参见 4.2 天气数据采集流程。在分析报告中按以下方式呈现：

```
## 温湿度影响量化
- 本次训练 DI = XX.X（温度 XX°C / 湿度 XX%）
- vs 基准 DI 16.5 → 预估配速影响 ±X s/km
- 建议下次类似条件时：注意前X天跑量控制
```

### 4.4 配速区间识别

> ⚠️ 由于 `getActivityDetail` 不返回逐km分段，配速区间主要从运动记录的汇总均配速、均HR 和 fitness 阈值参数推断。若用户提供分段截图，可按实际数据精细识别。

通过分段数据分析，归纳用户实际配速-心率对应关系：

| 类型 | 心率 | 配速来源 |
|------|------|---------|
| **轻松跑（E）** | ≤ LT心率×0.78 | 汇总均速中偏低且HR稳定（如有截图参考则按实际） |
| **MP** | 阈值心率 ±5 | thresholdPace |
| **乳酸阈值（T）** | LT心率 ±3 | fitness 数据 |
| **间歇（I）** | LT心率+5~15 | 运动中最高均HR段（汇总口径参考） |

### 4.5 历史周跑量统计

```javascript
// 查询近8-12周数据
weeks = 12
records = call('querySportRecords', { startDate: START, endDate: END, sportTypeCodes: [100], limit: 200, timezone: 'Asia/Shanghai' })

// 按自然周（周一→周日）汇总
// 仅统计 SportType: [100, 101, 102, 103]
```

输出：

| 周次 | 跑量(km) | 训练天数 | 备注 |
|------|---------|--------|------|
| W-1 | 72.3 | 5 | 完整周 |
| W-2 | 68.5 | 4 | 缺1天 |
| ... | ... | ... | ... |
| **均值** | XX.X | X.X | — |
| **峰值** | XX.X | — | W-N |

---

## 五、分析报告模板

### 5.1 输出行为约定

> **默认：对话框直接输出 Markdown 格式报告，不写本地文件。**
>
> 报告末尾询问用户：「需要保存为本地 HTML 文件吗？」若用户确认，再生成并交付 HTML 文件。

### 5.2 结构概览（完整版）

```
## 用户基础信息（置顶）
【含近30天天气变化概述，见 5.3】

一、当日训练 + 睡眠分析（含温湿度影响）
  - 当日天气：温度 XX°C / 湿度 XX% / DI=X.X
  - 温湿度量化：DI 区间 → 预估配速影响 ±X s/km
  - 结合前3天跑量、睡眠质量综合解读

二、当周整体评估（含各次训练温湿度分布）
  - 当周训练日程及对应 DI 一览
  - 同周内不同天气条件下的表现差异对比
  - 周跑量 + 周均 DI 对整体疲劳的叠加影响

三、当月整体评估（含月度天气变化轨迹）
  - 近30天温度/湿度/DI 变化曲线概述
  - 不同 DI 区间内的训练次数分布
  - 高温高湿日 vs 低温舒适日的配速偏差量化

四、优化建议
五、课表建议
```

### 5.2b 结构概览（月度回顾版）

```
## 用户基础信息（置顶）

一、月度训练流水 + 天气数据
二、温度分层统计（<18°C / 18-20°C / >20°C）
三、关键对比分析（同温异湿、同距离不同表现）
四、不适指数（DI）vs 配速偏差表
五、量化推导结论
六、周跑量推演
七、优化建议
```

### 5.3 用户基础信息表

```
## 用户基础信息

| 类别 | 参数 | 当前值 | 说明 |
|------|------|--------|------|
| 体能 | VO2max | XX ml/kg/min | — |
| 阈值 | 阈值配速（MP） | X:XX/km | 对应阈值心率 |
| 阈值 | 乳酸阈心率 | XXX bpm | ≈ 最大心率×0.89 |
| 阈值 | 阈值心率 | XXX bpm | 高驰参考值 |
| 预估 | 高驰预估全马 | X:XX:XX | **默认目标** |
| 预估 | 高驰预估半马 | X:XX:XX | **默认目标** |
| 健康 | 安静心率 | XX bpm | 近7天均值 |
| 健康 | HRV 均值 | XX ms | 近7天均值 |
| 健康 | 恢复状态 | X/X | 训练压力 vs 恢复平衡 |
| 训练 | 近7天跑量 | XX km | — |
| 训练 | 近30天跑量 | XXX km | — |
| 训练 | 历史周均跑量 | XX.X km | 近8–12周均值 |
| 训练 | 历史周跑量峰值 | XX.X km | — |
| 训练 | ShortTerm Load | XX | 近7天 |
| 训练 | LongTerm Load | XX | 近28天 |
| 训练 | 训练负荷比 | X.XX | ST/LT，建议 1.0–1.3 |
| 环境 | 近30天天气变化概述 | 温度 XX~XX°C / RH XX~XX% / DI XX~XX | 见 4.2～4.3 采集与量化方法 |
| 环境 | DI 分布 | 最佳DI日: X天 / 轻度影响日: X天 / 明显影响日: X天 | DI<17 / 17-19 / >19 |
| 环境 | 预估天气对配速综合影响 | ±X s/km（月均） | 高温高湿日累计惩罚 |
| 配速 | E跑 配速 | X:XX/km | HR ≤ LT×0.78 |
| 配速 | MP 配速 | X:XX/km | 阈值配速 |
| 配速 | T跑 配速 | X:XX/km | 乳酸阈值配速 |
| 配速 | 间歇配速 | X:XX/km | I/A 区配速 |
| 配速 | E跑 心率上限 | ≤ XXX bpm | — |
| 配速 | MP 心率参考 | XXX bpm | 阈值心率 ±5 |
| 配速 | T跑 心率参考 | XXX bpm | LT心率 ±3 |
| 配速 | 间歇心率参考 | XXX bpm | LT心率+5~15 |

> **默认目标说明**：本报告以高驰预估全马（X:XX:XX）/ 半马（X:XX:XX）为默认目标进行评估。
```

### 5.4 单次训练分析格式

> ⚠️ **重要限制**：`getActivityDetail` **不返回逐公里分段数据**，仅返回汇总口径（均配速、最佳1km配速、均/最高心率、均步频、训练负荷等）。`analyzeActivityDetail` 同样只做文字诊断，无分段。以下格式基于实际可获取的数据。

**每次训练展示可用汇总数据：**

```
🏃 Outdoor Run — YYYY-MM-DD 训练类型（XX.XXkm / XX:XX）
========================================
均配速: X:XX/km | 调整后: X:XX/km | 最佳1km: X:XX/km
均心率: XXX bpm | 最高心率: XXX bpm
均步频: XXX spm | 均步幅: X.XX m
海拔升降: +Xm / -Xm | 热量: XXX kcal
训练负荷: XXX | 表现评价: Best/Normal/Hard

▶ 均配速解读：
  - 均配速 X:XX/km vs 高驰阈值 X:XX/km → 差 XX秒/km
  - 最佳1km X:XX/km 是当天最快单公里，可视为该配速下的能力上限
  - HR XXX bpm 对应的心率区间分析
  - 步频/步幅特征分析

▶ 温湿度影响量化（见 4.2~4.3）：
  - 训练日天气：温度 XX°C / 湿度 XX% / DI=X.X（见 DI 阈值表）
  - 本次 DI vs 基准 DI 16.5 → 预估配速影响 ±X s/km
  - 若 DI>19 且配速达标 → 训练意图覆盖了天气劣势，说明能力强
  - 若 DI 正常但配速明显下降 → 优先查前3天跑量和睡眠（疲劳因素）
```

### 5.5 最佳1km配速（Best Kilometer）

`getActivityDetail` 返回的 **Best Kilometer** 是整次训练中最快的那 1 公里配速，作为均值配速的补充：

| 指标 | 说明 | 分析价值 |
|------|------|---------|
| 均配速 | 整体均值，受慢段拖累 | 反映"综合完成能力" |
| 最佳1km | 最快单公里 | 反映"在当前体感下的极限片段"，可对比阈值配速差距 |

**分析意义**：最佳1km配速往往比均配速快 10–30 秒/km，两者差距越小说明配速越均匀。若最佳1km接近阈值配速，说明能力足够，只是均速受限于后程降速。

### 5.6 四维度评分

| 维度 | 门槛（默认目标） | 评分 |
|------|---------------|------|
| 跑量 | ≥ 70km/周 | ★★★★★ 达标 ★★★☆☆ 接近 ★★☆☆☆ 差距大 |
| 长距离 | 20-30km，节奏稳定 | ★★★★☆ 稳定 ★★☆☆☆ 缺乏或不稳 |
| MP节奏 | 阈值配速（主课段） | ★★★★☆ 接近 ★★★☆☆ 差5-10秒 ★★☆☆☆ 差>10秒 |
| 间歇 | 每1-2周1次 | ★★★★☆ 规律 ★★★☆☆ 有但不固定 ★★☆☆☆ 缺乏 |

---

## 六、运动类型代码

| 代码 | 类型 | 计入跑量 |
|------|------|---------|
| 100 | Outdoor Run（户外跑）| ✅ |
| 101 | Indoor Run（室内跑）| ✅ |
| 102 | Trail Run（越野跑）| ✅ |
| 103 | Track Run（操场跑）| ✅ |
| 104 | Hike（徒步）| ❌ |
| 900 | Walk（健走）| ❌ |
| 400 | Gym Cardio | ❌ |
| 402 | Strength | ❌ |

---

## 七、自然周跑量规则

**核心原则：不完整周不下结论，等周末数据补齐后再判断。**

| 场景 | 处理方式 |
|------|---------|
| 周三查本周，30km | "周三仅3天，历史规律是周末补长距离（15-21km），预计全周可达60-70km，**暂时无法判断是否达标**" |
| 周日查本周，68km | "周日最终68km，距目标差2km，**未达标**" |

---

## 八、心率 Zone 参考

当高驰数据不足时，用经验公式补充：

| Zone | 最大心率% | 类型 | 配速特征 |
|------|---------|------|---------|
| Zone 1（E）| 60–70% | 轻松跑/恢复 | 最慢，配速稳定 |
| Zone 2（M）| 70–80% | 马配跑/MP | 阈值配速附近 |
| Zone 3（T）| 80–88% | 乳酸阈值 | 可持续 20–60min |
| Zone 4（I）| 88–95% | 间歇 | 可持续 2–8min |
| Zone 5（A）| 95–100% | 无氧/冲刺 | 可持续 <2min |

**最大心率估算**：`220 - 年龄` 或取历史最高值

---

## 九、适用场景

- "分析最近一个月训练"
- "看看某月的跑步数据"
- "评估这周的训练计划"
- "某天的训练和睡眠表现"
- "下周训练怎么安排"
- "我的马配和乳酸阈值是多少"
- "预估一下我的全马/半马成绩"
- "配置 coros-mcp MCP"
