# 08 — Confirmed decisions

| ID | Decision | Status |
| --- | --- | --- |
| D-001 | Existing US Tencent Cloud server is the single application server. Cloudflare Free may sit in front for DNS, TLS, caching and basic protection. | Confirmed |
| D-002 | Applications uses eight industry pages: Packaged Food; Bottled & Canned Products; Meat & Seafood; Frozen Food; Bakery & Snacks; Nuts, Seeds & Dried Food; Powder & Granules; Pharmaceutical & Daily Chemical. | Confirmed |
| D-003 | Resources uses four categories: Insights, Case Studies, Downloads and Videos. Whitepapers are Insights; certificates are Downloads. | Confirmed |
| D-004 | Events, Careers and News are not public in Phase 1. | Confirmed |
| D-005 | Newsletter is visual-only in Phase 1; no active email collection. | Confirmed |
| D-006 | Whitepapers/downloads are direct and ungated in Phase 1. | Confirmed |
| D-007 | Spare parts is an inquiry process only. There is no cart, account, price or online payment in Phase 1 or planned Phase 2. | Confirmed |
| D-008 | All customer names, event dates, career entries, emails, response times, performance numbers and similar claims in reference artwork are design placeholders until verified. | Confirmed |
| D-009 | Locale structure is EN/ES/PT. English launches first; ES then PT only when fully translated and approved. | Confirmed |
| D-010 | Phase 1 CMS manages products, media/Hero, videos, resources/blogs and form submissions manually. Excel bulk import is later. | Confirmed |
| D-011 | Phase 1 AI creates human-reviewed Blog and internal customer-communication drafts only. No automatic publication, automatic outbound messages, model training or public AI chat. | Confirmed |
| D-012 | Support, FAQ and all support request types (Technical Support, Manual, Spare Parts, Service/Training, Send Product for Test) are Phase 1 public. All public support forms must be functional. | Confirmed |
| D-013 | Company pages About, Quality & Manufacturing, Global Service Capability, and Become a Partner are Phase 1 public. Events, Careers, and News remain hidden until Phase 2. | Confirmed |
| D-014 | Resource detail templates and routes (Insights, Case Studies, Downloads, Videos) are Phase 1; individual items publish only when real approved content exists. | Confirmed |
| D-015 | `/support/send-product-test` is an explicit Phase 1 route using the reusable support request form template. | Confirmed |
| D-016 | Display font: Source Serif 4. Body/navigation/form font: Inter. Both served via Google Fonts. | Confirmed |
| D-017 | Contact and Technical Matching forms submit to info@litubo.com. Spare Parts form submits to sales@litubo.com. | Confirmed |
| D-018 | Package manager: npm. | Confirmed |
| D-019 | CMS: Directus + PostgreSQL, locked. Phase 1 covers manual product, media, resource and form-submission management. Excel bulk import is Phase 2. | Confirmed |
| D-020 | Product fixtures used in Phase 1 development are explicitly marked DEMO / NOT FOR PUBLIC and must never appear in production builds. | Confirmed |
| D-021 | LITUBO AI production scope is single-product only. One Product Draft may use multiple explicitly associated source files. AI generation, review and Apply remain scoped to that same Draft. Multi-product AI UI, orchestration, queues and workflows are out of scope. Interfaces may remain naturally extensible only where this adds no additional implementation complexity. | Confirmed |
| D-022 | LITUBO AI follows a "Reusable Core, LITUBO First" architecture. Shared source intake, extraction, deduplication, provider dispatch, proposal lifecycle and human-review primitives should remain Target-neutral where this adds no additional implementation complexity. Business-specific schema, prompts, conflict handling and Apply mapping remain in each Target/adapter. LITUBO V1 delivery takes priority; no package extraction, plugin system, microservice, generic AI platform or future Target implementation is authorised by this decision. | Confirmed |
