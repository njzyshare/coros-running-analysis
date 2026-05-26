---
title: "COROS 工具调用参考"
summary: "MCP 配置、路径发现、认证、CLI 调用、工具速查"
---

# COROS 工具调用参考

## 一、MCP 配置

### 安装

```bash
npm install -g coros-mcp

# 或本地安装
mkdir -p ~/.workbuddy/.tmp && cd ~/.workbuddy/.tmp && npm install coros-mcp
```

> ⚠️ `--cache-root` 一致性：CLI 默认缓存路径为 `~/.coros-mcp-skill-gateway-ts`。如果指定了 `--cache-root`，则登录和后续所有调用需要使用同一个路径。

### mcp.json (WorkBuddy)

```json
{
  "mcpServers": {
    "coros": {
      "command": "node",
      "args": ["PATH/cli.js", "--cache-root", "PATH/cache"],
      "env": {}
    }
  }
}
```

## 二、路径发现

不要硬编码路径。使用以下策略自动发现：

```javascript
const path = require('path');
const os = require('os');
const fs = require('fs');

function findCorosMcp() {
  const candidates = [
    path.join(os.homedir(), 'node_modules/coros-mcp/dist/cli.js'),
    path.join(os.homedir(), '.workbuddy/.tmp/coros-mcp-local/node_modules/coros-mcp/dist/cli.js'),
    path.join(os.homedir(), '.workbuddy/.tmp/node_modules/coros-mcp/dist/cli.js'),
    path.join(process.cwd(), '.tmp/coros-mcp-local/node_modules/coros-mcp/dist/cli.js'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return { cli: p, baseDir: path.dirname(path.dirname(path.dirname(p))) };
  }
  let dir = os.homedir();
  for (let i = 0; i < 4; i++) {
    for (const sub of ['.workbuddy/.tmp/coros-mcp-local', '.workbuddy/.tmp']) {
      const tryPath = path.join(dir, sub, 'node_modules/coros-mcp/dist/cli.js');
      if (fs.existsSync(tryPath)) return { cli: tryPath, baseDir: path.join(dir, sub) };
    }
    dir = path.dirname(dir);
  }
  return null;
}
```

## 三、认证

```bash
node CLI_PATH login           # 获取浏览器授权URL
# 用户打开URL完成认证
node CLI_PATH login-finish    # 完成登录
```

## 四、CLI 兜底调用函数

```javascript
const { spawnSync } = require('child_process');

function call(tool, args) {
  const found = findCorosMcp();
  if (!found) return { error: 'coros-mcp not found' };
  const r = spawnSync('node', [
    found.cli, '--cache-root', path.join(found.baseDir, 'corOs-cache'),
    'call-tool', '--tool', tool,
    '--arguments-json', JSON.stringify(args)
  ], { encoding: 'utf8', timeout: 30000 });
  try { return JSON.parse(r.stdout); }
  catch (e) { return { raw: r.stdout, error: r.stderr }; }
}
```

## 五、工具速查表

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

## 六、常用调用示例

```javascript
call('querySportRecords', { startDate:'YYYYMMDD', endDate:'YYYYMMDD', sportTypeCodes:[100], limit:100, timezone:'Asia/Shanghai' })
call('getActivityDetail', { labelId:'{ID}', sportType:100 })
call('queryFitnessAssessmentOverview', {})
call('queryDailyHealthData', { days:7, timezone:'Asia/Shanghai' })
call('queryTrainingLoadAssessment', { days:30 })
call('queryRecoveryStatus', {})
call('queryHrvAssessment', { days:7, timezone:'Asia/Shanghai' })
// 睡眠数据注意日期错位：查"N晚" → endDate 设为 N+1
call('querySleepData', { startDate:'YYYYMMDD', endDate:'YYYYMMDD+N', days:2, timezone:'Asia/Shanghai' })
```
