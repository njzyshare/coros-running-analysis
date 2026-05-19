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
    path.join(os.homedir(), '.workbuddy/.tmp/coros-mcp-local/node_modules/coros-mcp/dist/cli.js'),
    // 工作区安装
    path.join(process.cwd(), '.tmp/coros-mcp-local/node_modules/coros-mcp/dist/cli.js'),
    // 向上查找
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return { cli: p, baseDir: path.dirname(path.dirname(path.dirname(p))) };
  }

  // 向上遍历查找
  let dir = os.homedir();
  for (let i = 0; i < 4; i++) {
    const tryPath = path.join(dir, '.workbuddy/.tmp/coros-mcp-local/node_modules/coros-mcp/dist/cli.js');
    if (fs.existsSync(tryPath)) return { cli: tryPath, baseDir: path.dirname(path.dirname(path.dirname(tryPath))) };
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

coros-mcp 需要 COROS 账号认证。首次使用时会引导登录：

```javascript
// 初始化认证
call('authenticate', { /* 如需要 token */ })
```

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
| `getActivityDetail` | 单次运动详情（含分段） | labelId, sportType |
| `analyzeActivityDetail` | 教练式分析 | labelId, sportType, focus |
| `querySleepData` | 睡眠数据 | startDate, endDate, days, timezone |
| `queryRecoveryStatus` | 恢复状态 | — |
| `queryTrainingLoadAssessment` | 训练负荷 | days |
| `queryFitnessAssessmentOverview` | 高驰预估 | — |
| `queryDailyHealthData` | 健康汇总 | days, timezone |
| `queryHrvAssessment` | HRV 评估 | days, timezone |

### 2.3 常用调用示例

```javascript
// 近30天户外跑记录
call('querySportRecords', {
  startDate: '20260501', endDate: '20260519',
  sportTypeCodes: [100],
  limit: 100,
  timezone: 'Asia/Shanghai'
})

// 单次运动分段数据（分析必用）
call('getActivityDetail', {
  labelId: '477563623938490572',
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
call('querySleepData', {
  startDate: '20260518', endDate: '20260519',
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
| 5/19 的记录 | **5/18 晚** 的睡眠 |
| 5/N 的记录 | **5/(N-1) 晚** 的睡眠 |

**正确查询**：查"5/18 晚"睡眠 → endDate 设为 `20260519`（+1 天）

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

### 4.2 关键参数提取

从 `queryFitnessAssessmentOverview` 提取：

| 字段 | 含义 | 用途 |
|------|------|------|
| vo2max | 最大摄氧量 | 体能级别 |
| predictedFullMarathon | 高驰预估全马 | **默认目标** |
| predictedHalfMarathon | 高驰预估半马 | **默认目标** |
| thresholdPace | 阈值配速（MP） | 主课段参考 |
| thresholdHeartRate | 阈值心率 | 强度参考 |
| anaerobicThresholdHeartRate | 乳酸阈心率 | 间歇/MP 上限 |

### 4.3 配速区间识别

通过分段数据分析，归纳用户实际配速-心率对应关系：

| 类型 | 心率 | 配速来源 |
|------|------|---------|
| **轻松跑（E）** | ≤ LT心率×0.78 | 分段中 HR 最低且稳定持续3km+ |
| **MP** | 阈值心率 ±5 | thresholdPace |
| **乳酸阈值（T）** | LT心率 ±3 | fitness 数据 |
| **间歇（I）** | LT心率+5~15 | 分段中 HR 最高段 |

### 4.4 历史周跑量统计

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

### 5.1 结构概览

```
## 用户基础信息（置顶）

一、当日训练 + 睡眠分析
二、当周整体评估
三、当月整体评估
四、优化建议
五、课表建议
```

### 5.2 用户基础信息表

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

### 5.3 分段拆解格式

**分析 MP 跑/间歇/长距离时必须展示分段数据：**

```
第1段  0-1km   配速 5:32  HR 128  [热身段]
第2段  1-2km   配速 5:18  HR 145
...
第8段  7-8km   配速 4:38  HR 162  [主课段]
...
第13段 12-13km 配速 4:42  HR 160  [主课段]
第14段 13-13.14km 配速 4:55  HR 155  [冷身段]

主课有效段：
  均值配速 4:40/km | 均值 HR 161
  配速稳定性：前5km 4:41 → 后5km 4:39（略微负分段 ✅）
```

### 5.4 四维度评分

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
