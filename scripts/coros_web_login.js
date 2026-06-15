const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const STATE_DIR = path.join(__dirname, '.secrets', 'coros-state');
const STATE_FILE = path.join(STATE_DIR, 'coros_state.json');
const SCREENSHOT_DIR = __dirname;

// 所有个人数据统一放在 .secrets/ 目录，与 skill 分离，方便共享
if (!fs.existsSync(STATE_DIR)) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

(async () => {
  // ✅ headless: false 仅登录这一步（需要用户输入）
  // 后续数据抓取脚本（coros_detail.js）使用 headless: true，不会再弹窗
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'zh-CN',
  });

  const page = await context.newPage();

  // 打开高驰 Training Hub 登录页
  console.log('正在打开高驰 Training Hub 登录页...');
  await page.goto('https://t.coros.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // 截图保存登录页
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'coros_login_page.png'), fullPage: false });
  console.log('登录页截图已保存，请在浏览器窗口中登录你的高驰账号');
  console.log('登录完成后，此脚本会自动继续...');

  // 等待登录成功 - 等待直到URL不再是登录页
  console.log('等待登录完成（最长5分钟）...');
  const startUrl = page.url();

  try {
    await page.waitForFunction(
      (url) => window.location.href !== url && !window.location.href.includes('/auth'),
      startUrl,
      { timeout: 300000 }
    );
    await page.waitForTimeout(3000);
    console.log('检测到页面跳转，登录成功！当前URL:', page.url());
  } catch (e) {
    console.log('等待超时，当前URL:', page.url());
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'coros_after_login.png'), fullPage: false });
    console.log('已保存当前页面截图');
    console.log('⚠️  登录可能未完成，登录态可能无效');
  }

  // 保存登录态
  await context.storageState({ path: STATE_FILE });
  console.log('✅ 登录态已保存到:', STATE_FILE);
  console.log('提示：后续脚本（coros_detail.js）将使用 headless 模式，不会再弹窗');

  // 再截一张确认页面
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'coros_dashboard.png'), fullPage: false });
  console.log('仪表盘截图已保存');

  console.log('\n=== 脚本完成 ===');
  console.log('浏览器将保持打开。');

  await browser.close();
})();

