# One-Page Website Designer

One job: research a company, build a complete distinctive one-page site, commit and push. No placeholders without watermarks, no invented facts, no AI images.

---

## Batch queue — check this first on every startup

**If `QUEUE.md` exists in the repo root, process it automatically — no need to be told.**

1. Read `QUEUE.md` — it contains a numbered list of businesses with name, location, industry, phone, address
2. Build each site one by one using the full workflow below
3. After each commit + push, move to the next item
4. When the list is done, delete `QUEUE.md` and stop

Each lead line looks like:
```
1. **Business Name** · Location · Industry · 📞 +61... · 📍 Address · ⭐ rating
```

No Google Maps URL will be provided — use the business name + location + industry to infer services. Follow the full CLAUDE.md design system for each site. No invented facts.

To refresh the queue with new leads, run: `node generate-queue.js --count=20`

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
- **Image verification — one pass only.** After the curl block run `ls -lh` once. <15KB = failed download, replace it. <50KB = too small/low-res for a full-bleed hero — fall back to type-led (recipe in Phase 3). Read() up to 3 Unsplash images you're uncertain about. Never open known-good Maps or own-site photos.
- **Parallel curls use absolute paths.** `cd dir && curl -o a.jpg & curl -o b.jpg &` — the second `&`-backgrounded curl runs in the parent shell's CWD, not the `cd`'d one. Always pass full absolute `-o` paths.
- **Differentiate the accent.** Each new site gets its own colour — never reuse last week's. Pull from logo, real photo content (kitchen sage wall, rural sky, deck timber, brick warmth), or industry archetype.
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
4. Unsplash — industry-specific terms (`timber deck merbau`, `commercial kitchen interior`, `concrete pour`). Never generic ("happy team", "business meeting"). **Don't guess `images.unsplash.com/photo-<ID>` URLs** — new-format IDs (e.g. `NcFBGQBiRDo`) won't resolve. WebFetch the Unsplash photo page first, extract the real CDN URL from any `images.unsplash.com/photo-` URL in the page, then curl it.

Never hotlink. Never generate images. Never source from Google Image Search.

**The hero always has a photo.** When no real photo is available from sources 1–3, always source an industry Unsplash photo for the hero — choose a clean, minimal, professional shot that matches the business category. Use it clean (no watermark). Type-led is a last resort only when Unsplash also fails or returns wrong/unusable content.

**Stock photo rule:** Always list every Unsplash image in SOURCES.md and brief.md with the Unsplash URL and photographer noted. Never silently substitute stock for a real business photo without noting it.

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

**House template:** Jarrad's Gardening (`jarradsgardening.com.au`) is the canonical reference. Use it for structure, spacing, component patterns, and attitude. Every element below comes from that build.

**CSS architecture:**
- Container: `--maxw: 1280px; --px: clamp(20px, 5vw, 64px)` — apply to `.wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 var(--px) }`
- Colours: always CSS custom properties on `:root`. Use `color-mix(in srgb, var(--accent) 22%, transparent)` instead of hardcoded `rgba()` for opacity variants — it adapts automatically to theme changes
- Surface layers: `--bg` → `--s1` → `--s2` → `--card` (four steps of depth, each slightly lighter)
- `::selection { background: var(--accent); color: #0e1410 }` — always include
- Add a `.skip` skip-nav link for accessibility

**Type:** 2 fonts max. **Barlow Condensed** (700, uppercase) + **Inter** is the house default — not Bebas Neue. Swap to Cormorant Garamond + Inter only for luxury/heritage. Google Fonts only, `font-display: swap`.
- Display class: `.display { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: .01em; line-height: .95 }` — apply to all headings
- Section heading size: `clamp(38px, 6vw, 82px)` for section titles; `clamp(64px, 13vw, 170px)` for the hero h1
- Kicker/eyebrow: `inline-flex; gap: 14px; font-size: 11px; font-weight: 700; letter-spacing: .26em; text-transform: uppercase; color: var(--accent)` with a `<span class="rule">` (36px × 2px accent bar) as the first child

