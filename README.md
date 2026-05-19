# 高驰运动数据分析

用于分析 COROS 高驰手表用户的训练数据、运动表现和恢复状态的 AI Skill。

## 功能特性

- 🏃 **运动记录分析** - 户外跑、室内跑、越野跑、操场跑等各类跑步数据
- 📊 **训练负荷评估** - ShortTerm/LongTerm Load 分析，训练压力评估
- 😴 **睡眠恢复追踪** - 睡眠质量、HRV、恢复状态监控
- 🎯 **高驰预估** - VO2max、预估全马/半马成绩
- 📈 **配速区间识别** - E/M/T/I/A 区配速与心率对应关系

## 快速开始

### 1. 配置 MCP 服务器

```bash
# 全局安装 coros-mcp CLI
npm install -g coros-mcp
```

### 2. 查看完整文档

👉 [SKILL.md](SKILL.md) - 完整的 Skill 使用指南

### 3. 查看示例

👉 [references/node-wrapper-example.md](references/node-wrapper-example.md) - Node.js 包装调用示例

## 适用场景

- "分析最近一个月训练"
- "看看某月的跑步数据"  
- "评估这周的训练计划"
- "我的马配和乳酸阈值是多少"
- "预估一下我的全马/半马成绩"
- "配置 coros-mcp MCP"

## 相关链接

- 🏠 [WorkBuddy Skills](https://www.codebuddy.cn) - 安装和使用 AI Skills
- 📱 [COROS 高驰](https://www.coros.com) - 运动手表官方

---
*本项目使用 COROS MCP 进行数据获取和分析*
