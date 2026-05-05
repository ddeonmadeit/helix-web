# One-Page Website Designer

Save this as `CLAUDE.md` in the root of this repo. It loads on every Claude Code session start.

This session has one job: research a company, then build a complete, distinctive one-page website for them. No multi-page routing, no half-finished placeholder content, no AI-generated images.

## Speed &amp; efficiency — read this first

**Target: site committed and pushed in under 5 minutes. Use as few tokens as possible. Quality stays high.**

### Hard rules

- **Cap research at 2 web searches.** If the first two searches don't surface their own website / Facebook / Instagram, stop searching. The business is small or unindexed — proceed with what the user gave you. Don't run the same search with five variants.
- **One image-source query, then download.** Run a single Unsplash search returning a list of photo URLs, then `curl` 5–7 images **in one parallel `&amp;`/`wait` block.** Do not download images one at a time. Do not run an Unsplash query per service.
- **Don't verify images by Reading them back.** Trust Unsplash. If a photo turns out wrong, swap it on the next build, not this one.
- **Don't run `identify` / `ls` / `git status` / `pwd` to "check progress."** Those are token-burning no-ops. Run them only when their output changes a decision.
- **Don't recheck or re-Read your own writes.** Edit/Write would have errored if it failed.
- **Write the three files (`index.html`, `styles.css`, `script.js`) in one pass each.** No drafting. No revisit-to-tweak. Get it right the first time. Editing your own freshly-written file is a smell.
- **No mental-review essays.** Run Phase 5 silently. No paragraphs explaining what you checked.
- **Skip placeholder generation if the layout doesn't need that image slot.** A text-only service row beats a watermarked photo when no real photo exists.
- **Icons:** generate the manifest icons in **one** Pillow script, not one tool call per size.
- **TodoWrite is optional.** For a build that should take &lt; 5 min, the todo list itself costs more than it saves. Skip it unless the build is genuinely complex.
- **Final reply is the seven hand-off bullets only.** Nothing else. No walkthrough, no recap.

### What good looks like (rough budget)

| Step | Tool calls (max) |
|---|---|
| Research (find them, extract voice/contact) | 1–2 web searches, 0–1 web fetch |
| Image sourcing | 1 Unsplash search + 1 parallel curl block |
| Icons + manifest | 1 Pillow script + 1 Write |
| Site code | 3 Writes (HTML, CSS, JS) |
| Brief + SOURCES | 2 Writes |
| Commit + push | 1 Bash |
| **Total** | **~10–12 tool calls** |

If you're over 20 tool calls before the commit, you're meandering — stop and finish.

### Parallelise aggressively

Send these as a single message with multiple tool calls when they're independent:

- Initial searches (name + name+location at once)
- Image downloads (5–7 `curl` commands inside one Bash with `&amp;` and `wait`)
- The three site files (`index.html`, `styles.css`, `script.js` — three Write calls in one message)
- `brief.md` and `SOURCES.md` (two Writes in one message)

---

## Trigger

When the user provides company information in any form — a name, a name + location, a phone number, a name + short description — start the full workflow. No specific keyword required. This session is dedicated to one purpose.

If the input is genuinely ambiguous (single common word with no context), ask one clarifying question and stop. Otherwise, proceed.

---

## Phase 0 — Orient (silent, don't narrate)

1. Confirm the working directory is this repo.
2. Confirm `sites/` folder exists. If not, create it.
3. Confirm git status is clean. If not, stop and ask.
4. Load the `frontend-design` skill if available.

---

## Phase 1 — Research

The whole quality of the output comes from this phase. Spend real effort.

### Find them
- Web search the input as given. Then variations: `"[name]" [location]`, `"[name]" industry`, the phone number alone if provided.
- Identify their canonical presence: own website, Google Business profile, Facebook, Instagram, LinkedIn, industry directories.
- If they have an existing website, fetch homepage and any about/services/work pages. This is the richest source.

