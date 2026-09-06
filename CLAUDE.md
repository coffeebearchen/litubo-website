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
- Node 20 LTS, Docker Compose and Nginx on the existing US Tencent Cloud server. Cloudflare Free sits in front for DNS, TLS, caching and basic protection; it is not a second application server.

## Working protocol

1. Work only on the module explicitly authorized by the user.
2. Inspect existing files and `git status` before editing. Preserve unrelated changes.
3. Implement the smallest complete change that satisfies the module acceptance criteria.
4. Run lint, type-check, build, and relevant responsive browser checks.
5. Report: changed files, result of each verification, known limitations, and the next proposed module.
6. Make a local Git commit only when the module is accepted or the user explicitly requests it. Never push without authorization.
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

1. 首先阅读 `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md`；
2. 在开工报告中声明以下内容（缺少则不得开始修改代码）：
   ```text
   Framework version: Governing Charter V1
   Relevant Charter sections: [本次相关章节 A/B/C/...]
   Relevant visual/logic master: [精确路径 + CONFIRMED/DRAFT 状态]
   Current milestone: [当前处于 J-? 阶段]
   Scope is aligned / conflict found: [对齐 / 冲突说明]
   Files explicitly excluded: [禁止暂存的文件]
   ```
3. 若对应视觉母版状态不是 `CONFIRMED`，**停止施工并报告**，不得自行设计或参照 DRAFT 图开始正式代码；
4. 若发现代码、文档、视觉母版或施工单之间存在矛盾，**停止施工并报告冲突**；
5. 不得把文案翻译误报为视觉母版落地；
6. 不得把全局 Media Library（`/admin/media`）当作产品专属 Media & Resources（ADM-04）；
7. 不得把尚未实现的 AI / Import 功能描述为已完成；
8. 没有用户明确宣布"框架变更 / 替换框架 / 修订 Governing Charter"，不得改变架构方向。

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
1. Export a schema snapshot: `npx directus schema snapshot ./directus/schema/<phase>-<name>.yaml`
2. Create a local database backup
3. Commit the snapshot file before applying changes

## Module completion checklist

Every module must complete all of the following before a local commit:
- `npm run typecheck` (or `npx vue-tsc --noEmit`) — 0 errors
- `npm run lint` — 0 errors
- `npx nuxt build` — build passes
- Browser or API acceptance check at relevant breakpoints
- `docs/project/CURRENT-STATE.md` updated to reflect new state

GitHub push requires separate user authorization after the above checklist passes.
