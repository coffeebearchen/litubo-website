# 04 — Design system and visual implementation rules

## Brand tokens

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#FAF8F3` | Warm off-white global background |
| `--color-primary` | `#0F5C4B` | Industrial green: headings, dark panels, active navigation |
| `--color-primary-deep` | `#123C32` | Hero overlays / deep contrast |
| `--color-accent` | `#D06F1B` | Orange: CTA, arrow, active underline, key emphasis only |
| `--color-ink` | `#18332B` | Primary body text |
| `--color-line` | `#D9DDD6` | Quiet borders and dividers |
| `--radius-sm` | `4px` | Cards, form controls, buttons—small, technical corners |

Orange should stay below roughly 20% of visible composition. There are no purple, cyan/blue, neon effects, or multicolour gradients.

## Typography

- Display/headline: an elegant, restrained serif with strong readability (final webfont selected and licensed at initialization).
- Navigation, body, labels, data tables and forms: clean modern sans-serif.
- Hierarchy first: display headings are spacious and editorial; body content is compact, readable and never justified.
- Avoid huge text that forces a product image below the fold. Use fluid scales with sensible caps.

## Layout

- Large desktop container: 1280px maximum; content gutters use responsive tokens.
- Vertical rhythm uses 8px increments. Section spacing should feel generous, but compact on mobile.
- Wide image-led hero with deep-green overlay is a key home/product pattern; equipment and production-line imagery is real and dominant.
- Cards use white/warm-white planes, fine border, small radius, deliberate image crops, and simple arrows. Do not turn every item into a floating rounded shadow card.

## Components to build before pages

`SiteHeader`, `MegaMenu`, `MobileNav`, `SiteFooter`, `BaseButton`, `ArrowLink`, `SectionHeading`, `MediaCard`, `FeatureCard`, `CTABanner`, `FormField`, `SelectField`, `SearchField`, `FilterSidebar`, `Pagination`, `Accordion`, `Breadcrumb`, `LanguageSwitch`.

## Interaction

- Navigation open/close: short opacity/transform transitions only; no theatrical animation.
- Mega menu remains readable with pointer movement and closes on Escape/click outside; keyboard focus follows logical order.
- Honour `prefers-reduced-motion`.
- Do not use a chat popup, autoplay video, carousel merely to fill space, or text over busy photography without an accessible contrast overlay.

## Responsive implementation

- Desktop mega menus switch to mobile accordion navigation below the approved breakpoint (target 1024px; validate against actual header fit).
- At 320px: CTA text can wrap deliberately inside buttons, but the viewport must never overflow horizontally.
- Image cards may stack; tables must reflow to key-value blocks or horizontal scroll only when labelled accessibly.

