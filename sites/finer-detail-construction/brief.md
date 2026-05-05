# Brief — Finer Detail Construction

## Inputs (provided directly)
- Trading name: **Finer Detail Construction**
- Service area: **Gold Coast & Brisbane**
- QBCC license: **15459659**
- Services: **Decks · Renovations · Internal Fitouts**
- Phone: **0435 036 499**
- Email: **Finerdetailconstruction@outlook.com**

## Verified online presence
- Instagram: [@finer_detail_construction](https://www.instagram.com/finer_detail_construction/) — 215 followers, 19 posts. QBCC number in bio matches the brief. Auth-gated, photos not directly downloadable.
- No standalone website indexed.
- No Facebook, Google Business profile, or LinkedIn surfaced in searches.

## Voice
A small QBCC-licensed builder. Confident but not corporate. Owner-operator energy — the company name itself ("finer detail") sets the positioning: a builder who sweats the small stuff. Copy should sound like a tradie who takes the work seriously, not a marketing agency.

## Positioning
Three clear service lines, all visible on every page of the site:
1. **Decks** — outdoor timber, the most photogenic conversion path for SE Queensland
2. **Renovations** — whole-home / extension / structural work
3. **Internal fitouts** — kitchens, joinery, built-in cabinetry

The "finer detail" angle separates them from volume builders — they're for clients who want the joinery to fit, the deck boards to align, the walls to be square.

## Design direction
- **Dark default** with **light theme toggle** (per the new CLAUDE.md house rule). Both themes pass AA, both store in localStorage.
- Vocabulary lifted from the JFM Joinery house reference: layered near-blacks, condensed display + grotesk body, eyebrow rules, ghost numerals, atmospheric image filters, an auto-scrolling accent ticker, faceted CTA shape.
- Translated for **construction** rather than joinery: heavier display weight, accent goes copper/burnt-amber (not pure orange — slightly dustier), photo selection leans contemporary residential rather than heritage workshop.
- **Typography**: Anton (heavy condensed display) + Inter (grotesk body). Distinct from JFM's Bebas while keeping the same vocabulary.
- **Mobile-first** — designed at 375px first. Sticky bottom action bar (Call · Quote) on mobile only. PWA basics so "Add to Home Screen" opens cleanly.

## Palette
Dark theme:
- `--bg`     `#0b0a09` (warm near-black)
- `--surface-1` `#141210`
- `--surface-2` `#1c1814`
- `--card`   `#241f1a`
- `--text`   `#efe7d9`
- `--muted`  `#8a8278`
- `--accent` `#c98952` (warm copper)
- `--border` `rgba(239, 231, 217, 0.08)`

Light theme:
- `--bg`     `#f6f1e8`
- `--surface-1` `#ede5d6`
- `--surface-2` `#e2d8c4`
- `--card`   `#ffffff`
- `--text`   `#161310`
- `--muted`  `#6b6258`
- `--accent` `#a8632a` (deeper copper for contrast on cream)
- `--border` `rgba(22, 19, 16, 0.10)`

## Conversion model
- Primary CTA: **Call 0435 036 499** (`tel:`)
- Secondary CTA: **Email** (`mailto:`)
- A short on-page form for non-urgent enquiries
- Sticky mobile action bar with Call + Email pinned

## Placeholders to replace
None. Every image slot is filled with a real, industry-matched photograph. If the business supplies their own project photography later, swap them in and update `images/SOURCES.md` accordingly.