**Nav:**
- Fixed, `height: 64px`, `background: color-mix(in srgb, var(--bg) 88%, transparent)`, `backdrop-filter: blur(10px)`, `border-bottom: 1px solid var(--border)`
- Brand: business name only in Barlow Condensed 700 uppercase — **no initials monogram, no accent dot pill/mark.** Just `<span class="brand__name">Business Name</span>` inside the `.brand` anchor.
- Nav links: underline-slide animation — `::after { content:""; position:absolute; left:0; right:100%; bottom:0; height:1px; background:var(--accent); transition: right .3s }` → `:hover::after { right: 0 }`
- Nav CTA pill button: `border-radius: 999px; background: var(--accent); color: #0e1410; font-size: 12px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; padding: 10px 22px`

**Buttons — always pill-shaped:**
- `border-radius: 999px` on all buttons and the sticky mobile bar
- Primary: `background: var(--accent); color: #0e1410` (dark text on light accent) or `color: #fff` if accent is dark
- Ghost: `background: transparent; border: 1px solid var(--border2); color: var(--text)` → hover: `border-color: var(--accent); color: var(--accent)`
- Include arrow SVG icon that translates +4px on hover: `.btn:hover svg { transform: translateX(4px) }`
- `min-height: 48px; font-size: 12px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase`

**Hero:**
- `min-height: 100svh; display: flex; align-items: flex-end; padding-top: 64px` (nav height)
- Photo: `filter: var(--imgf)` where `--imgf: brightness(.78) saturate(.92)` dark / `brightness(.95) saturate(1)` light
- Veil: two-layer `--veil` — left-heavy horizontal fade + bottom-up gradient, both stored as a single custom property
- **Hero stats row** below copy: border-top separator, individual stats each with `border-right: 1px solid var(--border)`. Stat value in Barlow Condensed accent colour, label in 11px uppercase muted

**Services — list rows, not card grid:**
- `<ul>` with `border-top: 1px solid var(--border2)`, each `<li>` `border-bottom: 1px solid var(--border)`
- Row grid: `grid-template-columns: 72px 1fr auto` — faded number | text body | optional media thumbnail
- Large number: Barlow Condensed 700, `clamp(38px–46px)`, `color-mix(in srgb, var(--accent) 22%, transparent)`
- **Hover background slide**: `::before { position:absolute; top:0; left:-4px; right:100%; bottom:0; background:var(--s1); transition: right .45s cubic-bezier(.2,.7,.2,1) }` → `:hover::before { right: -4px }`
- Service thumbnail (right column): `aspect-ratio: 3/2; border-radius: 6px; overflow: hidden` with scale-up on row hover
- Hide thumbnail at `max-width: 760px`

**Process section:**
- 4-column grid with `border-left: 1px solid var(--border)` separators (first child has no border-left)
- Top accent bar: `::after { height: 2px; background: var(--accent); transform: scaleX(0); transform-origin: left }` → `:hover::after { transform: scaleX(1) }`
- Step number: Barlow Condensed 700, `38px`, accent colour

**CTA section:**
- Background `var(--s2)`, radial glow `::before` at `88% 8%`
- Contact form: underline-only inputs (`border: 0; border-bottom: 1px solid var(--border2)`), focus state changes border to accent
- 2-column grid form, `.wide` spans full width

**Mobile sticky bar:**
- Full-width pill: `border-radius: 999px; height: 52px; width: 100%; background: var(--accent)`
- `position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom))`
- `display: none` → `display: block` at `max-width: 720px`

**Animations:**
- Reveal: `opacity: 0; transform: translateY(16px)` → `.is-in { opacity: 1; transform: none }`, `transition: opacity .5s ease, transform .5s cubic-bezier(.2,.7,.2,1)`
- Stagger via `transition-delay` on nth-child, max ~.25s
- Always include `@media (prefers-reduced-motion: reduce)` reset block

**Dark/light theme:** Dark is default. Every colour in CSS custom properties on `:root`, override on `[data-theme="light"]`. Toggle in nav (sun/moon, 44×44 tap target), persist to `localStorage`, honour `prefers-color-scheme` only when no saved pref. Both themes pass WCAG AA. `<meta name="theme-color">` for each scheme.

