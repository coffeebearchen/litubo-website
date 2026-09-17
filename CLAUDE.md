# LITUBO Website — Claude Code Project Instructions

## Mission and boundaries

Build the new public website for **LITUBO — Food & Packaging Inspection Solutions**. It is an international industrial B2B lead-generation and content website, not an e-commerce store.

- Locale architecture: English (`en`), Spanish (`es`) and Portuguese (`pt`) are structured from Module 1. Only English is publicly enabled at the first launch; publish ES/PT only after their content is approved and complete. Chinese is not a public language.
- Do not invent product specifications, certifications, customer names, project results, service locations, personnel, or event details.
- Do not change the confirmed information architecture, navigation labels, visual direction, or stack without explicit approval.
- Do not deploy, change DNS, migrate the Wix site, send email, submit forms to a live CRM, push a remote repository, or expose credentials without explicit approval.
- Never put secrets in source files, commits, or documentation. Use ignored environment files and `.env.example` only.

## Source of truth

Read these files before coding, in this order:

1. `docs/project/01-technical-decision.md`
2. `docs/project/02-scope-and-acceptance.md`
3. `docs/project/03-routing-and-navigation.md`
4. `docs/project/04-design-system.md`
5. `docs/project/05-content-model.md`
6. `docs/project/06-module-plan.md`

The approved visual reference images are stored outside this repository during preparation. Their rules are distilled in `04-design-system.md`; do not approximate them with generic SaaS styling.

## Proposed stack (locked only after user confirmation)