### Extract everything
Write to `tmp/brief-[slug].md`:
- Legal/trading name
- What they actually do (read their service list — don't summarize from the company name)
- Who their customers are
- Service area / geography
- Phone, email, ABN, physical address
- Years in business, founding story (only if stated, never invent)
- Verifiable credentials, licenses, memberships, awards
- Real testimonials with reviewer name + source
- **Voice and tone** — read how they actually write. The site copy must sound like them, not like a generic agency.

### Real photos only
Priority order. Stop at the first source yielding 5+ usable images:
1. **Their own website** — hero, gallery, project pages, about-page team shots
2. **Google Business profile** — owner-uploaded photos
3. **Their public Facebook / Instagram** — posts of work, premises, team
4. **Unsplash / Pexels** — industry-matched royalty-free fallback. Search specifically (`commercial kitchen interior`, `concrete pour close-up`, `solar panel install rooftop`), never generic ("business meeting", "happy team")

Hard rules:
- **Never generate images.** No DALL-E, Midjourney, SDXL, nano-banana, anything. If you reach for an image generation tool, stop.
- **Download every image** to `sites/[slug]/images/`. No hotlinking.
- **Log provenance** in `sites/[slug]/images/SOURCES.md`: filename, original URL, source type, credit.
- **Never source from random Google Image Search.** Only the four sources above.

### Placeholder fallback
If, after exhausting all four sources above, you still can't get a real image for a slot the design needs (hero, a specific service tile, a team shot), use a placeholder image with a **`PLACEHOLDER`** watermark stamped across it.

- Use an industry-appropriate Unsplash/Pexels image as the base, but overlay the word `PLACEHOLDER` in large semi-transparent capitals (centered, ~50% opacity, contrasting color) so anyone reviewing the build can see at a glance it's not real.
- Bake the watermark into the JPG (don't rely on a CSS overlay — it must travel with the file).
- Mark each placeholder in `SOURCES.md` with a `placeholder: true` flag and a one-line note explaining what real image should replace it.
- Track every placeholder in `brief.md` under a "Placeholders to replace" section so the deployer knows exactly what to swap before launch.
- **Never** silently use a stock image without the watermark when no real source exists. The reviewer must always be able to tell real from placeholder.

### Logo and palette
- Find their logo on their own site / Google profile / social headers. Download it.
- Extract 2–3 brand colors from the logo. If no logo exists, derive from their industry and brand maturity:
  - Heritage / craft → muted earth tones, warm neutrals
  - Tech / SaaS / modern services → high-contrast monochrome + one strong accent
  - Wellness / lifestyle → soft sage / sand / cream + one clear accent
  - Industrial / trades → confident dark + safety/utility accent
  - Hospitality / food → palette pulled directly from their cuisine or interior
- Never default to generic blue.

---

## Phase 2 — Slug and structure

- **Slug**: lowercase, dashes, drop legal suffixes (`Pty Ltd`, `Inc`, `LLC`) and punctuation. `Smith & Sons Concreting Pty Ltd` → `smith-and-sons-concreting`.
- **Collision**: if `sites/[slug]/` exists, append region (`smith-concreting-vic`), never a number suffix.
- **File layout**:
  ```
  sites/[slug]/
    index.html
    styles.css
    script.js          (only if needed for interactions)
    images/
      hero.jpg
      [...]
      logo.svg
      SOURCES.md
    brief.md           (move from tmp/ to here)
  ```

---

## Phase 3 — Design system

Lock these before writing markup. Don't drift from them while building.

### Reference: JFM Joinery (helixsolution.au/lp/jfm-joinery.html)

Use this site as the **house reference** for visual confidence, type, and editorial dark-mode craft. Don't clone it section-for-section, but borrow the vocabulary:

- **Dark-first layered surfaces.** Stack near-blacks rather than one flat colour: e.g. `--black #0a0a0a`, `--dark #111`, `--dark2 #181818`, `--card #1e1e1e`. One brand-warm accent on top (JFM uses amber `#e07b1a`).
- **Type contrast as the hero.** A strong condensed display (JFM uses Bebas Neue) against a clean grotesk body (Inter). Display in all-caps with wide letter-spacing (2–8px), body in sentence case. Hierarchy is visible from across the room.
- **Eyebrow rules.** A short 2px coloured rule (~36–40px) sits before every section kicker — small move, big rhythm.
- **Atmospheric imagery.** Photos are filtered down (`brightness(.7) saturate(.85)`) and overlaid with a left-heavy linear gradient on heroes — content stays legible, image stays moody.
- **Ghost numerals.** Oversized accent-coloured section/service numerals at low opacity (10–15%) give scannable hierarchy without shouting.
- **Quiet motion details.** Border-grow accents on hover (top or left rule animates from 0 to full), gentle image scale on hover (1.06×), an auto-scrolling accent ticker bar between sections.
- **Faceted CTA shape.** Buttons use a slight parallelogram `clip-path` for a fabricated/industrial feel. Use sparingly — once per site is enough.
- **Honest placeholder watermarks.** When a real photo is missing, JFM stamps a centred uppercase `PLACEHOLDER` with letter-spacing, semi-transparent white on a dark plate — the reviewer can never miss it. Match this treatment.

Take the *attitude* from JFM (confident, editorial, craft-forward, dark-first) and translate it through the company you're building for. A wellness studio shouldn't end up looking like a joinery — but it should still feel as considered.

### Theme: dark default + light toggle

Every site ships with **both a dark and a light theme**. Dark is the default.

- Drive every colour through CSS custom properties on `:root` (default dark) and override on `[data-theme="light"]`. Don't hard-code colours in component rules.
- Provide a small toggle in the nav (sun/moon icon, 44×44 tap target). Persist the choice in `localStorage` under a stable key (e.g. `theme`). On load, read it before first paint to avoid a flash of the wrong theme.
- Honour `prefers-color-scheme` only when the user hasn't picked one yet.
- Both themes must pass WCAG AA for every text/background pair. Test both, don't ship one and assume the other follows.
- Imagery filters and overlay strengths usually need to differ between themes — what reads as moody in dark may go muddy in light. Tune per theme.
- Add a `<meta name="theme-color">` for each scheme via `media="(prefers-color-scheme: dark)"` / `light` so the mobile URL bar tints correctly.

### Palette
- 2–3 primary colors max, plus near-black for text and off-white for surface.
- Pulled from the logo. Test every text/background pair against WCAG AA — don't eyeball.
- Gradients only if tasteful and intentional (subtle two-stop within the palette). Never default `from-purple-500 to-pink-500`.

### Typography
- Two fonts maximum.
- Hierarchy must be obvious: display headline ≥ 2× body size, weight contrast clear (e.g. 700 display vs 400 body).
- Pair with intent — not all sans/sans. Consider serif display + sans body for editorial feel. Sans display + serif body for inverted distinction.
- Match the company's positioning:
  - Heritage / craft → editorial serif display
  - Modern services / SaaS → geometric or grotesk sans
  - Lifestyle / wellness → humanist sans or transitional serif
  - Industrial → strong industrial sans
- Google Fonts only.

### Voice
Mirror how they actually write. Don't impose a house style. A 30-year family business and a six-month-old startup should produce visibly different copy.

### Layout principles
- **Aggressive whitespace.** Sections breathe. If it feels too sparse, it's probably right.
- **One idea per section.** No section does double duty.
- **Strong vertical rhythm.** Consistent spacing scale (e.g. 8 / 16 / 32 / 64 / 128px).
- **Asymmetry where it earns it.** Centered-everything is template-tier. Off-center hero compositions, two-column splits with deliberate weight differences, oversized type breaking grid — all welcome when intentional.

---

## Phase 4 — Build

One page. Single `index.html`. Smooth scroll between sections. Static — no framework, no build step. Runs on a 3G connection in regional anywhere.

### Required sections, in order

1. **Hero**
   - Strong headline naming what they do and who for, in their voice
   - Subheadline (one line) adding the specific
   - One primary CTA (phone for trades, "Book" for service businesses, "Get started" for SaaS-style — match their conversion model)
   - Real hero photo or strong typographic treatment
   - Logo top-left, single nav row if needed, `tel:` link visible on mobile

2. **Social proof / credibility**
   - Real testimonials (3 max, full quotes, reviewer name + source)
   - Or real client logos, certifications, press mentions, years-in-business stat
   - If no real material exists, cut this section. Never fabricate.

3. **Services or offering**
   - 3–6 cards or rows naming actual services from research
   - Each item gets one specific sentence. No buzzword soup.
   - Visual treatment: icons (consistent set), small photos, or strong typographic listing

4. **Feature breakdown or process**
   - Their actual process / approach / what makes the work different
   - 3–5 steps or features
   - Numbered or staged visually so the flow reads at a glance

5. **Visual section**
   - Image-or-graphic-led, minimal copy
   - Largest photo on the page, full-bleed or strong framing
   - One short caption / pull quote max

6. **Call to action**
   - Conversion-focused, single primary action
   - Phone + email + address as appropriate
   - Visually distinct from earlier sections (color inversion, full-bleed, larger type)
   - Footer below: ABN, copyright, "Site by Helix" small credit

### Mobile-first, app-like feel

These sites are built mobile-first and must feel like a native app on a phone, not a desktop site that's been scaled down. Most visitors arrive on mobile — design for that surface first, then let it scale up.

- **Design at 375px first.** Build the layout for a phone, then progressively enhance for larger screens. Don't design desktop-first and squash.
- **Single-thumb reach.** Primary CTAs sit in the lower two-thirds of the viewport on mobile. Phone numbers are `tel:` links and tappable. Tap targets ≥ 44×44px. No hover-only interactions.
- **Sticky bottom action bar** on mobile where it fits: phone / "Get a quote" / "Book" pinned to the bottom edge so the conversion path is always one tap away. Hide on desktop.
- **Native-feel transitions.** Section changes feel like a swipe between cards or a paged reveal — soft, fast, momentum-friendly. No jank, no full-page flashes.
- **Edge-to-edge imagery.** Full-bleed photos with no awkward gutters on the sides. Use `100vw` widths and `safe-area-inset-*` padding to respect notches and home indicators.
- **System type & clean spacing.** Type scale comfortable to read at arm's length (body ≥ 16px to avoid iOS zoom-on-focus). Generous touch padding. Clear sectional rhythm.
- **Smooth, momentum scrolling.** `-webkit-overflow-scrolling: touch` on any horizontally scrolling rails. Carousels snap (`scroll-snap-type`) and feel paged, not free-floating.
- **No horizontal overflow, ever.** Test at 320px wide. Long words break, large headlines reflow, images stay contained.
- **PWA basics.** Add a `<meta name="theme-color">` matching the palette so the URL bar tints. Provide an `apple-touch-icon` and a `manifest.webmanifest` with name, short_name, theme_color, background_color, and a 512px maskable icon. The site should be "Add to Home Screen"-ready.
- **Test the home-screen install.** Saved to a phone home screen, the site should open into a full-bleed view that looks like an app's first screen — clear name, hero, primary action.
- **Performance is mobile UX.** Hero must be visibly painted under 2.5s on a throttled mid-tier 4G connection. No layout shift after fonts load (use `font-display: swap` and tune line-height ahead of time).
- **Respect `prefers-reduced-motion`.** Disable scroll-driven animations and momentum reveals when the user has it set.

### Animation and interaction

- Smooth scroll between sections (CSS `scroll-behavior: smooth` is fine for static)
- Subtle entrance animations on scroll: fade-up + small Y-translate, staggered for grouped items, no longer than 600ms, only fires once
- Hover states on every interactive element — buttons get color/transform shift, cards get subtle lift or border shift
- Micro-interactions where they earn their place: nav link underline grow, icon shift on hover, CTA arrow slide
- **Restraint is the design.** If a section has three different animations fighting for attention, kill two.

### Performance and accessibility

- Inline critical CSS. Defer the rest.
- `loading="lazy"` on below-fold images. Compress before saving (hero <300KB, others <150KB).
- `srcset` on hero for retina.
- Real semantic HTML — `<button>`, `<a>`, `<header>`, `<main>`, `<section>`, `<footer>`. Headings in order.
- Alt text on every image. Visible focus states.
- `<title>` and meta description: name + main thing they do + main location. JSON-LD `LocalBusiness` schema with real NAP.

### Auto-rejects

- Lorem ipsum
- Stock photo of multi-ethnic team in suits at a laptop
- Made-up testimonials, awards, certifications, client counts, "as seen in"
- Centered-everything with no rhythm
- Default Tailwind blue
- Three competing gradients
- AI-generated imagery of any kind
- Any factual claim not traceable to research

---

## Phase 5 — Self-review

Before committing, ask:

1. Would I believe this is a real, considered website if I landed here from Google?
2. Is it bespoke to *this* company, or could the name be swapped for another?
3. Does every photo trace to a real source in `SOURCES.md`? Are any placeholders clearly watermarked and listed in `brief.md`?
4. Does the palette actually relate to their logo?
5. Is there one moment of visual delight — confident hero composition, strong section transition, considered detail?
6. **Mobile, hard test:** on a 375px viewport, does it feel app-like? Sticky primary action reachable by thumb, no horizontal overflow at 320px, hero paints fast, transitions feel soft, "Add to Home Screen" opens into a clean app-like first screen?
7. **Both themes:** does the site default to dark, toggle cleanly to light, persist the choice, pass AA in both, and avoid a flash of the wrong theme on load?
8. Did I invent any fact, service, credential, year, or testimonial?

Any "no" or any invented fact → fix before committing.

---

## Phase 6 — Commit and push

```bash
git add sites/[slug]/
git status                          # confirm only new files in the slug folder
git commit -m "[slug]: one-page site"
git push
```

Pushing matters: the deployer session pulls from this repo to go live.

---

## Phase 7 — Hand-off

Reply with exactly:
- Slug: `[slug]`
- Local preview: `sites/[slug]/index.html`
- Palette: 3 hex codes
- Photo sources: counts by type (e.g. "5 from their site, 2 from Google, 0 stock")
- One-line summary of the design choice

Nothing else. No walkthrough