**Sections (in order):**
1. **Hero** — real photo or strong type treatment, headline in their voice, one primary CTA (`tel:` for trades/services)
2. **Credibility** — real testimonials / Google rating / verifiable credentials only. Cut the section if nothing real exists. Never fabricate.
3. **Services** — 3–6 actual services, one specific sentence each, list-row treatment
4. **Process** — 3–5 real steps, numbered, scannable at a glance
5. **CTA + Footer** — phone + address, visually distinct, copyright + "Site by Helix"

**Hero sizing — always use these values:**
- `.hero` padding-top: `64px` (nav height). Bottom padding: `clamp(56px, 8vw, 100px)`
- Hero h1 font size: `clamp(64px, 13vw, 170px)` — Barlow Condensed 700
- Serif display variant (luxury): `clamp(3.5rem, 8vw, 6.5rem)` — Cormorant Garamond, slightly smaller for weight

**Type-led hero (no usable photo):** The dependable recipe — `.hero__bg` is `position: absolute; inset: 0; background: var(--bg)`. Add three layers:
1. `::before` — radial-gradient dot pattern at 5–7% accent, `background-size: 36px 36px`
2. `::after` — radial glow ~70vw, `top: 45%; left: 28%`, 12–15% accent → transparent at 65%
3. `.hero__ghost` — giant brand mark (initials, monogram, or category SVG outline) in Bebas Neue at `clamp(7rem, 22vw, 18rem)`, 3–4% accent, `position: absolute; right: -4%; top: 50%; transform: translateY(-50%); white-space: nowrap`

Trigger only when no real photo exists AND Unsplash sourcing also fails (wrong subject, <50KB download, or unusable content). Otherwise always use a photo hero — even clean stock.

**Buttons — always symmetrical, slightly rounded corners (`border-radius: 4px–6px`). Never use `clip-path` parallelogram styling** — it looks broken on screens and breaks the ghost button pairing. Primary button: solid accent fill, white text. Ghost button: transparent with `border: 1px solid`. Both `min-height: 48px`.

**Business type → treatment cheat sheet:**
- Trades / industrial / services → Barlow Condensed + Inter, ticker, pill buttons, service list-rows, hero stats
- Real estate / luxury / heritage → Cormorant Garamond + Inter, no ticker, thin 1px rules, generous whitespace, italic emphasis
- Hospitality / wellness → palette pulled from food/interior, mid-weight serif, photo-led
- Retail / antique / craft → muted earth tones, serif display, italic, smaller card grids

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

Fix anything that fails, then commit.

---

## Phase 4.5 — Mobile QA (mandatory, runs before every commit)

Every site must be fully optimised for mobile. Verify each item in CSS/HTML before committing — no extra tool calls, just read your own output mentally.

**Layout & overflow**
- [ ] No element wider than `100vw` — no fixed `px` widths that break at 320px
- [ ] `.wrap` uses `padding: 0 var(--px)` with `--px: clamp(20px, 5vw, 64px)` — never fixed side padding
- [ ] Hero never overflows horizontally — hero h1 uses `clamp(64px, 13vw, 170px)`, never bare `rem`/`px`
- [ ] `.hero` has `padding-top: 64px` (clears fixed nav)
- [ ] `.hero__btns` stacks to `flex-direction: column` at ≤ 540px; buttons go full-width
- [ ] Services grid, process grid, and CTA all reflow correctly at 375px

**Nav & action bar**
- [ ] `.nav__links` hidden at ≤ 720px (`display: none`)
- [ ] Mobile action bar present — `position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); border-radius: 999px`
- [ ] Action bar hidden on desktop (`display: none` → `display: block` at ≤ 720px)

**Touch & accessibility**
- [ ] All tap targets (buttons, nav links, CTA) use `min-height: 48px` or padding achieving ≥ 44px
- [ ] All phone numbers are `href="tel:..."` — never plain text
- [ ] Body font-size ≥ 16px (prevents iOS auto-zoom on input focus)
- [ ] Body copy ≥ 15px — readable without pinch-zoom

**Images & performance**
- [ ] Hero image `fetchpriority="high"`, no `loading="lazy"` on it
- [ ] All below-fold images have `loading="lazy"`
- [ ] Hero < 300KB; other images < 150KB
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1">` present

**Safe areas**
- [ ] Action bar uses `env(safe-area-inset-bottom)` for notch/home-bar devices
- [ ] No content clipped under iOS status bar

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
