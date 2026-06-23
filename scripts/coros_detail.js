/**
 * 高驰网页端活动详情抓取器（headless 后台化）
 *
 * 用途：抓取单次训练完整计圈数据，绕过 MCP"最快1km"口径问题
 * 依赖：playwright
 * 登录态：.secrets/coros-state/coros_state.json（首次需运行 coros_web_login.js）
 *
 * 所有个人数据（登录态/个人档案/MCP token 备份）统一存放在 .secrets/ 目录，
 * 与 skill 路径独立，方便共享 skill。
 *
 * 用法：
 *   1. 模块化调用：
 *      const { fetchActivityDetail, listActivities } = require('./coros_detail.js');
 *      const data = await fetchActivityDetail('477786450333565028', '100');
 *
 *   2. CLI：
 *      node coros_detail.js <labelId> <sportType>
 *      node coros_detail.js --list  # 列出最近活动
 *
 * 行为约定（重要）：
 *   - 脚本始终在后台运行（headless: true），浏览器**不会**弹到前台。
 *   - 仅登录脚本 coros_web_login.js 第一次跑时需要弹窗（用户输入）。
 *   - 登录态失效时，fetchActivityDetail / listActivities 返回 loginRequired: true，
 *     抛 NoLoginStateError 错误。脚本不会自动弹窗，需要用户手动跑登录脚本。
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const STATE_DIR = path.join(__dirname, '.secrets', 'coros-state');
const STATE_FILE = path.join(STATE_DIR, 'coros_state.json');
const ACTIVITY_URL = (labelId, sportType) =>
  `https://t.coros.com/activity-detail?labelId=${labelId}&sportType=${sportType}`;

class NoLoginStateError extends Error {
  constructor() {
    super(
      '未找到登录态文件。\n' +
      '请先运行登录脚本（会自动弹窗一次，登录后即可）：\n' +
      '  node coros_web_login.js\n' +
      '\n' +
      '登录态文件位置：' + STATE_FILE
    );
    this.name = 'NoLoginStateError';
    this.code = 'NO_LOGIN_STATE';
  }
}

/**
 * 启动一个 headless 浏览器（不弹窗）
 */
async function launchBrowser() {
  return await chromium.launch({
    headless: true,            // ✅ 关键：不弹窗到前台
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
    ],
  });
}

/**
 * 检查登录态文件是否存在 + 校验基本结构
 */
function checkLoginState() {
  if (!fs.existsSync(STATE_FILE)) {
    throw new NoLoginStateError();
  }
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    if (!data.cookies || !Array.isArray(data.cookies) || data.cookies.length === 0) {
      throw new NoLoginStateError();
    }
  } catch (e) {
    if (e instanceof NoLoginStateError) throw e;
    throw new NoLoginStateError();
  }
}

/**
 * 轻量检查：是否有可用登录态（用于判断是否走网页端细化）
 * @returns {boolean}
 */
function hasLoginState() {
  try {
    checkLoginState();
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 抓取单次活动详情（含完整计圈表）
 * @param {string} labelId 活动 ID
 * @param {string} sportType 运动类型代码（如 100=户外跑）
 * @returns {Promise<{summary: object, tables: Array, url: string, loginRequired: boolean}>}
 *   loginRequired=true 表示登录态已失效，需要用户重新登录
 */
async function fetchActivityDetail(labelId, sportType) {
  checkLoginState();

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      locale: 'zh-CN',
      storageState: STATE_FILE,
    });
    const page = await context.newPage();
    const url = ACTIVITY_URL(labelId, sportType);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    try {
      await page.waitForSelector('text=平均配速', { timeout: 15000 });
    } catch (e) {
      // 继续抓取，可能页面结构略有变化
    }

    // 检测是否被重定向到登录页（登录态失效）
    const finalUrl = page.url();
    const loginRequired = /\/auth|login/i.test(finalUrl);

    const data = await page.evaluate(() => {
      const tables = [];
      document.querySelectorAll('table').forEach((t, i) => {
        const rows = Array.from(t.querySelectorAll('tr')).map(r =>
          Array.from(r.querySelectorAll('th,td')).map(c => (c.textContent || '').trim())
        );
        tables.push({ idx: i, rows });
      });

      const summary = {};
      const labels = ['距离', '运动时间', '总时间', '平均配速', '最快1公里',
                      '平均心率', '平均功率', '平均步频', '累计上升', '累计下降',
                      '训练负荷', '等强配速', '卡路里'];
      const numericPattern = /^[\d:.'"\/km\smw]+$/;
      const lines = (document.body.innerText || '').split('\n').map(s => s.trim()).filter(s => s.length > 0);
      for (let i = 0; i < lines.length - 1; i++) {
        for (const lbl of labels) {
          if (lines[i] === lbl && !summary[lbl]) {
            const val = lines[i + 1];
            if (val && numericPattern.test(val)) {
              summary[lbl] = val;
            }
            break;
          }
        }
      }

      return { tables, summary, url: location.href };
    });

    // 从页面文本中提取开始时间和天气（不在 evaluate 里做，防止跨域问题）
    const pageText = await page.evaluate(() => document.body.innerText || '');
    const lines = pageText.split('\n').map(s => s.trim()).filter(s => s.length > 0);

    // 提取开始时间：活动名称后第一个匹配 "YYYY年M月D日 上/下午 HH:MM" 的行
    const timePattern = /(\d{4})年(\d{1,2})月(\d{1,2})日\s*(上午|下午|晚上|早晨|清晨)?\s*(\d{2}:\d{2})?/;
    let startTime = null;
    for (const line of lines) {
      const m = line.match(timePattern);
      if (m) {
        startTime = {
          raw: line,
          date: `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`,
          period: m[4] || '',
          time: m[5] || '',
        };
        break;
      }
    }

    // 提取天气：找 "XX℃" 行，然后往前看天气现象，往后看湿度和风
    let weather = null;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(\d+)℃$/);
      if (!m) continue;
      const temp = parseInt(m[1]);
      let condition = '', humidity = 0, wind = '';
      for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
        if (/^[\u4e00-\u9fa5]{1,6}$/.test(lines[j])) {
          condition = lines[j]; break;
        }
      }
      for (let j = i + 1; j <= i + 5 && j < lines.length; j++) {
        if (/^\d{2}$/.test(lines[j])) {
          humidity = parseInt(lines[j]); break;
        }
      }
      for (let j = i + 2; j <= i + 6 && j < lines.length; j++) {
        if (/^[\u4e00-\u9fa5]{1,2}\s\d+$/.test(lines[j])) {
          wind = lines[j]; break;
        }
      }
      if (condition) {
        weather = { condition, temp, humidity, wind };
        break;
      }
    }

    return { ...data, startTime, weather, loginRequired };
  } finally {
    await browser.close();
  }
}

