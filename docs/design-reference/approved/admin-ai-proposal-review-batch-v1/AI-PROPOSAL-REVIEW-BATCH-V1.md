# AI Proposal Review — Batch Review V1

**Status:** Approved visual / interaction reference  
**Module:** PWS-AI-REVIEW-BATCH-01  
**Scope:** Single-product AI Proposal Review only

## Purpose

Improve review efficiency when AI generates many specification proposals for one product.

Target workflow:

`AI Proposal → Batch Review → Human handles exceptions → Apply accepted changes to Draft`

## Core interaction rules

- `Accept all safe` only accepts Pending items that are not marked `Review required` and have no conflict.
- `Review required` items must remain for explicit human review.
- Support row checkboxes plus `Accept selected` and `Reject selected`.
- Existing item-level `Accept / Reject / Edit` controls remain available.
- Batch actions only change the in-memory review state; they do not write product data.
- The only write action remains `Apply accepted changes to Draft`.
- Pending and Rejected items must never be written.
- No batch action may auto-publish or overwrite an existing Specification.

## Review statistics

Show live counts so the operator does not need to count rows manually:

- Total proposals
- Safe pending
- Review required
- Accepted
- Rejected

## Desktop — 1440px

Follow the approved desktop mockup:

- retain existing Product Workspace navigation;
- proposal summary near the top;
- compact batch toolbar;
- grouped specification rows;
- aligned checkboxes;
- `Review required` visibly distinct;
- final Apply action visually separate from review actions.

Do not redesign unrelated admin areas.

## Mobile — 375px

Follow the approved mobile mockup:

- grouped proposals use compact cards / accordion sections;
- checkboxes remain easy to operate;
- primary batch action remains prominent;
- secondary actions may use compact overflow treatment;
- no horizontal overflow;
- final Apply action remains separate from review-state actions.

## Safety boundary

The workflow remains:

`Select sources → Analyze → Review proposals → Apply to Draft`

AI must not automatically Accept, Apply, Publish, or overwrite real product data.

## Deferred manual Specification record

A user-authored manual Specification edit exists on TEST ONLY product 3. Its visible name appeared similar to `Node....ony...`.

Verification is explicitly deferred for now. In PWS-AI-REVIEW-BATCH-01:

- do not delete it;
- do not modify it;
- do not diagnose it;
- do not treat it as an AI defect;
- do not let it block Batch Review.

## Out of scope

This reference does not authorize:

- multi-product Batch AI;
- batch product import;
- PDF / Excel / OCR / Vision;
- automatic Accept;
- automatic Apply;
- automatic Publish;
- provider/model changes;
- token optimization;
- schema changes;
- deployment or production changes.
