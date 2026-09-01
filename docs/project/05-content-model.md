# 05 — Content model

## Content modelling principle

Build page components against typed repository interfaces. In Phase 1, adapters read local data. In Phase 2, the adapter reads Directus. Components must not depend directly on filesystem or CMS response shapes.

All localizable text fields use `{ en: string, es: string, pt: string }`. If a translation is not approved yet, provide an explicit `TODO_TRANSLATION` value—not an invented translation.

## Core entities

| Entity | Required fields | Relationships |
| --- | --- | --- |
| Product category | id, slug, title, intro, heroMedia, order, SEO | products, technologies, applications |
| Product | id, categoryId, slug, name, summary, heroMedia, gallery, highlights, specifications, options, downloads, SEO, status | category, applications, resources, related products |
| Application | id, slug, title, overview, challenges, recommendedSolutions, heroMedia, SEO | products, resources |
| Resource | id, type, slug, title, excerpt, body, media, date, tags, relatedProducts, downloadableAsset, SEO, status | products/applications |
| Download asset | id, title, file, documentType, language, relatedItems, version, publishDate | resources/products |
| FAQ | id, question, answer, category, order, SEO index flag | support category |
| Event | id, title, dateStart, dateEnd, location, category, description, CTA, status | company |
| Career | id, title, department, location, employmentType, description, applyMethod, status | company |
| Form definition | id, purpose, title, intro, fields, consentText, successMessage, recipientPolicy | submissions |
| Form submission | id, formId, locale, values, consentAt, sourceUrl, submittedAt, status | form definition |
| AI prompt template | id, purpose, systemInstruction, inputSchema, allowedSources, outputRules, status | AI drafts |
| AI draft | id, purpose, locale, inputSnapshot, sourceReferences, output, reviewedBy, publish/send status | prompt template |

## Product detail structure

1. Breadcrumb and hero: series/model, introduction, primary CTA (`Talk to an engineer`) and secondary CTA (`Find a distributor`).
2. Key benefits / evidence cards.
3. Suitable applications and line context.
4. Technical specification table—only approved values.
5. Optional configurations / integrations.
6. Downloads and related products.
7. Bottom contact CTA.

## Form data contract (Phase 1 mock only)

Common fields: name, company, email, country/region, phone (optional unless business reason requires), inquiry type, message, consent checkbox, source page, locale.

Technical Matching adds: product/application, product format, line speed, package dimensions, contaminant concern, existing equipment, file uploads (deferred unless storage/security is approved).

Support adds: model, serial number, installation country, issue type, urgency, message. Never promise response times unless management has approved them.

## AI boundary

AI Blog and internal customer-communication tools create drafts only. They use only approved source items and fixed prompt templates. A human must edit/review before publishing, copying to email, or sending a message. They never automatically publish content, email customers, quote price, promise delivery, invent technical values, or claim certification. Public visitor AI chat is Phase 2.
