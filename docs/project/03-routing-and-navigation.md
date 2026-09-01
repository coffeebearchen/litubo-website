# 03 — Routing and navigation

## Locale rule

- English is canonical and unprefixed: `/products`.
- Spanish mirrors it under `/es`: `/es/products`; Portuguese under `/pt`: `/pt/products`.
- Slugs are stable identifiers. Translation must never silently change a link target.

## Primary routes

| Area | Route pattern | Template | Phase |
| --- | --- | --- | --- |
| Home | `/` | Home | 1 |
| Products | `/products` | Product overview | 1 |
| Product category | `/products/[category]` | Category/filter list | 1 |
| Product detail | `/products/[category]/[slug]` | Product detail | 1 |
| Applications | `/applications` | Application overview | 1 |
| Application detail | `/applications/[slug]` | Application detail | 1 |
| Contact | `/contact` | Contact form | 1 |
| Technical Matching | `/technical-matching` | Qualified inquiry | 1 |
| Find a distributor | `/find-a-distributor` | Distributor request | 1 |
| Resources | `/resources` | Resource hub: Insights, Case Studies, Downloads, Videos | 1 |
| Insight | `/resources/insights/[slug]` | Article | 2 |
| Case study | `/resources/case-studies/[slug]` | Case study | 2 |
| Downloads / videos | `/resources/downloads`, `/resources/videos` | Filterable lists | 2 |
| Support | `/support` | Support overview | 1 |
| Support request types | `/support/[request-type]` | Reusable service form | 1 |
| FAQ | `/support/faq` | FAQ | 1 |
| Send product for test | `/support/send-product-test` | Reusable service form | 1 |
| Spare parts | `/support/request-spare-parts` | Parts inquiry form | 1 |
| Company | `/company/about`, `/company/quality-manufacturing`, `/company/global-service`, `/company/become-a-partner` | Company content | 1 |
| Events | Reserved; no public route/menu entry in Phase 1 | List/detail | 2 |
| Careers | Reserved; no public route/menu entry in Phase 1 | List/detail | 2 |
| News | Reserved; no public route/menu entry in Phase 1 | List/detail | 2 |
| System | `/search`, `/privacy-policy`, `/terms-of-use`, `/sitemap`, catch-all | System pages | 1/2 |

## Header menu contract

`Products | Applications | Resources | Support | Company | Contact | EN / ES | Find a distributor`

- Desktop mega menus: Products, Applications, Resources, Support, Company only.
- Contact goes directly to `/contact`; Technical Matching is prominent on relevant CTAs.
- Find a distributor is the persistent outlined-orange CTA at the right.
- Mega-menu contents must match the approved taxonomy in the handoff snapshot. Do not add hidden pages to navigation.

## Reserved product/application slugs

Product categories: `x-ray-inspection`, `metal-detection`, `checkweighers`, `combination-inspection`, `conveyors-reject-systems`. `By Product` and `By Inspection Goal` are not primary application navigation; they may become contextual filters/cross-links later.

Applications: `packaged-food`, `bottled-canned-products`, `meat-seafood`, `frozen-food`, `bakery-snacks`, `nuts-seeds-dried-food`, `powder-granules`, `pharmaceutical-daily-chemical`.
