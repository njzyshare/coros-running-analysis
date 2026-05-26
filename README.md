# 高驰运动数据分析

用于分析 COROS 高驰手表用户训练数据的 AI Skill（WorkBuddy / Codex）。

## 能力

- 🏃 **运动记录分析** — 汇总数据（均配速、最佳1km、心率、步频等）
- 🌤️ **天气数据关联** — 自动采集温湿度，结合 DI 不适指数量化分析
- 📊 **训练负荷评估** — ST/LT Load 分析
- 😴 **睡眠恢复追踪** — 睡眠质量、HRV、恢复状态
- 🎯 **高驰预估** — VO2max、阈值配速/心率、全马/半马
- 📈 **配速区间识别** — E/M/T/I/A 区配速与心率对应
- 📅 **自然周跑量统计** — 按周汇总，历史 8-12 周分析
- 💾 **报告导出** — 保存为 HTML，跨会话持久化
- 🔐 **自动授权** — 无 token 时引导 COROS 账号授权

## 模块化文档结构

| 文件 | 内容 |
|------|------|
| [SKILL.md](SKILL.md) | ⭐ 核心工作流 + 参考索引（**先读这个**） |
| [references/coros-tool-calling.md](references/coros-tool-calling.md) | MCP 配置、路径发现、认证、CLI 调用 |
| [references/weather-analysis.md](references/weather-analysis.md) | 天气采集、DI 公式、配速影响量化 |
| [references/analysis-workflow.md](references/analysis-workflow.md) | 首次分析流程、配速区间、周统计 |
| [references/report-template.md](references/report-template.md) | 报告模板、用户信息表、输出约定 |
| [references/training-metrics.md](references/training-metrics.md) | 运动代码、心率 Zone、周跑量规则 |
| [references/running-training-methodology.md](references/running-training-methodology.md) | 丹尼尔斯/MAF/汉森/亚索800等方法论 |
| [references/node-wrapper-example.md](references/node-wrapper-example.md) | CLI 包装调用示例 |

## 天气分析

- 通过 Open-Meteo 免费 API 获取天气
- 不适指数：`DI = T - 0.55 × (1 - 0.01 × H) × (T - 14.5)`
- 阈值：< 17 最佳 / 17-19 轻度 / > 19 明显
- **核心原则：疲劳 > 天气**

## 数据规则

- 运动记录无时分秒，同日多次需确认时段
- 睡眠日期为醒来当天，非入睡当天
- 不完整周不下结论

## 用户个人档案

将个人数据放在工作区的 `高驰数据分析/_user_running_profile.md`，实现技能共享。

---

*基于 COROS MCP 数据接口*
