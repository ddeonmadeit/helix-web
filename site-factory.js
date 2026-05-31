#!/usr/bin/env node
/**
 * site-factory.js — Automated site builder for no-website leads
 *
 * Flow:
 *   1. Sync leads-db.json from VPS (no-website leads only)
 *   2. Filter: has phone + not already built (state file + slug folder check)
 *   3. For each lead: call Claude API → get HTML/CSS/JS via tool_use
 *   4. Fetch Unsplash hero image
 *   5. Generate icons (Python Pillow)
 *   6. Apply mobile CSS fixes
 *   7. Commit + push to GitHub
 *   8. rsync deploy to VPS → verify 200 OK
 *   9. Append to sms-queue.csv + update state file
 *
 * Usage:
 *   node site-factory.js                 # build up to 10 sites
 *   node site-factory.js --count=5       # build up to 5 sites
 *   node site-factory.js --dry-run       # show queue, don't build
 *
 * Required env vars:
 *   CLAUDE_API_KEY         — Anthropic API key
 *   UNSPLASH_ACCESS_KEY    — Unsplash API key (free at unsplash.com/developers)
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────
const REPO_DIR    = path.resolve(__dirname);
const SITES_DIR   = path.join(REPO_DIR, 'sites');
const STATE_FILE  = path.join(REPO_DIR, 'site-factory-state.json');
const SMS_QUEUE   = path.join(REPO_DIR, 'sms-queue.csv');
const VPS         = 'root@187.77.184.36';
const SSH_KEY     = '/Users/juna/.ssh/helix_fresh';
const VPS_DB_PATH = '/opt/helix-website-scraper/output/leads-db.json';
const VPS_DEPLOY  = '/var/www/buildquote/public';
const LIVE_BASE   = 'https://helixsolution.au';
const BRANCH      = 'claude/one-page-website-designer-vpSDS';

const BATCH_SIZE = parseInt(process.argv.find(a => a.startsWith('--count='))?.split('=')[1] ?? '10');
const DRY_RUN    = process.argv.includes('--dry-run');
const DELAY_MS   = 30_000; // 30s between sites

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (msg, ...args) => console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`, ...args);

function slugify(name, location) {
  const base = (name + ' ' + (location || ''))
    .toLowerCase()
    .replace(/pty\s*ltd|inc\.?|llc|&\s*co\.?/gi, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base;
}

function exec(cmd, opts = {}) {
  return execSync(cmd, { cwd: REPO_DIR, encoding: 'utf8', stdio: 'pipe', ...opts });
}

// ── Load / save state ─────────────────────────────────────────────────────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return {}; }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Append to SMS CSV queue ───────────────────────────────────────────────────
function appendToSmsQueue(businessName, phone, url) {
  const header = 'businessName,phone,url\n';
  const row = `"${businessName.replace(/"/g, '""')}","${phone}","${url}"\n`;
  if (!fs.existsSync(SMS_QUEUE)) fs.writeFileSync(SMS_QUEUE, header);
  fs.appendFileSync(SMS_QUEUE, row);
}

// ── Sync leads from VPS ───────────────────────────────────────────────────────
function syncLeads() {
  log('Syncing leads from VPS...');
  const localPath = path.join(REPO_DIR, 'leads-db.json');
  execSync(`scp -i ${SSH_KEY} -o StrictHostKeyChecking=no ${VPS}:${VPS_DB_PATH} ${localPath}`, { encoding: 'utf8' });
  const all = JSON.parse(fs.readFileSync(localPath, 'utf8'));
  log(`Synced ${all.length} leads`);
  return all;
}

// ── Build unbuilt queue ───────────────────────────────────────────────────────
function buildQueue(leads, state) {
  const queue = [];
  for (const lead of leads) {
    if (!lead.phone) continue;
    if (lead.website) continue; // already has website (shouldn't be in this DB but just in case)

    // Normalise phone for state key
    const phoneKey = lead.phone.replace(/\D/g, '');
    if (state[phoneKey]) continue; // already built

    const slug = slugify(lead.businessName || '', lead.location || '');
    if (!slug) continue;
    if (fs.existsSync(path.join(SITES_DIR, slug))) continue; // folder already exists

    queue.push({ ...lead, phoneKey, slug });
  }
  return queue;
}

// ── Fetch Unsplash hero image ─────────────────────────────────────────────────
async function fetchHeroImage(query, destPath) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error('UNSPLASH_ACCESS_KEY not set');

  const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&order_by=relevant`;
  const res = await fetch(searchUrl, { headers: { Authorization: `Client-ID ${key}` } });
  if (!res.ok) throw new Error(`Unsplash search failed: ${res.status}`);

  const data = await res.json();
  const photos = data.results || [];
  if (!photos.length) throw new Error(`No Unsplash results for: ${query}`);

  // Pick first result with a landscape photo
  const photo = photos[0];
  const imgUrl = photo.urls.regular; // ~1080px wide, good quality

  // Download the image
  const imgRes = await fetch(imgUrl);
  if (!imgRes.ok) throw new Error(`Unsplash download failed: ${imgRes.status}`);
  const buffer = await imgRes.buffer();
  fs.writeFileSync(destPath, buffer);

  // Trigger download event (Unsplash API guidelines)
  if (photo.links?.download_location) {
    fetch(`${photo.links.download_location}&client_id=${key}`).catch(() => {});
  }

  return {
    url: photo.links?.html || '',
    photographer: photo.user?.name || '',
    unsplashId: photo.id,
  };
}

// ── Generate icons via Python Pillow ─────────────────────────────────────────
function generateIcons(heroPath, imagesDir, accentHex) {
  const py = `
from PIL import Image, ImageDraw
import os

accent = "${accentHex.replace('#','')}"
r,g,b = int(accent[0:2],16), int(accent[2:4],16), int(accent[4:6],16)
hero = Image.open("${heroPath}").convert("RGBA")

def make_icon(size, maskable=False):
    pad = int(size * 0.15) if maskable else 0
    inner = size - pad * 2
    img = Image.new("RGBA", (size, size), (r, g, b, 255))
    # Crop and paste hero as background circle / square
    aspect = hero.width / hero.height
    if aspect > 1:
        new_h = inner
        new_w = int(new_h * aspect)
    else:
        new_w = inner
        new_h = int(new_w / aspect)
    thumb = hero.resize((new_w, new_h), Image.LANCZOS)
    x_off = (inner - new_w) // 2 + pad
    y_off = (inner - new_h) // 2 + pad
    img.paste(thumb, (x_off, y_off))
    # Tint overlay
    overlay = Image.new("RGBA", (size, size), (r, g, b, 120))
    img = Image.alpha_composite(img, overlay)
    return img.convert("RGB")

make_icon(192).save("${imagesDir}/icon-192.png")
make_icon(512).save("${imagesDir}/icon-512.png")
make_icon(512, maskable=True).save("${imagesDir}/icon-maskable-512.png")
make_icon(180).save("${imagesDir}/apple-touch-icon.png")
print("icons OK")
`.trim();

  const result = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Icon generation failed: ${result.stderr}`);
}

// ── Apply mandatory mobile CSS fixes ─────────────────────────────────────────
function applyMobileFixes(css) {
  // Fix/add 720px breakpoint rules
  const fix720 = `.nav { gap: 12px }\n  .nav__cta { display: none }\n  .brand__name { font-size: 20px }\n  .hero { align-items: center }`;
  if (css.includes('@media (max-width: 720px)')) {
    css = css.replace(
      /@media \(max-width: 720px\)\s*\{([^}]*\.nav__links[^}]*)\}/,
      (match, inner) => {
        if (inner.includes('nav__cta')) return match; // already has the fixes
        return `@media (max-width: 720px) {${inner}\n  ${fix720}\n}`;
      }
    );
  }

  // Fix 540px svc-row gap and add svc-num size
  css = css.replace(
    /\.svc-row\s*\{[^}]*grid-template-columns:\s*56px 1fr[^}]*gap:\s*\d+px[^}]*\}/,
    m => m.replace(/gap:\s*\d+px/, 'gap: 0 16px')
  );
  if (css.includes('@media (max-width: 540px)') && !css.includes('.svc-num { font-size: 38px')) {
    css = css.replace(
      /(@media \(max-width: 540px\)\s*\{)/,
      '$1\n  .svc-num { font-size: 38px }'
    );
  }

  return css;
}

// ── Claude API system prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert web designer building one-page business websites for small Australian businesses that have no website. You will be given business details and must produce complete, production-ready HTML/CSS/JS files via the deliver_site tool.

DESIGN SYSTEM — follow exactly:

FONTS: Barlow Condensed (700, uppercase) + Inter. Load from Google Fonts with font-display: swap.
For luxury/heritage only: Cormorant Garamond + Inter.

CSS VARIABLES on :root:
  --bg, --s1, --s2, --card (4 depth levels, each lighter)
  --text, --muted, --accent, --on-accent, --border, --border2, --maxw: 1280px, --px: clamp(20px,5vw,64px)
  --imgf: brightness(.68) saturate(.85)
  --veil: two-layer gradient (horizontal left-heavy fade + bottom-up fade)
Dark theme default. [data-theme="light"] overrides. Toggle persisted to localStorage.
::selection { background: var(--accent); color: var(--on-accent) }

NAV: Fixed, 64px tall, blur backdrop, border-bottom.
  .brand__name: business name only in Barlow Condensed — NO monogram, NO icon.
  Nav links: underline-slide hover animation via ::after pseudo-element.
  .nav__cta: pill button (border-radius: 999px), accent background.
  At ≤720px: hide .nav__links and .nav__cta.

HERO: min-height: 100svh, align-items: flex-end, padding-top: 64px.
  Hero image: filter: var(--imgf). Two-layer --veil overlay.
  h1: clamp(64px, 13vw, 170px), Barlow Condensed 700.
  Stats row below copy: border-top separator, each stat has Barlow Condensed accent value + uppercase muted label.
  Primary CTA must be a tel: link.

SERVICES: <ul> with border-top, each <li> border-bottom.
  Grid: 72px | 1fr. Large faded number (Barlow Condensed, accent 22% opacity).
  Hover: ::before sliding background reveal.
  Service heading: clamp(26px, 3vw, 36px).

PROCESS: 4-column grid, border-left separators. Top accent bar on hover (scaleX animation).

CTA SECTION: background --s2, radial glow ::before. Phone number as tel: link. Address.

MOBILE STICKY BAR: position fixed, left/right 12px, bottom + env(safe-area-inset-bottom), border-radius 999px, height 52px, display none → block at ≤720px. Tel: link.

BUTTONS: pill-shaped (border-radius: 999px), min-height: 48px, font-size: 12px, font-weight: 700, letter-spacing: .18em, uppercase. Arrow SVG that translates +4px on hover.

ANIMATIONS: IntersectionObserver fade-up (opacity 0 + translateY 16px → is-in state). Ticker marquee on services. prefers-reduced-motion reset block.

ACCESSIBILITY: semantic HTML, alt text, JSON-LD LocalBusiness schema, skip nav link, visible focus states, tel: on all phone numbers.

ACCENT COLOUR: pick a unique colour that suits the industry. Never generic blue. Never reuse.

STRICT RULES:
- NO invented facts, services, testimonials, awards, or credentials.
- NO owner or personal names anywhere — use "Call us", "Get in touch", "Owner-operated".
- NO placeholders — if you don't know something, omit that section.
- Hero image will be provided separately (use <img src="images/hero.jpg">).
- Icons will be generated separately — reference images/icon-192.png, icon-512.png etc in the manifest.
- DO produce a complete, working, beautiful site — not a skeleton.
- Include the mobile action bar (fixed bottom CTA pill).
- fetchpriority="high" on hero img, loading="lazy" on all others.
- body font-size: 16px minimum.`;

// ── deliver_site tool definition ──────────────────────────────────────────────
const DELIVER_TOOL = {
  name: 'deliver_site',
  description: 'Deliver the complete one-page website files as structured output.',
  input_schema: {
    type: 'object',
    required: ['slug', 'html', 'css', 'js', 'manifest', 'hero_query', 'accent_hex'],
    properties: {
      slug: {
        type: 'string',
        description: 'URL-safe slug (lowercase-dashes, drop Pty Ltd/Inc/LLC). Max 60 chars.',
      },
      html: {
        type: 'string',
        description: 'Complete index.html file content including doctype, head, and body.',
      },
      css: {
        type: 'string',
        description: 'Complete styles.css file content.',
      },
      js: {
        type: 'string',
        description: 'Complete script.js file content.',
      },
      manifest: {
        type: 'object',
        description: 'Web app manifest object (name, short_name, theme_color, background_color, display, icons array).',
      },
      hero_query: {
        type: 'string',
        description: 'Specific Unsplash search query for hero image. Industry-specific, never generic. E.g. "timber deck merbau close up", "concrete pour construction site", "brick wall tradesman".',
      },
      accent_hex: {
        type: 'string',
        description: 'Primary accent colour as hex (e.g. #b87d2e). Must suit the industry.',
      },
    },
  },
};

// ── Build one site ─────────────────────────────────────────────────────────────
async function buildSite(lead, client) {
  const { slug, businessName, phone, address, industry, location, category, rating, reviewCount } = lead;

  log(`Building: ${businessName} → ${slug}`);

  // ── 1. Call Claude API ──────────────────────────────────────────────────────
  const userMessage = `Build a one-page website for this business:

Business name: ${businessName}
Phone: ${phone}
Industry/Category: ${category || industry}
Location: ${location || 'Australia'}
${address ? `Address: ${address}` : ''}
${rating ? `Google Maps rating: ${rating}★${reviewCount ? ` (${reviewCount} reviews)` : ''}` : ''}

Slug to use: ${slug}

No website research is possible — base the copy entirely on the business name, industry, and location. Infer realistic services for this trade/industry (e.g. a "Brush Fencing" company does fencing, garden clearing, post installation). Keep copy factual and benefit-focused. No invented testimonials or awards.

Call the deliver_site tool with all required files.`;

  log(`  → Calling Claude API...`);
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [DELIVER_TOOL],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolUse = response.content.find(b => b.type === 'tool_use' && b.name === 'deliver_site');
  if (!toolUse) throw new Error('Claude did not call deliver_site tool');

  const { html, css, js, manifest, hero_query, accent_hex } = toolUse.input;
  const finalSlug = toolUse.input.slug || slug;

  // ── 2. Set up site directory ────────────────────────────────────────────────
  const siteDir = path.join(SITES_DIR, finalSlug);
  const imagesDir = path.join(siteDir, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });

  // ── 3. Fetch Unsplash hero ──────────────────────────────────────────────────
  const heroPath = path.join(imagesDir, 'hero.jpg');
  let photoCredit = { url: '', photographer: 'Unsplash' };
  try {
    log(`  → Fetching Unsplash: "${hero_query}"`);
    photoCredit = await fetchHeroImage(hero_query, heroPath);
  } catch (err) {
    log(`  ⚠ Unsplash failed (${err.message}), trying fallback query...`);
    try {
      const fallback = `${category || industry} australia professional`;
      photoCredit = await fetchHeroImage(fallback, heroPath);
    } catch (err2) {
      log(`  ✗ Unsplash fallback also failed: ${err2.message}`);
      // Write a 1x1 placeholder so the site still deploys — better than crashing
      fs.writeFileSync(heroPath, Buffer.alloc(0));
    }
  }

  // ── 4. Generate icons ───────────────────────────────────────────────────────
  log(`  → Generating icons...`);
  try {
    generateIcons(heroPath, imagesDir, accent_hex || '#b87d2e');
  } catch (err) {
    log(`  ⚠ Icon generation failed: ${err.message}`);
  }

  // ── 5. Apply mobile CSS fixes + write files ─────────────────────────────────
  const fixedCss = applyMobileFixes(css);

  fs.writeFileSync(path.join(siteDir, 'index.html'), html);
  fs.writeFileSync(path.join(siteDir, 'styles.css'), fixedCss);
  fs.writeFileSync(path.join(siteDir, 'script.js'), js);
  fs.writeFileSync(path.join(siteDir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

  // ── 6. Commit + push to GitHub ──────────────────────────────────────────────
  log(`  → Committing to GitHub...`);
  // Set authenticated remote if GITHUB_TOKEN is available
  const ghToken = process.env.GITHUB_TOKEN;
  if (ghToken) {
    exec(`git remote set-url origin https://${ghToken}@github.com/ddeonmadeit/helix-web.git`);
  }
  exec(`git add sites/${finalSlug}/`);
  exec(`git commit -m "${finalSlug}: one-page site"`);
  exec(`git push -u origin ${BRANCH}`);

  // ── 7. rsync deploy to VPS ──────────────────────────────────────────────────
  log(`  → Deploying to VPS...`);
  execSync(
    `rsync -a --delete -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no" ` +
    `${siteDir}/ ${VPS}:${VPS_DEPLOY}/${finalSlug}/`,
    { encoding: 'utf8' }
  );
  // Remove brief/sources
  execSync(
    `ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${VPS} ` +
    `"rm -f ${VPS_DEPLOY}/${finalSlug}/brief.md ${VPS_DEPLOY}/${finalSlug}/images/SOURCES.md"`,
    { encoding: 'utf8' }
  );

  // ── 8. Verify 200 OK ────────────────────────────────────────────────────────
  const liveUrl = `${LIVE_BASE}/${finalSlug}/`;
  const verifyRes = await fetch(liveUrl, { method: 'HEAD' });
  if (verifyRes.status !== 200) throw new Error(`Verify failed: ${verifyRes.status} ${liveUrl}`);
  log(`  ✓ Live: ${liveUrl}`);

  return { finalSlug, liveUrl, photoCredit, accent_hex };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  // Check env vars
  if (!process.env.CLAUDE_API_KEY) { console.error('ERROR: CLAUDE_API_KEY not set'); process.exit(1); }
  if (!process.env.UNSPLASH_ACCESS_KEY) { console.error('ERROR: UNSPLASH_ACCESS_KEY not set'); process.exit(1); }

  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  // Sync leads
  const leads = syncLeads();
  const state = loadState();

  // Build queue
  const queue = buildQueue(leads, state);
  log(`Queue: ${queue.length} unbuilt leads (building up to ${BATCH_SIZE})`);

  if (DRY_RUN) {
    console.log('\nDRY RUN — first 20 in queue:');
    queue.slice(0, 20).forEach((l, i) =>
      console.log(`  ${i+1}. ${l.businessName} (${l.location}) → ${l.slug}`)
    );
    return;
  }

  if (!queue.length) { log('Nothing to build — all leads already have sites.'); return; }

  const batch = queue.slice(0, BATCH_SIZE);
  let built = 0, failed = 0;

  for (const lead of batch) {
    try {
      const result = await buildSite(lead, client);

      // Update state file
      const updatedState = loadState();
      updatedState[lead.phoneKey] = {
        slug: result.finalSlug,
        url: result.liveUrl,
        businessName: lead.businessName,
        builtAt: new Date().toISOString(),
      };
      saveState(updatedState);

      // Append to SMS queue
      appendToSmsQueue(lead.businessName, lead.phone, result.liveUrl);

      built++;
      log(`✓ [${built}/${batch.length}] ${lead.businessName} → ${result.liveUrl}`);
    } catch (err) {
      failed++;
      log(`✗ FAILED: ${lead.businessName} — ${err.message}`);
    }

    if (built + failed < batch.length) {
      log(`  Waiting ${DELAY_MS / 1000}s before next site...`);
      await sleep(DELAY_MS);
    }
  }

  log(`\nDone. Built: ${built} | Failed: ${failed}`);
  log(`SMS queue: ${SMS_QUEUE}`);
  log(`State file: ${STATE_FILE}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
