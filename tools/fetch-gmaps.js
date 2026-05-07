// Fetch a Google Maps place listing using Playwright
// Usage: node tools/fetch-gmaps.js "<maps url>"
// Output: JSON to stdout, full page HTML to /tmp/gmaps.html
//
// Reliably extracts: heading, phone, address, website, rating, reviewCount, hours, photos (googleusercontent.com)
// Services tab often empty for small businesses — decode category from URL 15s param instead.
//
// Environment requirements (sandbox):
//   playwright: /opt/node22/lib/node_modules/playwright
//   chromium:   /opt/pw-browsers/chromium-1194/chrome-linux/chrome
//   ignoreHTTPSErrors: true  (sandbox MITM proxy)

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');

(async () => {
  const url = process.argv[2];
  if (!url) { console.error('usage: node tools/fetch-gmaps.js "<url>"'); process.exit(1); }

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 1100 },
    locale: 'en-AU',
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await ctx.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try { await page.click('button:has-text("Reject all")', { timeout: 2000 }); } catch {}
  await page.waitForTimeout(3000);

  const out = {};

  // Business name
  out.heading = await page.locator('h1').first().textContent().catch(() => null);

  // Key aria-label fields: phone, address, website, hours, rating
  const allAria = await page.locator('[aria-label]').evaluateAll(
    els => els.map(e => e.getAttribute('aria-label')).filter(x => x && x.length < 300)
  );
  out.aria = allAria.filter(a =>
    /(Phone:|Address:|Website:|Hours|Plus code|reviews|^Open|^Closed|stars)/i.test(a)
  );

  // Decode category from URL (15s... param encodes the business type)
  const catMatch = url.match(/\b15s([^!&/]+)/);
  out.categoryEncoded = catMatch ? catMatch[1] : null;

  // Try Services tab
  let servicesText = '';
  try {
    await page.locator('button[role="tab"]').filter({ hasText: 'Services' }).first().click({ timeout: 3000 });
    await page.waitForTimeout(2000);
    servicesText = await page.locator('[role="tabpanel"]').first().innerText().catch(() => '');
  } catch {}
  out.servicesText = servicesText;

  // Available tabs
  out.tabs = await page.locator('button[role="tab"]').allTextContents().catch(() => []);

  // About tab
  try {
    await page.locator('button[role="tab"]').filter({ hasText: 'About' }).first().click({ timeout: 3000 });
    await page.waitForTimeout(2000);
    out.aboutText = await page.locator('[role="tabpanel"]').first().innerText().catch(() => '');
  } catch {}

  // Reviews
  try {
    await page.locator('button[role="tab"]').filter({ hasText: /Reviews/ }).first().click({ timeout: 3000 });
    await page.waitForTimeout(3000);
    out.reviewsText = (await page.locator('[role="tabpanel"]').first().innerText().catch(() => '')).slice(0, 4000);
  } catch {}

  // Photos tab — scroll to load more
  try {
    await page.locator('button[role="tab"]').filter({ hasText: 'Photos' }).first().click({ timeout: 3000 });
    await page.waitForTimeout(2000);
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(1500);
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(1500);
  } catch {}

  // Collect all googleusercontent images (covers + gallery)
  const imgs = await page.locator('img, button[style*="background-image"], a[style*="background-image"]').evaluateAll(els => {
    const urls = new Set();
    for (const e of els) {
      if (e.src && /googleusercontent\.com/.test(e.src)) urls.add(e.src);
      const bg = e.getAttribute('style') || '';
      const m = bg.match(/url\((['"]?)(https?:[^)'"]+)\1\)/);
      if (m && /googleusercontent\.com/.test(m[2])) urls.add(m[2]);
    }
    return [...urls];
  });
  // Upgrade resolution: replace small dimensions with larger ones
  out.photos = imgs.map(u => u.replace(/=w\d+-h\d+(-[^"&]*)*/g, '=w2000-h2000'));

  // Save full HTML for offline parsing
  const html = await page.content();
  fs.writeFileSync('/tmp/gmaps.html', html);
  out.htmlBytes = html.length;

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
