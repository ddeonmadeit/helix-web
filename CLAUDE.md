# One-Page Website Designer

One job: research a company, build a complete distinctive one-page site, commit and push. No placeholders without watermarks, no invented facts, no AI images.

---

## Speed rules — read first

**Budget: ~10–12 tool calls. Over 20 before commit = you're meandering — stop and finish.**

| Step | Tool calls |
|---|---|
| Research | 1–2 searches + 0–1 fetch (Maps: 1 Playwright run) |
| Images | 1 parallel curl block + 1 `ls -lh` size check |
| Icons + manifest | 1 Pillow script + 1 Write |
| Site files | 3 parallel Writes (html · css · js) |
| brief.md + SOURCES.md | 1 parallel Write block |
| Commit + push | 1 Bash |

### Hard rules

- **Parallel everything independent.** Searches together. Image curls in one `&`/`wait` block. Three site files in one message. `brief.md` + `SOURCES.md` together.
- **No progress checks.** No `ls`, `pwd`, `git status`, `identify` between steps — only when the output changes a decision.
- **Don't re-read your own writes.** Edit/Write errors on failure — trust it.
- **Write each site file once.** No draft-then-tweak. Editing a freshly-written file is a smell.
- **Image verification — one pass only.** After the curl block run `ls -lh` once. Replace any file under 15KB (failed download). Read() up to 3 Unsplash images you're uncertain about — better to catch wrong subjects now than rebuild later. Never open known-good Google Maps or own-site photos.
- **Icons in one Pillow script.** All sizes (192, 512, maskable-512, apple-touch-180) in one Python call.
- **No owner/personal names anywhere** on the site — copy, headings, CTAs, meta, JSON-LD. Use "Call us", "Get in touch", "Owner-operated".
- **Final reply is the five hand-off bullets only.** Nothing else.

---

## Trigger

Any company name / location / phone / description → start immediately. Single ambiguous word with no context → ask one question. Otherwise go.

---

## Phase 1 — Research

### Google Maps URLs (maps.app.goo.gl, share.google, goo.gl/maps)

Run the Playwright scraper **first** — it handles all redirect forms and the sandbox proxy:

```bash
node tools/fetch-gmaps.js "<url>"
```

Returns: name, phone, hours, rating, `photos[]` (lh3.googleusercontent.com, pre-upgraded to `w2000-h2000`). Writes full HTML to `/tmp/gmaps.html`.

- **Category from the `15s…` URL param** (e.g. `lawn_care_service`, `painter`) is the source of truth. A same-named website selling something different is a different business — ignore it.
- If Services tab empty, use category + About tab to infer services.
- Download scraper `photos[]` directly with `curl -L` — these are real owner photos, priority 2.
- **Logo scan — one Read() pass, no extra tool calls.** After downloading all `photos[]`, Read() each in a single parallel batch (max 4). Look for a logo or branded graphic for colour extraction. If found, use it for the palette; if not, move on — don't search further.

### All other inputs

Run two searches in parallel: `"[name]" [location]` and `"[name]" site:facebook.com OR site:instagram.com`. If they have a website, fetch the homepage (and /services or /about).

### Extract (never invent anything not stated)

Name · phone · address · services · hours · real testimonials/credentials · voice and tone.

### Photos — priority order, stop at 5 usable

1. Their own website
2. Google Maps owner photos (scraper output)
3. Public Facebook / Instagram
4. Unsplash — industry-specific terms (`timber deck merbau`, `commercial kitchen interior`, `concrete pour`). Never generic ("happy team", "business meeting").

Never hotlink. Never generate images. Never source from Google Image Search.

**Placeholder rule:** If a design slot needs a photo and none exists, download an industry Unsplash image and stamp `PLACEHOLDER` in large semi-transparent capitals using Pillow. List in SOURCES.md + brief.md. Never silently swap stock for real.

### Logo and palette

Find their logo on site / Google profile / social headers — download it. Extract 2–3 brand colours. If no logo:
- Trades/industrial → dark + utility/safety accent
- Heritage/craft → muted earth tones
- Wellness/lifestyle → sage, sand, cream + one accent
- Tech/SaaS → high-contrast mono + one accent
- Hospitality → pulled from their food or interior
- Never generic blue.

---

## Phase 2 — Slug + structure

Slug: lowercase-dashes, drop `Pty Ltd`/`Inc`/`LLC`/`& Co`. If slug exists, append region — never a number suffix.

