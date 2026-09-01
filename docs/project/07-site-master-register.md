# 07 — Site master register (Phase 1)

## Status key

- **Public**: build and publish in Phase 1 once verified content exists.
- **Hidden**: create no public menu/route in Phase 1; reserve for Phase 2.
- **Template only**: visual/template reference exists, but no public content is created yet.

| Area | Public route | Phase 1 status | Template / visual reference | CMS content type | Mobile rule |
| --- | --- | --- | --- | --- | --- |
| Home | `/` | Public | `01-home.png` | Home settings, featured resources | Stack editorial cards; preserve hero CTA hierarchy |
| Products overview | `/products` | Public | `02-products-overview.png` | Product categories, products | Filter becomes a compact drawer/accordion |
| Product category | `/products/[category]` | Public | `02-products-overview.png` | Product category, products | Single-column cards and collapsed filters |
| Product detail | `/products/[category]/[slug]` | Public with verified model only | `03-product-detail.png` | Product, media, downloads | Key facts stack; specification rows accordion/reflow |
| Applications overview | `/applications` | Public | `04-applications-overview.png` | Applications | Eight industry cards stack/reflow |
| Application detail | `/applications/[slug]` | Public | `05-application-detail.png` | Application, related products/resources | Two-column content becomes single stack |
| Resources | `/resources` | Public | `06-resources-overview.png` | Resources | Four categories, cards stack |
| Insight / whitepaper | `/resources/insights/[slug]` | Public when verified | `07-resource-detail.png`, `14-whitepaper-download.png` | Resource, download asset | Download form is absent in Phase 1; direct link only |
| Downloads | `/resources/downloads` | Public when assets exist | `06-resources-overview.png` | Download asset | Filters collapse |
| Videos | `/resources/videos` | Public when videos exist | `06-resources-overview.png` | Video (YouTube/external/file) | Responsive 16:9 embeds |
| Support | `/support` | Public | `08-support-overview.png` | Support content | Navigation becomes stacked actions |
| FAQ | `/support/faq` | Public | `10-faq.png` | FAQ | Accordions remain single column |
| Spare parts | `/support/request-spare-parts` | Public functional inquiry | `11-parts-and-test.png`, `15-order-parts.png` | Form, product model options | Single-column form; no cart/account/payment |
| Other support request | `/support/[request-type]` | Public only if receiving flow works | `09-service-request.png` | Form definition/submission | Single-column form |
| Contact | `/contact` | Public functional inquiry | `13-contact-distributor-matching.png` | Form | Single column |
| Technical Matching | `/technical-matching` | Public functional inquiry | `13-contact-distributor-matching.png` | Form | Single-column long form |
| Find a distributor | `/find-a-distributor` | Public functional inquiry | `13-contact-distributor-matching.png` | Form / distributor data | Single column |
| Company | `/company/about` and approved Company pages | Public | `12-company-about.png` | Company content | Content stack |
| Partner | `/company/become-a-partner` | Public functional inquiry | `12-company-about.png` | Form | Single column |
| Careers | Reserved | Hidden | `16-careers-list.png`, `17-career-detail.png` | Career | Template only |
| Events | Reserved | Hidden | `18-events.png` | Event | Template only |
| News | Reserved | Hidden | N/A | Resource | Template only |
| Newsletter | N/A | Visual-only footer copy | `01-home.png` | N/A | Link to Resources; no email input |

## Navigation decisions

- Applications is organized around the eight confirmed industries only. `By Product` / `By Inspection Goal` are not primary menu routes.
- Resources has four public categories: **Insights, Case Studies, Downloads, Videos**. Whitepapers live within Insights; product catalogues, brochures, datasheets and certificates live within Downloads.
- Incomplete routes never appear as a public dead link. A public form must submit successfully; a visual-only newsletter must not expose an inactive email input.
