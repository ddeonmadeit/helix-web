# One-Page Website Designer

Save this as `CLAUDE.md` in the root of this repo. It loads on every Claude Code session start.

This session has one job: research a company, then build a complete, distinctive one-page website for them. No multi-page routing, no half-finished placeholder content, no AI-generated images.

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
3. Does every photo trace to a real source in `SOURCES.md`?
4. Does the palette actually relate to their logo?
5. Is there one moment of visual delight — confident hero composition, strong section transition, considered detail?
6. On mobile: does it read well, do CTAs work with thumbs, do animations stay subtle?
7. Did I invent any fact, service, credential, year, or testimonial?

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