```
sites/[slug]/
  index.html · styles.css · script.js
  images/  hero.jpg [...]  SOURCES.md
  brief.md
  manifest.webmanifest
```

---

## Phase 3 — Design

**House reference:** JFM Joinery (`helixsolution.au/lp/jfm-joinery.html`) — dark layered near-black surfaces, Bebas Neue display vs Inter body, eyebrow colour rules (2px accent bar before every section kicker), ghost numerals at 10% opacity, auto-scrolling accent ticker between sections, parallelogram `clip-path` on the primary CTA, `brightness(.7) saturate(.85)` on hero photos with a left-heavy gradient overlay. Translate the *attitude*, not the layout.

**Type:** 2 fonts max. Bebas Neue + Inter is the house default. Swap to a serif display only when the company's positioning clearly demands it (heritage brand, editorial). Google Fonts only. `font-display: swap`.

**Dark/light theme:** Dark is default. Every colour in CSS custom properties on `:root`, override on `[data-theme="light"]`. Toggle in nav (sun/moon, 44×44 tap target), persist to `localStorage`, honour `prefers-color-scheme` only when no saved pref. Both themes pass WCAG AA. `<meta name="theme-color">` for each scheme.

**Sections (in order):**
1. **Hero** — real photo or strong type treatment, headline in their voice, one primary CTA (`tel:` for trades/services)
2. **Credibility** — real testimonials / Google rating / verifiable credentials only. Cut the section if nothing real exists. Never fabricate.
3. **Services** — 3–6 actual services, one specific sentence each, consistent icon or photo treatment
4. **Process** — 3–5 real steps, numbered, scannable at a glance
5. **Visual** — full-bleed photo, one pull quote or short caption
6. **CTA + Footer** — phone + address, visually distinct (colour inversion or full-bleed), copyright + "Site by Helix"

**Hero sizing — always use these values:**
- `.hero` padding: `padding: 80px 0 92px` — the 80px top clears the fixed nav on all screen sizes and prevents content overflowing upward into it.
- Heading font size: `clamp(4rem, 9vw, 7rem)` — caps at 7rem (112px) on desktop so two-line headings never overflow the viewport height.
- Serif display variant (luxury): `clamp(3.5rem, 8vw, 6.5rem)` — slightly smaller to account for heavier weight.

**Mobile-first:** Design at 375px first. Sticky bottom call bar (hide on desktop). Tap targets ≥ 44px. `tel:` links. No horizontal overflow at 320px. `env(safe-area-inset-*)` padding for notches. Hero paints under 2.5s on mid-tier 4G (hero < 300KB, others < 150KB). `loading="lazy"` on below-fold images.

**Animation:** Fade-up on scroll (IntersectionObserver, ≤ 600ms, fires once, staggered children). Hover states on all interactive elements. Respect `prefers-reduced-motion`.

**Accessibility + SEO:** Semantic HTML (`header`, `main`, `section`, `footer`), headings in order, alt text on every image, visible focus states, JSON-LD `LocalBusiness` schema with real NAP, `<title>` and meta description: name + service + location.

**Auto-rejects:** Lorem ipsum · stock suits-at-laptop · invented testimonials, awards, credentials, client counts · centered-everything with no rhythm · generic blue · AI images · any invented fact · owner or personal names anywhere.

---

## Phase 4 — Build

Write `index.html`, `styles.css`, `script.js` as three parallel Write calls. Icons in one Pillow script. `brief.md` + `SOURCES.md` in one parallel Write block.

**Before committing — silent check (no prose output):**
- No invented facts, services, credentials, or testimonials
- No wrong or unverified images (caught in Phase 1 size check + spot reads)
- Both dark and light themes render correctly
- Sticky mobile bar present, no horizontal overflow

Fix anything that fails, then commit.

---

## Phase 5 — Commit + push

```bash
git add sites/[slug]/
git commit -m "[slug]: one-page site"
git push -u origin [branch]
```

Pushing matters — the deployer pulls from this repo to go live.

---

## Phase 6 — Hand-off

Reply with exactly:
- Slug: `[slug]`
- Local preview: `sites/[slug]/index.html`
- Palette: 3 hex codes
- Photo sources: counts by type (e.g. "1 Google Maps, 2 Unsplash stock")
- One-line design summary

Nothing else.
