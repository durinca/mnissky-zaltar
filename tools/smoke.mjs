// Headless-browser smoke test: every day x hour renders without errors. node tools/smoke.mjs [shotsDir]
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = join(dist, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }); res.end(readFileSync(f));
}).listen(4173);

const shots = process.argv[2]; if (shots) mkdirSync(shots, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const dates = ['2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19',
  // seasons: Advent, Dec 17-24, Christmas, Lent, Holy Week, Easter
  '2026-12-01', '2026-11-29', '2026-12-20', '2026-12-24', '2026-12-30', '2027-01-03', '2027-01-09', '2027-02-10', '2027-02-14', '2027-03-22', '2027-03-25', '2027-03-28', '2027-04-01', '2027-04-14', '2027-05-05'];
const HOURS = { 0: ['inv','pc','lauds','terce','sext','none','v2','komp'], 6: ['inv','pc','lauds','terce','sext','none','v1','komp1'] };
let bad = 0, n = 0;
for (const d of dates) {
  const dow = new Date(d + 'T12:00:00').getDay();
  const hs = HOURS[dow] ?? ['inv','pc','lauds','terce','sext','none','v','komp'];
  for (const h of hs) {
    await page.goto(`http://localhost:4173/#/${d}/${h}`, { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('article.hour, .error', { timeout: 8000 });
    const r = await page.evaluate(() => ({ err: !!document.querySelector('.error'), len: document.querySelector('article.hour')?.innerText.length ?? 0, secs: document.querySelectorAll('h2.sec').length, badge: document.getElementById('badge').textContent, tts: document.querySelectorAll('[data-tts]').length }));
    n++;
    if (r.err || r.len < 200) { bad++; console.log('BAD', d, h, JSON.stringify(r)); }
    else if (h === 'lauds' || h === 'v1') console.log(d, h, JSON.stringify(r));
    if (shots && (h === 'lauds' || h === 'v1' || h === 'pc') && ['2026-09-14', '2026-09-20', '2026-09-19', '2026-09-13'].includes(d)) await page.screenshot({ path: join(shots, `${d}-${h}.png`), fullPage: false });
  }
}
// offline: the service worker must serve every day once installed
await page.goto('http://localhost:4173/#/2026-09-14/lauds', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => navigator.serviceWorker.ready);
await new Promise((r) => setTimeout(r, 1500));
await page.setOfflineMode(true);
await page.goto('http://localhost:4173/#/2026-09-16/v', { waitUntil: 'domcontentloaded' });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('article.hour, .error', { timeout: 8000 });
const offlineOk = await page.evaluate(() => !!document.querySelector('article.hour'));
console.log('offline render:', offlineOk ? 'ok' : 'FAILED');
if (!offlineOk) bad++;
await page.setOfflineMode(false);
console.log(`checked ${n} hours, ${bad} bad, ${errors.length} errors`);
errors.slice(0, 10).forEach((e) => console.log(e));
await browser.close(); server.close();
process.exit(bad || errors.length ? 1 : 0);
