# 🏃 高驰运动数据分析 Skill

用于分析 COROS 高驰手表用户训练数据的 AI Skill（WorkBuddy / Codex）。

---

## 📦 v2.0 重大升级（2026-06-08）

v2.0 引入了 **网页端数据细化** 能力，从根本上解决了 MCP 接口的精度局限：

| 升级 | 之前（v1.x） | 现在（v2.0） |
|------|------------|------------|
| 训练时间 | 仅日期，无法区分晨跑/夜跑 | ✅ 精确到分钟，自带早晚标记 |
| 天气数据 | Open-Meteo API 全天均值 | ✅ **手表实测时段天气**（优先）|
| 间歇计圈 | MCP"最快1公里"口径错误 | ✅ **网页端完整计圈表**（APP 口径）|
| 用户数据 | 混在 skill 目录 | ✅ 全部独立到 `.secrets/`，便于共享 |

---

## ✨ 核心能力一览

### 🟢 基础分析

- **运动记录分析** — 均配速、心率、步频、最快单圈等
- **天气数据关联** — 自动采集温湿度，DI 不适指数量化
- **训练负荷评估** — ST/LT Load 分析
- **睡眠恢复追踪** — 睡眠质量、HRV、恢复状态
- **高驰预估** — VO2max、阈值配速/心率、全马/半马
- **配速区间识别** — E/M/T/I/A 区配速与心率对应
- **自然周跑量统计** — 按周汇总，历史 8-12 周分析
- **报告导出** — 保存为 HTML，跨会话持久化

### 🟡 网页端数据细化（v2.0 新增）

需要授权的增强能力（一次授权，永久使用）：

- 🕐 **精确开始时间** — "晚上 08:21" vs "未知"，判断晨跑/夜跑/一天多次
- 🌤️ **时段实测天气** — 手表传感器数据，含温度/湿度/风/天气现象
- 📊 **完整计圈表** — 每圈配速、心率、达标率，"最快"标记行
- 🌧️ **精确 DI 计算** — 用实测温湿度，不用全天均值

> 💡 登录态存于工作区 `.secrets/coros-state/`，**与 skill 目录分离**，共享 skill 不会泄露个人数据。

### 🔵 训练指导

- 6 种主流训练方法论（丹尼尔斯 VDOT / MAF 180 / 汉森 / 亚索 800 / 普菲辛格 / 80/20 法则）
- 个性化的训练建议和课表设计

---

## 📂 文件结构

```
高驰运动数据分析.skill/
├── SKILL.md                      ⭐ 核心工作流 + 场景索引（**先读这个**）
├── references/
│   ├── analysis-workflow.md       首次分析流程、配速区间、周统计
│   ├── coros-tool-calling.md      MCP 配置、路径发现、CLI 调用
│   ├── report-template.md         报告模板、用户信息表、输出约定
│   ├── training-metrics.md        运动代码、心率 Zone、周跑量规则
│   ├── weather-analysis.md        天气采集、DI 公式、配速影响量化
│   ├── running-training-methodology.md  6 种训练方法论
│   ├── time-weather-refinement.md       🆕 网页端时间/天气细化工作流
│   └── web-detail-fetcher.md           🆕 headless 计圈抓取器文档
```

### 用户数据（独立存放，共享 safe）

```
{workspace}/高驰数据分析/
├── .secrets/
│   ├── _user_running_profile.md    个人档案
│   ├── coros-mcp-token-backup.json MCP token 备份
│   └── coros-state/
│       └── coros_state.json        Playwright 登录态
├── coros_web_login.js              登录脚本（仅首次弹窗）
└── coros_detail.js                 网页端抓取器（始终 headless）
```

---

## 🔧 环境准备

### 依赖

- COROS 高驰手表 + MCP 数据接口
- (可选) Playwright + Chromium（网页端细化需要，约 180MB）

### 首次使用

1. 复制 skill 到 `~/.workbuddy/skills/`
2. 在工作区 `高驰数据分析/` 下创建 `.secrets/` 目录
3. 可选：运行 `node coros_web_login.js` 授权网页端（一次，会弹窗）
4. 可选：创建 `.secrets/_user_running_profile.md` 个性化档案

---

## 💡 天气数据优先级

```
网页端已授权 → fetchActivityDetail().weather（精确到训练时段）
                └── 无授权 → Open-Meteo Archive API（全天均值兜底）
```

> 网页端温湿度来自手表实际传感器数据，**优先于**第三方 API。

---

## 📐 关键数据规则

- 运动记录无时分秒，同日多次需通过网页端细化确认时段
- 睡眠 `querySleepData` 返回日期 = **醒来当天**，非入睡当天
- 不完整周不下结论

---

*基于 COROS MCP 数据接口 + Playwright 网页端增强*
