/**
 * 将高驰运动数据分析 Skill 推送到 GitHub
 * 使用 GitHub API 直接推送（无需 gh CLI 或本地 git）
 *
 * 使用前设置环境变量：
 *   export GITHUB_TOKEN=ghp_xxxxx          # Linux/macOS
 *   set GITHUB_TOKEN=ghp_xxxxx              # Windows CMD
 *   $env:GITHUB_TOKEN="ghp_xxxxx"           # Windows PowerShell
 *
 * 或者创建 .env 文件：
 *   GITHUB_TOKEN=ghp_xxxxx
 *   SKILL_DIR=~/.workbuddy/skills/高驰运动数据分析
 *   WORKSPACE_DIR=./高驰数据分析
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// === 配置（环境变量优先，否则从 .env 文件读取） ===
function loadEnv() {
  const env = {};
  // 尝试读取 .env 文件
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
        }
      }
    }
  }
  return env;
}

// Token 读取优先级：环境变量 > .env 文件 > 提示用户输入
function getToken() {
  const env = loadEnv();
  const fromEnv = process.env.GITHUB_TOKEN || env.GITHUB_TOKEN;
  if (fromEnv) return fromEnv;
  console.error('❌ 未设置 GITHUB_TOKEN 环境变量');
  console.error('   export GITHUB_TOKEN=ghp_xxxxx   # Linux/macOS');
  console.error('   set GITHUB_TOKEN=ghp_xxxxx       # Windows CMD');
  console.error('   或在脚本同目录创建 .env 文件：GITHUB_TOKEN=ghp_xxxxx');
  process.exit(1);
}

const TOKEN = getToken();
const OWNER = 'njzyshare';
const REPO = 'coros-running-analysis';
const BRANCH = 'main';
const COMMIT_MSG = process.argv[2] || 'update: skill sync';

// ========== 路径发现（不依赖硬编码绝对路径） ==========

function findSkillDir() {
  // 1. 环境变量 SKILL_DIR
  const env = loadEnv();
  if (env.SKILL_DIR) return path.resolve(__dirname, env.SKILL_DIR);
  if (process.env.SKILL_DIR) return process.env.SKILL_DIR;

  // 2. 常见 skill 安装位置
  const candidates = [
    path.join(os.homedir(), '.workbuddy', 'skills', '高驰运动数据分析'),
  ];
  for (const c of candidates) {
    const testFile = path.join(c, 'SKILL.md');
    if (fs.existsSync(testFile)) return c;
  }

  // 3. 当前目录的相对路径兜底
  const localDir = path.join(__dirname, '高驰运动数据分析');
  if (fs.existsSync(path.join(localDir, 'SKILL.md'))) return localDir;

  console.error('❌ 找不到 SKILL_DIR，请设置环境变量 SKILL_DIR');
  process.exit(1);
}

function findWorkspaceDir() {
  // 1. 环境变量 WORKSPACE_DIR
  const env = loadEnv();
  if (env.WORKSPACE_DIR) return path.resolve(__dirname, env.WORKSPACE_DIR);
  if (process.env.WORKSPACE_DIR) return process.env.WORKSPACE_DIR;

  // 2. 从当前脚本目录向上找
  const searchDirs = [
    path.join(__dirname, '高驰数据分析'),
    path.join(__dirname, '..', '高驰数据分析'),
  ];
  for (const d of searchDirs) {
    if (fs.existsSync(path.join(d, 'coros_detail.js'))) return d;
  }

  console.error('❌ 找不到 WORKSPACE_DIR，请设置环境变量 WORKSPACE_DIR');
  process.exit(1);
}

const SKILL_DIR = findSkillDir();
const WORKSPACE_DIR = findWorkspaceDir();

// 要推送的 skill 文件（相对于 SKILL_DIR）
const FILES = [
  'SKILL.md',
  'references/coros-tool-calling.md',
  'references/report-template.md',
  'references/training-metrics.md',
  'references/weather-analysis.md',
  'references/web-detail-fetcher.md',
  'references/time-weather-refinement.md',
  'references/analysis-workflow.md',
];

// 工作区文件（相对于 WORKSPACE_DIR）
const WORKSPACE_FILES = [
  { local: 'coros_detail.js', remote: 'scripts/coros_detail.js' },
  { local: 'coros_web_login.js', remote: 'scripts/coros_web_login.js' },
];

function getFileSha(owner, repo, path, branch) {
  return new Promise((resolve) => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
    const opts = {
      hostname: 'api.github.com',
      path: url.replace('https://api.github.com', ''),
      method: 'GET',
      headers: {
        'User-Agent': 'coros-push-script',
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(body).sha); }
          catch (e) { resolve(null); }
        } else { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function pushFile(remotePath, content) {
  const sha = await getFileSha(OWNER, REPO, remotePath, BRANCH);
  const body = JSON.stringify({
    message: COMMIT_MSG,
    branch: BRANCH,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    sha: sha || undefined,
  });

  return new Promise((resolve) => {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(remotePath)}`;
    const opts = {
      hostname: 'api.github.com',
      path: url.replace('https://api.github.com', ''),
      method: 'PUT',
      headers: {
        'User-Agent': 'coros-push-script',
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`  ✅ ${remotePath}`);
        } else {
          console.log(`  ❌ ${remotePath} (${res.statusCode}): ${body.substring(0,200)}`);
        }
        resolve();
      });
    });
    req.on('error', (e) => { console.log(`  ❌ ${remotePath}: ${e.message}`); resolve(); });
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log(`🚀 开始推送...\n`);
  console.log(`   SKILL_DIR: ${SKILL_DIR}`);
  console.log(`   WORKSPACE_DIR: ${WORKSPACE_DIR}\n`);

  // 推送 skill 目录文件
  console.log('📁 推送 skill 文件:');
  for (const f of FILES) {
    const fullPath = path.join(SKILL_DIR, f);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      await pushFile(f, content);
    } else {
      console.log(`  ⚠️  本地文件不存在: ${f}`);
    }
  }

  // 推送工作区脚本文件
  console.log('\n📁 推送工作区脚本:');
  for (const wf of WORKSPACE_FILES) {
    const fullPath = path.join(WORKSPACE_DIR, wf.local);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      await pushFile(wf.remote, content);
    } else {
      console.log(`  ⚠️  本地文件不存在: ${wf.local}`);
    }
  }

  console.log('\n✅ 推送完成！');
})().catch(e => console.error('❌ 推送失败:', e.message));