/**
 * 解析计圈表 → 结构化数据
 */
function parseLaps(data) {
  if (!data.tables || data.tables.length === 0) return { laps: [], fastestLap: null };

  const table = data.tables[0];
  const header = table.rows[0];
  if (!header.includes('圈数')) return { laps: [], fastestLap: null };

  const laps = [];
  for (let i = 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    if (row.length < 7) continue;
    laps.push({
      marker: row[0] || '',
      number: row[1] || '',
      distance: row[2] || '',
      time: row[3] || '',
      cumulative: row[4] || '',
      pace: row[5] || '',
      hr: row[6] || '',
      eqPace: row[7] || '',
      targetHit: row[8] || '',
    });
  }

  const fastestLap = laps.find(l => l.marker === '最快') || null;
  return { laps, fastestLap };
}

/**
 * 列出活动列表（最近 N 条）
 */
async function listActivities(limit = 30) {
  checkLoginState();

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      locale: 'zh-CN',
      storageState: STATE_FILE,
    });
    const page = await context.newPage();

    await page.goto('https://t.coros.com/admin/views/activities', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    const finalUrl = page.url();
    const loginRequired = /\/auth|login/i.test(finalUrl);

    const rawActivities = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="activity-detail"]'))
        .map(a => ({
          name: (a.textContent || '').trim(),
          labelId: (a.href.match(/labelId=(\d+)/) || [])[1] || '',
          sportType: (a.href.match(/sportType=(\d+)/) || [])[1] || '',
          href: a.href,
        }))
        .filter(x => x.labelId);
    });

    const dedup = new Map();
    for (const a of rawActivities) {
      if (!dedup.has(a.labelId) || a.name.length > dedup.get(a.labelId).name.length) {
        dedup.set(a.labelId, a);
      }
    }

    return { activities: Array.from(dedup.values()).slice(0, limit), loginRequired };
  } finally {
    await browser.close();
  }
}

// ============= CLI =============
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === '--list') {
    listActivities(50).then(({ activities, loginRequired }) => {
      if (loginRequired) {
        console.log('⚠️  登录态已失效，请先运行：node coros_web_login.js');
        return;
      }
      console.log(`共 ${activities.length} 条活动：\n`);
      activities.forEach((a, i) => {
        console.log(`[${i + 1}] [${a.sportType}] ${a.name}`);
        console.log(`    ${a.href}`);
      });
    }).catch(e => {
      if (e.code === 'NO_LOGIN_STATE') {
        console.log('⚠️  ' + e.message);
      } else {
        console.error('错误:', e.message);
        process.exit(1);
      }
    });
  } else if (args[0] && args[1]) {
    const [labelId, sportType] = args;
    fetchActivityDetail(labelId, sportType).then(data => {
      if (data.loginRequired) {
        console.log('⚠️  登录态已失效，请先运行：node coros_web_login.js');
        return;
      }
      console.log('===== 概要 =====');
      console.log(JSON.stringify(data.summary, null, 2));
      console.log('\n===== 计圈表 =====');
      if (data.tables[0]) {
        data.tables[0].rows.forEach((r, i) => {
          console.log(`行[${i}]: ${JSON.stringify(r)}`);
        });
      }
      const { laps, fastestLap } = parseLaps(data);
      console.log('\n===== 解析结果 =====');
      console.log(`总圈数: ${laps.length}`);
      if (fastestLap) {
        console.log(`最快单圈（APP 口径）: #${fastestLap.number} ${fastestLap.distance} ${fastestLap.pace} HR=${fastestLap.hr}`);
      } else {
        console.log('未找到"最快"标记的圈');
      }
    }).catch(e => {
      if (e.code === 'NO_LOGIN_STATE') {
        console.log('⚠️  ' + e.message);
      } else {
        console.error('错误:', e.message);
        process.exit(1);
      }
    });
  } else {
    console.log('用法:');
    console.log('  node coros_detail.js <labelId> <sportType>   # 抓取单次活动');
    console.log('  node coros_detail.js --list                   # 列出最近活动');
  }
}

module.exports = {
  fetchActivityDetail,
  listActivities,
  parseLaps,
  hasLoginState,
  STATE_FILE,
  STATE_DIR,
  NoLoginStateError,
};