- Nuxt 3 + Vue 3 + TypeScript, SSR/hybrid rendering enabled
- Nuxt i18n for `en` / `es` / `pt`; route-prefix strategy defined in routing document
- A minimal CMS is part of the first public release: product, media, resource/blog and form-submission management. Design components against a CMS-ready adapter.
- Node 22.22.2 (user-confirmed 2026-09-09 as this project's runtime standard; pinned in `.nvmrc` and `package.json` `engines`, and used by CI), Docker Compose and Nginx on the existing US Tencent Cloud server. Cloudflare Free sits in front for DNS, TLS, caching and basic protection; it is not a second application server.

## Project execution protocol

All LITUBO work follows `docs/project/PROJECT-EXECUTION-PROTOCOL.md` (lifecycle, authorization levels A0–A5, session bootstrap, STOP conditions, closeout, Git / GitHub / release layering). Templates: `docs/project/templates/MODULE-WORK-ORDER-TEMPLATE.md` and `docs/project/templates/MODULE-CLOSEOUT-TEMPLATE.md`.

- New sessions bootstrap from repository state (protocol §9), never from the previous conversation.
- Only one explicitly authorized module may be active; a roadmap "next candidate" is not an authorization.
- Within an authorized module, execute through validation, governance closeout and local commit without step-by-step confirmation. Then STOP.
- Push, merge and deploy each require separate explicit authorization.

## Release safety gates (mandatory for high-risk modules)

Any module that touches **Publish / Unpublish / Archive, Public Delivery, Sitemap / indexing, AI Apply, Locale Publication, Public Media, Permissions, Release or Production** must first read `docs/project/RELEASE-SAFETY-GATES.md`, name the touched gates (`RSG-xx`) and their required evidence in the opening report, prove every touched gate before closeout, and report Gate Results / Open Gates / P0 Violations (protocol §12.1). A work order can add evidence but never weaken a gate; a gate conflict → STOP.

## Working protocol

1. Work only on the module explicitly authorized by the user.
2. Inspect existing files and `git status` before editing. Preserve unrelated changes.
3. Implement the smallest complete change that satisfies the module acceptance criteria.
4. Run the validation the module type requires (protocol §12); code modules also follow the Module completion checklist below.
5. Report: changed files, result of each verification, known limitations, and the next proposed module.
6. A local Git commit is part of an authorized module's closeout (protocol §11). Never push without authorization.
7. Keep the governing principle visible in decisions: **framework before details; make the full flow work before optimizing; modular, upgradeable, flexible, and low rework.**

## Codex–Claude 完整施工单与模块闭环规则（固定）

1. Codex 每次发给 Claude 的任务，必须视为一份完整、自包含、可一次执行的 Markdown 施工单；
2. Claude 不得要求用户把同一施工单拆成多段复制，也不得要求用户自行判断哪些文字属于指令；
3. 固定模块流程：

   ```text
   一份施工单
   → Claude 自动完成代码、测试、构建与本地 commit
   → 只有确实需要时，用户登录一次
   → Claude 集中完成浏览器验收
   → Codex 给出一份完整的备份 / GitHub PUSH 指令
   ```

4. 除认证、权限或真实业务确认确有必要外，Claude 不得反复要求用户进行 F12、Cookie、逐页点击或重复登录；
5. Claude 必须先完成自动化验证，再一次性请求必要的用户登录或业务确认；
6. 模块完成后，Claude 必须输出完整报告并停止，等待 Codex 的下一份完整施工单；
7. GitHub push、部署、真实数据操作仍须以 Codex 的完整施工单为准。

## UX and responsive rules

- Desktop: `Products`, `Applications`, `Resources`, `Support`, and `Company` use the confirmed mega-menu patterns.
- Mobile: use a progressively disclosed accordion navigation; never squeeze the desktop mega menu into a narrow viewport.
- Treat 320px, 375px, 768px, 1024px, and 1440px as minimum verification widths. No horizontal overflow.
- Preserve accessible keyboard navigation, focus visibility, semantic headings, image alt text, and reduced-motion behavior.
- Avoid gradients, neon blue/purple, excessive animation, chat widgets, icon walls, rounded-card overload, and invented decorative sections.

## Content and SEO rules

- All page content goes through the models and translation keys; no duplicated hard-coded EN/ES/PT copy in Vue templates.
- Each public route needs an editable SEO title, description, canonical path, Open Graph image, and indexability setting.
- Downloads are direct in Phase 1; do not create a download gate. Do not create HubSpot submission, live newsletter subscription, public AI chat, automatic publication, automatic email, or outbound customer messaging until separately authorized.

---

## Mandatory Governing Charter Gate（Admin/CMS 任务强制前置）

**每次接到任何 Admin/CMS 相关代码任务（包括 `/admin/*` 页面、`server/api/admin/*` API、`components/admin/`、`types/product-cms.ts` 相关改动），Claude 必须：**

1. 首先阅读 `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md`（当前为 V1.1）；
2. 在开工报告中声明以下内容（缺少则不得开始修改代码）：
   ```text
   Framework version: Governing Charter V1.1（docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md）
   Relevant Charter sections: [本次相关章节 A/B/C/... 及 N/O]
   Relevant visual/logic master: [精确路径 + CONFIRMED/DRAFT/FD-001 状态]
   Current milestone: [当前处于 J-? 阶段；J-1.1 已完成，J-2 为下一步]
   Scope is aligned / conflict found: [对齐 / 冲突说明]
   Files explicitly excluded: [禁止暂存的文件]
   Data/API contract reference: [引用 Charter G.4 节对应合同；未审计则停止施工]
   Preserve / Refactor / New / Missing: [本模块在 Charter Section I 中的判定]
   Open Decision Gates check: [无阻塞本模块的未确认 Gate / 若有则列出 DG 编号并停止]
   Acceptance criteria: [含空态 / 错误态 / 无权限态 / 1440px + 375px 两个断点]
   ```
3. Claude 必须检查 Charter 是否存在 FD-001；若存在，ADM-02～08 与 Logic Master 01/02 可作为 `USER-CONFIRMED FOR IMPLEMENTATION` 施工依据，**不得要求用户再次确认同一批母版**；不得把此确认扩展成 AI、导入、真实数据或发布授权；
4. 若对应视觉母版既非 `CONFIRMED` 状态，也无 Charter 框架决定（如 FD-001）覆盖，**停止施工并报告**，不得自行设计或参照 DRAFT 图开始正式代码；
5. 若发现代码、文档、视觉母版或施工单之间存在矛盾，**停止施工并报告冲突**；
6. 不得把文案翻译误报为视觉母版落地；
7. 不得把全局 Media Library（`/admin/media`）当作产品专属 Media & Resources（ADM-04）；
8. 不得把尚未实现的 AI / Import 功能描述为已完成；
9. 没有用户明确宣布"框架变更 / 替换框架 / 修订 Governing Charter"，不得改变架构方向。

---

## New session handoff protocol (mandatory for every new conversation)

**Before touching any file, a new Claude session MUST:**

1. Read in this order:
   - `docs/project/CURRENT-STATE.md`
   - `docs/ADMIN-CMS-SPEC.md`
   - `docs/OPERATIONS-HANDBOOK.md`
2. Run and report these read-only commands:
   - `git status --short`
   - `git branch --show-current`
   - `git log -12 --oneline`
   - `git remote -v`
   - `docker compose ps`
3. If the live state contradicts `CURRENT-STATE.md`, stop and report — do not guess, do not patch silently.
4. The full recovery order, and what to do when no module is authorized, is in `PROJECT-EXECUTION-PROTOCOL.md` §9.

## Language rule

All work logs, progress updates, error explanations, plans, and final reports must be written in **Chinese (中文)**. The user reads Chinese; no English or Japanese translation is needed.

## Hard prohibitions (never do without explicit per-action authorization)

- `git push` or any remote deployment
- Force push or rewriting Git history
- Sending real emails, creating external App registrations, or using live API tokens
- Outputting, logging, or committing `.env` values, tokens, passwords, database connection strings, customer data, or uploaded media
- Dropping or renaming Directus collections or PostgreSQL tables
- Modifying production infrastructure, DNS, Docker networking, or firewall rules

## Directus schema / database change protocol

Before any Directus collection or field change:
1. Export a schema snapshot: `docker compose exec directus node cli.js schema snapshot /schema/<phase>-<name>.yaml` (written to `./directus/schema/`; the Directus 12 image has no `npx`)
2. Create a local database backup
3. Commit the snapshot file before applying changes

## Module completion checklist

Every code module must complete all of the following before a local commit (documentation / governance modules use the risk-based validation in `PROJECT-EXECUTION-PROTOCOL.md` §12):
- `npm run typecheck` (or `npx vue-tsc --noEmit`) — 0 errors
- `npm run lint` — 0 errors
- `npx nuxt build` — build passes
- Browser or API acceptance check at relevant breakpoints
- `docs/project/CURRENT-STATE.md` updated to reflect new state

GitHub push requires separate user authorization after the above checklist passes.

## GitHub Checkpoint Protocol (fixed, 2026-09-06)

A checkpoint is a remote backup — not an accepted, published, or deployable state.

1. Passing automated verification → exact local commit first, then checkpoint.
2. When user/Codex authorises → create or fast-forward the designated remote checkpoint branch (never force-push or delete).
3. `origin/master` updated only after: integration acceptance + user visual confirmation + Codex explicit authorisation.
4. Never force-push, delete branches, rewrite history, or modify the remote URL.
5. Checkpoint branches are never auto-deleted.
6. Every report must list separately: local HEAD · checkpoint branch hash · `origin/master` hash · whether they differ.
7. J-2 integration chain checkpoint branch: `backup/admin-cms-j2` (fixed; no duplicates).

---

## Canonical Admin/CMS Task Entry and Mandatory Build Order

**CLAUDE.md is the single operative task entry point for every Claude session.** `docs/project/09-claude-first-read-only-instruction.md` is preserved as historical context only; it is no longer an active instruction source or executable rule.

### Mandatory pre-work reading order (Admin/CMS tasks)

Before starting any Admin/CMS code or document task, read in this order:

1. `CLAUDE.md` — this file; sole operative entry point
2. `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md` — highest authority; governs boundaries, safety, and framework-change rules
3. `docs/project/ADMIN-CMS-IMPLEMENTATION-BLUEPRINT-V1.md` — complete system construction map; bound by Charter
4. `docs/project/ADMIN-CMS-VISUAL-DATA-CONFORMANCE-REGISTER-V1.md` — master-to-route-to-evidence execution register; confirms target route, shared shell, data/API contract, English scope, DoR and current status for each ADM module
5. `docs/project/CURRENT-STATE.md` — verified current progress, limitations, and active blockers
6. `docs/project/MASTER-ROADMAP.md` — milestone order; does not independently override Blueprint sequence
7. Relevant visual/logic master, Construction Pack, current code, types, APIs, and tests for the current module
8. The complete, current Codex work order (施工单) for the authorized module only

### Document authority hierarchy

| Document | Role |
|----------|------|
| Working tree, running services, Directus state, confirmed user decisions | Determines factual truth |
| Governing Charter V1.1 | Highest governance; controls all boundaries, safety, and framework-change rules |
| Implementation Blueprint V1 | Complete execution map; bound by Charter; defines modules, dependencies, AI/import gates, and construction sequence |
| Visual & Data Conformance Register V1 | Master-to-route-to-evidence contract; bound by Charter and Blueprint; records target route, shell, API, English, DoR, DoD and status per ADM module |
| CURRENT-STATE.md | Single source for verified progress and active blockers |
| MASTER-ROADMAP.md | Milestone tracking; does not independently alter Blueprint sequence |
| PROJECT-EXECUTION-PROTOCOL.md | Project-wide execution control: lifecycle, authorization levels, bootstrap, closeout, Git / release layering; bound by the Charter |
| CLAUDE.md | Sole operative task entry; reading navigation only; not a second constitution |

- If Implementation Blueprint conflicts with Governing Charter → Charter governs.
- If any document conflicts with working tree, running services, or Directus actual state → report the fact conflict; do not guess or silently patch.

### Prohibited autonomous actions (Admin/CMS)

Claude must never:

- Select the next module independently; every module requires a complete, self-contained Codex work order (施工单)
- Skip Blueprint pre-requisite dependencies because a page appears simple or nearby
- Mistake English copy, basic forms, or the global Media Library for complete Product Workspace deliverables
- Start AI Dossier (J-7), bulk Import (J-8), or public CMS cutover (J-10) before product-media-source-audit (J-3.5) and all J-4 through J-6e gates are complete
- Fill any unconfirmed Decision Gate with fabricated data, fake scores, fake percentages, or engineering guesses
- Start a new module without receiving a complete, self-contained Codex work order for that specific module

### Content Center execution contract

Before any Content Center work, read: the approved visuals in `docs/design-reference/approved/admin-cms-content-center-v1/`, the current Module Freeze (`docs/content-cms/CONTENT-CENTER-MODULE-FREEZE-V1.md`), the current Content Center Blueprint once it exists, `CURRENT-STATE.md`, and Git facts.

- Execution order: Approved Visual → Module Freeze → Blueprint → Implementation.
- The repository's current Admin shell and navigation override incidental shell details drawn in visuals.
- Content Center reuses the Media Library and the existing AI Source → Proposal → Human Review architecture.
- If the repository, CURRENT-STATE, a visual, the Freeze or the Blueprint conflict: STOP and report. Do not guess.
- Module closeout, record updates and the STOP rule follow `PROJECT-EXECUTION-PROTOCOL.md` §11.

### FD-003 reading tiers (Tier A / B / C)

`FD-003 — Context-Efficient Execution` (registered in `ADMIN-CMS-GOVERNING-CHARTER-V1.md`, effective 2026-09-06) sets three reading tiers so repeated reading cost does not grow with every small task. A tier only lowers how much must be *re-read* — it never lowers what must be *satisfied*. The applicable module's Gate, visual master, data/API contract, English-first rule, acceptance criteria, and stated no-touch scope apply in full at every tier.

- **Tier A** — a new module; a change to the framework, a master, a data/API contract, or a Gate; a new Claude session taking over a large module; or final acceptance before pushing `origin/master`. Read the full seven-step governing stack above.
- **Tier B** — a follow-up sub-task inside the same module. Read only: `CLAUDE.md`, `CURRENT-STATE.md`, the Blueprint/Register sections for that module, the applicable master, the current Codex work order, and the relevant code/API/types/tests.
- **Tier C** — a purely mechanical verification (re-running a check, confirming a diff). Read only the current work order, the affected files, the diff, and the test output.

A Codex work order may raise the tier a task must read at; it may never lower what Tier A would otherwise require. Every opening report below must state which tier applies and why, before any other field.

### FD-004 — risk-proportionate AI MVP delivery (navigation only)

For single-product AI MVP work, apply Charter `FD-004` (defined in full in `ADMIN-CMS-GOVERNING-CHARTER-V1.md` §D.2 — read it there, it is not restated here): prioritise the smallest reliable **Draft-only** workflow, classify every finding as **P0 / P1 / P2** before calling anything blocking, and do not expand non-blocking hardening into the current module.

This lowers nothing. The P0 safety boundaries stand in full — no cross-product mixing, no fabricated technical facts, no credential leakage, no write without explicit human Accept/Edit, no auto-publish, no unrecoverable data damage, no uncontrolled AI cost loop. FD-004 governs what counts as *blocking*, never what counts as *safe*.

### Mandatory opening report fields (Admin/CMS tasks)

Every Admin/CMS task opening report must declare all of the following before any code or file is modified:

```text
Reading tier (FD-003): [A / B / C — one-line reason]
Framework version: Governing Charter V1.1 (FD-001 + FD-002 + FD-003) + Implementation Blueprint V1
Engineering module ID: [PC-01 / PC-02 / PW-00 / PW-01…PW-06 / AI-01 / IMP-01 — never a bare ADM-xx]
Blueprint stage: J-?
Governing docs read: [list each file including Register]
Register row confirmed: [module ID — Implementation / Evidence / Acceptance status; DoR met: yes / blocked]
Source Asset ID(s): [VM1-* / P2-* from Register §4.4, each with its authority level]
  - PRIMARY asset(s): [exact path + viewport]
  - SUPPLEMENTARY asset(s): [exact path — may refine hierarchy/spacing only]
Target route: [exact Nuxt route confirmed in Register]
Current actual route: [exists / absent]
Shared shell: [Product Catalogue Shell or Product Workspace Shell — existing component or prerequisite work needed]
Pre-requisite dependencies met: [yes / blocked — specify which prior module is incomplete]
Applicable Charter Gate CH-DG-xx: [CH-DG-# + current status]
Applicable Blueprint Gate BP-DG-xx: [BP-DG-# + current status]
Data/API boundary: [relevant Blueprint Section 7 contract; preserve-first items listed]
English-first scope: [visible UI strings affected — cite Register §12.1 line numbers]
Desktop acceptance basis: [which Source Asset defines 1440px, or "no approved desktop contract"]
Mobile 375px acceptance basis: [which Source Asset defines 375px, or "BLOCKED — no approved
  mobile adaptation contract"; PW-01…PW-06 are blocked until Codex authorises one]
Acceptance criteria: [including empty / error / no-permission / 1440px + 375px breakpoints]
Safety gates touched: [RSG-xx from docs/project/RELEASE-SAFETY-GATES.md + required Golden / Negative evidence, or "none"]
Explicitly out of scope: [files and domains not touched this module]
```

Claude must not start code changes for any Admin/CMS module unless the Register row for that module confirms Definition of Ready (DoR). If the relevant Register row is missing or shows `IN_DISCOVERY` / `NOT_REVIEWED`, stop and report before writing code.

**Namespace rules (fixed by FD-002, 2026-09-06):**

- A work order that cites only a bare `ADM-xx` is **not actionable** — the number means different modules in `README_VISUAL_INDEX.md` and in the Blueprint. Stop and report rather than infer which is meant.
- Every code work order must name **both** the engineering module ID (Blueprint §6.1) **and** the Source Asset ID(s) (Register §4.4).
- A `SUPPLEMENTARY` asset may never be the sole basis for a change; it must accompany a `PRIMARY` asset or an approved written contract.
- A `FUTURE-REFERENCE` asset (`VM1-LOGIC01`, `VM1-LOGIC02`) never authorises implementation.
- Screenshots are acceptance evidence only, never a design source. Repository and Directus state prove existence only, never design direction.
- Charter gates are written `CH-DG-xx`; Blueprint gates `BP-DG-xx`. They are independent namespaces and neither may be inferred from the other.
