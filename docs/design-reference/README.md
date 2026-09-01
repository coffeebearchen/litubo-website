# Approved visual reference — how to use it

## Status and authority

`approved/` contains the LITUBO page and navigation artwork approved before development. It is the visual motherboard for implementation. The written project documents turn the artwork into reusable rules; neither may override the other without user approval.

The images can contain sample names, dates, case studies, quotes, events and parameters. Treat those as layout/copy-length examples unless the business has separately supplied and approved the facts.

## Design reference inventory

| File | Visual authority | Related route/template | Build module |
| --- | --- | --- | --- |
| `00-mega-menu.png` | Header normal state; all desktop mega-menu states | All pages | 1 |
| `01-home.png` | Home composition and Footer | `/` | 2 |
| `02-products-overview.png` | Products hero, filters, product cards | `/products` | 3 |
| `03-product-detail.png` | Product detail information hierarchy | `/products/[category]/[slug]` | 3 |
| `04-applications-overview.png` | Applications overview | `/applications` | 4 |
| `05-application-detail.png` | Application-detail variation | `/applications/[slug]` | 4 |
| `06-resources-overview.png` | Resources list / filters | `/resources` | 5 |
| `07-resource-detail.png` | Insight / article-detail variation | `/resources/insights/[slug]` | 5 |
| `08-support-overview.png` | Support navigation and service content | `/support` | 5 |
| `09-service-request.png` | Reusable service request form | `/support/[request-type]` | 5 |
| `10-faq.png` | FAQ structure | `/support/faq` | 5 |
| `11-parts-and-test.png` | Parts / sample-test request patterns | `/support/request-spare-parts`, `/support/send-product-test` | 5 |
| `12-company-about.png` | About/company template | `/company/about` | 6 |
| `13-contact-distributor-matching.png` | Contact, distributor and technical matching patterns | `/contact`, `/find-a-distributor`, `/technical-matching` | 4 |
| `14-whitepaper-download.png` | Ungated whitepaper layout reference; form is visual-only for Phase 1 | `/resources/insights/[slug]` | 5 |
| `15-order-parts.png` | Spare-parts inquiry layout; never e-commerce | `/support/request-spare-parts` | 5 |
| `16-careers-list.png` | Careers template, reserved and hidden in Phase 1 | `/company/careers` | 2 |
| `17-career-detail.png` | Career-detail template, reserved and hidden in Phase 1 | `/company/careers/[slug]` | 2 |
| `18-events.png` | Events template, reserved and hidden in Phase 1 | `/company/events` | 2 |

## Required visual checks per module

Before reporting a module complete, Claude must compare the local implementation against the relevant image at desktop and mobile sizes:

1. Header height, hierarchy, active state, CTA placement and mega-menu columns.
2. Section order, visible whitespace, content widths, image-to-copy balance and CTA hierarchy.
3. Colour, typography role, fine borders and orange accent restraint.
4. Mobile layout reflow; desktop menus become accordions rather than compressed panels.
5. No image-derived fake copy, logo duplication, browser frame, watermarks, or direct use of the reference screenshot as a web page.

## Relationship with written documents

| Question | Primary authority |
| --- | --- |
| Which page / URL / menu item exists? | `docs/project/03-routing-and-navigation.md` |
| What content fields and real data are required? | `docs/project/05-content-model.md` |
| How should it look and respond? | This folder plus `docs/project/04-design-system.md` |
| What is being built now and how is it accepted? | `docs/project/06-module-plan.md` and the active module instruction |

If a conflict is discovered (for example a screen shows a label not in the route document), stop and report the conflict instead of guessing.
