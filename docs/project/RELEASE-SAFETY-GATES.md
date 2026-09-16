# LITUBO — Release Safety Gates

> **状态：** ACTIVE（`RELEASE-SAFETY-GATES-01`，TYPE C · A1 GOVERNANCE_DOCS，用户 / Controller 授权，2026-09-15；同日 Delta completion（Plan A）补齐；长期治理决定见 `08-decision-log.md` D-033）
> **地位：** **HARD SAFETY CONTRACT**（硬性安全合同）——不是参考、建议或最佳实践。
> **角色：** 全项目唯一 canonical 的公开安全红线与高风险模块证据合同。定义 Safe Autopilot 方法、P0 Safety Gate、配套硬性条款、Gate 矩阵、Golden Path E2E 合同与 Negative Safety Path 合同。
> **Runtime effect：** none。本文件不创建、不修改任何路由、API、权限、数据库、Directus、AI、媒体或发布行为，也不关闭任何现有 Gate。

---

## 0. 权威与适用范围

### 0.1 权威关系

- 受 `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md`（V1.1）约束；**不修改 Charter**。本文件把 Charter、Decision Log、Content Center Freeze / Blueprint、`PROJECT-EXECUTION-PROTOCOL.md` 中已经存在的公开安全边界，收拢为一份可逐项证明的清单。
- 与 Charter / Decision / Freeze / Blueprint / 施工单同时适用时，**以更严格者为准**。
- 本文件是 **HARD SAFETY CONTRACT**。Work Order、Blueprint 细化、implementation、runtime convenience（实现便利）与模块报告**都不得削弱**任何 Gate，也**不得降低** Gate 的标准或证据要求；只允许增加更严格的证据要求。
- **不得自行发明例外。** 本文件没有写明的例外就不存在；"这次先放宽""临时绕过""只是本地"都不构成例外。
- 若 Blueprint、implementation、Work Order 或 runtime 方案与任一 P0 Gate 冲突：**STOP · REPORT TO CONTROLLER · DO NOT WEAKEN THE GATE · DO NOT INVENT AN EXCEPTION**。
- 若本文件与 Charter / Blueprint 出现无法按职责边界解释的实质冲突：**STOP · REPORT · DO NOT GUESS**（协议 §3.7），不得自行削弱 Gate 或改变方向。
- 修改、放宽或删除 Gate，只能由用户 / Controller 明确授权的 TYPE C 治理模块进行（§9）。

### 0.2 何时必须读取（触发条件）

任何模块只要触及下列任一领域，就是**高风险模块**，开工前必须读取本文件并按 §7 执行：

| 领域 | 例子 |
|---|---|
| Publish / Unpublish / Archive / Restore | 发布端点、快照构建、生命周期迁移 |
| Public Delivery | `/api/cms/*`、公开页面、公开 DTO、公开列表 / 关系渲染 |
| Sitemap / Indexing | `sitemap.xml`、robots、canonical、hreflang、noindex、站内搜索 |
| AI Apply | 任何把 AI 建议写入数据的路径 |
| Locale Publication | 语言发布、`publishedLocales`、公开语言路由 |
| Public Media | `/api/cms/media/*`、`is_public`、归档状态、公开下载 |
| Permissions | admin 中间件、CSRF、`nuxt-server` 角色 / 字段 / 行权限、角色矩阵 |
| Release / Production | push、merge、deploy、生产环境变量、DNS、基础设施 |

只修改 Draft 编辑、Admin 视觉或纯文档、且不触及上表的模块，不是高风险模块；但其报告仍须声明 `Safety gates touched: none`。

### 0.3 状态词

| 词 | 含义 |
|---|---|
| `PROVEN` | 本模块用证据（测试 / 真实请求 / 数据核对）证明该 Gate 在其范围内成立 |
| `NOT_TOUCHED` | 本模块未触及该 Gate |
| `OPEN` | Gate 尚未被证明或存在已登记缺口；必须写明 owner 模块 |
| `NOT_YET_EXERCISED` | 对应能力尚不存在（例如尚无公开交付），无法、也不需要证明 |
| `VIOLATED` | 证据显示 Gate 被破坏 → P0 → STOP |

`PROVEN` 只对证据覆盖的范围有效。功能签收 ≠ Gate 关闭 ≠ 生产发布批准。

### 0.4 Safe Autopilot 方法（冻结，D-033）

| 角色 | 职责 |
|---|---|
| **Claude** | repository executor：在授权模块内读取、施工、验证、治理收口、本地 commit、输出证据报告 |
| **GPT / Codex** | controller + independent reviewer：编排、施工单、风险控制、独立审查 Claude 的报告与证据 |
| **User** | business decision · visual approval · inter-module authorization · release authorization（push / merge / deploy） |

```text
Within one explicitly authorized module:  AUTOPILOT
Between modules:                          HUMAN AUTHORIZATION REQUIRED

成功模块：implement → validate → governance closeout → local commit → evidence report → STOP
```

- 不得自行进入 Next Candidate；Roadmap / CURRENT-STATE 中的 Next Candidate 不是授权。
- 自动驾驶只减少模块内的逐步确认，不降低任何 Gate，也不提升授权等级（协议 §6、§8）。

---

## 1. 原则

1. **Fail closed。** 不确定是否公开 → 不公开；未知角色 / 字段 / 路径 → 拒绝；配置缺失 → 不暴露。
2. **一个公开资格判定。** 能被公开看到的每一种出口，都必须来自同一个资格合同（§3）。
3. **人工发布。** 公开状态只能由已认证管理员的明确发布动作改变。
4. **证据优先。** Gate 是否成立以可复现证据为准，不以代码意图、文档描述或"应该没问题"为准。
5. **分层发布。** 本地完成、远程备份、主干合并、生产部署是四个独立授权。
6. **比例原则不降低 P0。** FD-004 与"按业务体量施工"只决定工程投入，不降低本文件任何 P0。

---

## 2. P0 Safety Gates（冻结）

以下每一项的破坏都是 **P0 / Blocker**：当前模块必须 STOP，不得以 backlog、P2 或"之后修"处理。

### RSG-01 — Draft Never Public

- **规则：** Draft、working copy、未发布语言、AI 建议、审核 / readiness 状态、来源资料、内部备注、历史记录，永远不得出现在公开路由、公开 API 输出、sitemap、搜索或任何公开缓存中。
- **Content Center：** 公开读取只能读取已发布条目的 `published_snapshot`，经显式 allowlist 映射输出（Blueprint §29、§31）。编辑已发布内容只改 working copy，公开页面保持快照直到人工再次发布（Blueprint §8.2）。
- **Products：** 只有 `published` 进入公开 API、详情页与 sitemap（Charter G.1、E.5）；已发布内容的实质修改应经 Revision Draft，线上保留旧版本直至审核通过（Charter G.1）。
- **依据：** Charter E.5 / G.1 / H.2；Blueprint §8、§29、§31（P0 public isolation contract）；D-011；D-020。

### RSG-02 — Single Public Eligibility Contract

- **规则：** 公开详情路由 / API、公开列表、关系渲染、sitemap、robots / noindex、站内搜索与任何 feed，必须使用**同一个公开资格合同**（§3）。不得在不同出口分别手写不一致的过滤条件；任何出口比资格合同更宽，即为 P0。
- **依据：** Blueprint §21、§29、§30；Charter E.5、N.6（"SEO 字段、noindex、sitemap 三项一致"）。

### RSG-03 — Human-only Publish

- **规则：** Publish / Unpublish / Archive / Restore 只能由已认证 Administrator 在 Admin 中的明确人工动作触发，经 CSRF 与服务端状态机校验，携带 `expectedDraftRevision`（内容发布）。Save、AI、Apply、导入、定时任务、迁移脚本、测试脚本都不得触发发布。不做定时发布、批量发布（V1）。
- **依据：** Charter G.1 / G.5 / H.1 / H.3；Freeze §19；Blueprint §23、§25；D-011；D-031。

### RSG-04 — AI Applies to Draft Only

- **规则：** AI 只能生成建议；只有人工 Accept / Edit 后的条目经服务端校验写入**同一个 Draft**。AI 与 Apply 代码不得写 `published_snapshot`、`status`、发布字段，不得导入或调用发布处理器，不得删除 / 移动正式媒体。
- **依据：** Charter H.1 / H.2 / E.4；FD-004.2；D-021；D-031；Blueprint §18。

### RSG-05 — Locale Independent Publication, No Fallback

- **规则：** 每种语言独立发布。某语言 URL 只在该语言有自己的已发布快照、且该语言在 `runtimeConfig.public.publishedLocales` 中时才可公开；否则 404。**不得**在 `/es`、`/pt` URL 下回退显示英文内容。发布默认语言不会发布任何译文；非默认语言只能在默认语言已发布时发布。未在 `publishedLocales` 中的语言保持 noindex、无 canonical / hreflang。
- **依据：** D-009；Blueprint §15、§30、§31；Charter G.4（SEO / Locale，CH-DG-14）。

### RSG-06 — Public Media Eligibility

- **规则：** 任何公开输出的文件 URL（图片、下载、OG 图片）必须同时满足：`directus_files.is_public = true`、**未在 Media Library 归档**、所属关联已启用、角色允许公开（`source_document` 永不公开）。发布不会改变 `is_public`（那是 Media Library 的人工动作）。
- **依据：** D-023；Blueprint §11、§29、§31；Charter G.4（`enabled=false` 不出现在公开前台）。

### RSG-07 — Permissions Fail Closed

- **规则：** `/admin/*` 与 `/api/admin/*` 必须经 admin 认证中间件（Administrator 角色）；写操作必须经 CSRF 校验；浏览器永不获得通用 Directus 写权限；公开读取只用只读 `nuxt-server` 身份，且只获得公开所需的字段 / 行（Blueprint §26）；任何未明确授予的角色、字段、行、路径默认拒绝；Directus Admin（:8055）不对公网开放。
- **依据：** Charter E.2 / E.4 / G.5 / N.6；Blueprint §25、§26、§31；CLAUDE.md hard prohibitions。

### RSG-08 — Local / Review / Production Separation

- **规则：** 本地开发库、review 分支与生产环境严格分离。本地测试数据、TEST ONLY 记录、本地凭证与本地 schema 变更不得进入生产；生产环境不得用于测试；任何生产变更（部署、DNS、防火墙、Docker 网络、生产数据、生产环境变量）必须有独立 TYPE D 授权与 Release Review。
- **依据：** 协议 §4 TYPE D、§13；Charter L.4 / N.6；Blueprint J-11、BP-DG-15；D-020；CLAUDE.md。

### RSG-09 — Release Layering

- **规则：** `local commit ≠ push ≠ merge ≠ deploy`。每一层需要各自的明确授权；"继续 / 可以 / 做吧"不构成 push、merge 或 deploy 授权。不 force push、不删分支、不改写历史、不改 remote URL。
- **依据：** 协议 §6、§13；Charter L.3 / L.4；CLAUDE.md GitHub Checkpoint Protocol。

---

## 3. Public Eligibility Contract（RSG-02 细则）

资格合同是一个判定："这一条记录的这一种语言，现在能否被公众看到"。所有公开出口必须以它为唯一依据；sitemap / 搜索可以在它之上**再收窄**（例如 noindex 排除），但不得放宽。

### 3.1 Content Center（Blueprint §29–§31，由 CC-IMP-06 / CC-IMP-10 实现）

```text
eligible(item, locale) =
      item.status = 'published'
  AND item is not archived（status ≠ 'archived'，显式要求）
  AND requested locale row has its own published_snapshot（IS NOT NULL）
  AND requested locale ∈ runtimeConfig.public.publishedLocales
  AND contentTypes[item.content_type].publicEnabled = true
  AND (locale = default OR default locale is published)

public output      = allowlist(published_snapshot) only
sitemap / search   = eligible AND type sitemapEligible AND snapshot.noindex = false
files in output    = RSG-06
relations rendered = target itself eligible in the same locale（产品目标：product status = published）
archived / unpublished / restored-not-republished → not eligible
```

**noindex ≠ unpublished。** `noindex = true` 只影响 sitemap 与 indexing eligibility（robots noindex、sitemap / search 排除）；它不改变内容是否已发布，已发布且 noindex 的页面仍按资格合同正常解析。

### 3.2 Products（Charter E.5 / G.1，产品公开切换 J-10 前须统一）

```text
eligible(product, locale) =
      product.status = 'published'
  AND product category status = 'published'
  AND required locale fields present（Charter E.5 条件 4；ES / PT 受 CH-DG-14 / BP-DG-09 与 D-009 约束）
  AND not TEST ONLY（Charter G.5）

sitemap = eligible AND seo_noindex ≠ true
media   = linked row enabled AND RSG-06
```

### 3.3 统一要求

- 同一领域的详情、列表、关系与 sitemap 必须调用同一个资格判定（共享函数或共享查询构造器），或由等价性测试证明它们一致。
- 公开 BFF 失败返回 503，不以 404 伪装、不泄露内部错误（Charter E.5；Blueprint §29）。

---

## 3A. 配套硬性条款

### 3A.1 Public DTO Allowlist（RSG-01、RSG-07）

- Public BFF / public API 的每个响应必须经 **explicit allowlist mapping** 构造：逐字段列出允许输出的键。
- 禁止：直接返回 Directus 原始记录（raw record passthrough）；对 Directus 行做对象展开（object spread）；因新增字段而意外输出内部字段。
- 测试必须证明公开 payload 不包含：Draft-only 数据（working copy 字段）、AI Proposal、Sources / 来源文档、History / Revisions、内部 readiness / review 状态、admin 元数据、内部 Directus 字段（如 `user_created`、`draft_revision`、`last_change_kind`、路由不需要的内部 id）。
- 新增公开字段必须同时更新 allowlist 与对应测试。

### 3A.2 Sitemap Contract（RSG-02）

- Sitemap 只能使用 Public Eligibility semantics（§3）；在其上只可收窄（排除 noindex、非 sitemap-eligible 类型），不得放宽。
- 不得从所有内容行、所有语言行或 working copy 直接生成。
- Unpublish、Archive、Restore 后，条目通过同一判定自动移出 sitemap，不依赖人工清理。

### 3A.3 Search Contract（RSG-02、RSG-05）

- 若存在站内搜索、外部索引推送或 feed：不得索引 Draft、Archived、noindex、未发布语言、非 public 内容类型；资格判定同 §3。

### 3A.4 Related Rendering Contract（RSG-01、RSG-02）

- 后台关系可以引用 Draft 或未发布目标。
- 公开侧只能渲染本身符合 public eligibility 的目标：内容目标按 §3.1（同一语言），产品目标按 §3.2。不符合的目标不渲染，且不得泄露其标题、slug 或存在性。

### 3A.5 Readiness Contract（RSG-03）

- Readiness 是确定性的人工辅助检查清单，不是自动发布决定、AI 评分或百分比。Hard / Soft 规则引用 Content Center Blueprint §21，本文件不重新设计。
- Hard blocker 未通过 → Publish 必须由服务端拒绝（发布时服务端重新计算，不信任客户端结果）。
- Soft warning → 只提示，不得改变 public state。
- Readiness PASS ≠ Publish：全部通过仍必须由人工明确发布。

### 3A.6 Runtime Layout Changes Must Not Weaken Gates

- 颜色、按钮位置、卡片布局、移动端布局、区块顺序可以改变；UI 改动不得成为任何 Gate 的唯一实现，也不得改变 Gate 结果。
- 关键 Gate 必须由服务端、数据库约束、权限、公开查询与自动化测试保证。

### 3A.7 Frontend Is Not Security Authority

- hidden UI、disabled button、client validation **不能替代** server authorization、server validation、DB constraints、permissions、public query。
- UI 中被禁用或隐藏的每个危险动作，服务端都必须独立拒绝，并有伪造请求（crafted request）的测试或真实验证。

### 3A.8 Production Provisioning Contract（RSG-08）

- Directus YAML schema snapshot（`directus/schema/*.yaml`）**不包含** `content_item_locales_draft_revision_guard` 函数与 `content_item_locales_draft_revision_guard_trg` 触发器；它们只存在于已跟踪的 SQL 工件 `directus/schema/cc-imp-01-fix-01-revision-guard.sql`。Content Foundation 的数据库约束另有已跟踪 SQL 工件 `directus/schema/cc-imp-01-constraints.sql`。Content Center 生命周期并发 guard（`content_lifecycle_*` 函数与 `content_items_lifecycle_guard_trg`、`content_items_lifecycle_restore_guard_trg`、`content_item_locales_lifecycle_guard_trg`、`content_item_locales_lifecycle_marker_guard_trg`、`content_items_files_lifecycle_guard_trg`、`content_relations_lifecycle_guard_trg` 触发器）同样不在 YAML 快照中，只存在于已跟踪 SQL 工件 `directus/schema/cc-imp-07-fix-02-lifecycle-guard.sql`（CC-IMP-07 Review Fix 02；应用顺序：constraints → revision guard → lifecycle guard）。Directus 权限（roles / policies / permissions）同样不在 YAML 快照中；基线之外的权限只由已跟踪的权限工件提供（`directus/schema/directus-permissions-*.sql` 及其 `.verify.sql` / `.rollback.sql`，D-034），在上述 SQL 工件之后应用。
- 因此任何生产或新环境 provisioning 必须显式完成并留证：
  1. apply schema（Directus 快照）；
  2. apply tracked SQL（约束与 trigger / function），随后按顺序 apply 已跟踪的 Directus 权限工件并重启 Directus（D-034）；
  3. verify trigger / function 与约束实际存在；
  4. verify permissions（含 `nuxt-server` 最小字段 / 行权限，RSG-07）：运行每个权限工件的 `.verify.sql` 并留证；
  5. verify supported Node runtime（22.22.2，`.nvmrc` / `engines`）；
  6. verify dependencies（生产依赖安装；许可证 / CVE 审查按 Open Release Gates）；
  7. backup（变更前可恢复的备份）；
  8. rollback plan（书面回滚步骤）。
- Local schema success 不是 Production proof：本地通过的迁移、触发器或权限不得被推定已存在于生产。

---

## 4. Safety Gate Matrix

### 4.1 Gate Contract Matrix

| Gate | Risk | Must never happen | Required evidence | Primary modules |
|---|---|---|---|---|
| RSG-01 Draft Never Public | 未审核文字或内部资料公开 | Draft / working copy / 归档内容 / Proposal / Sources / History 出现在任何公开出口 | N-01～N-05、N-17；§3A.1 allowlist 测试；G-13 | CC-IMP-06、CC-IMP-10、FINAL-RELEASE-AUDIT |
| RSG-02 Single Public Eligibility Contract | 页面、sitemap、搜索规则漂移 | 任一公开出口使用比 §3 更宽或不同的判定 | 共享判定或等价性测试；N-01、N-03、N-04、N-16；G-14 | CC-IMP-10、FINAL-RELEASE-AUDIT |
| RSG-03 Human-only Publish | 自动或越权发布 | Save、AI、Apply、Readiness、脚本创建或更新发布快照 | N-06～N-08、N-13、N-14；readiness 服务端重算测试；G-11、G-12 | CC-IMP-06、CC-IMP-07、FINAL-RELEASE-AUDIT |
| RSG-04 AI Applies to Draft Only | AI 越过 Draft / Publish 边界 | AI 写快照或 status、调用发布、改变 sitemap / 权限 / 媒体公开性 | N-06、N-21～N-23；proposal binding 测试（Blueprint §18）；G-06～G-09 | CC-IMP-08、CC-IMP-09、FINAL-RELEASE-AUDIT |
| RSG-05 Locale Independent, No Fallback | 未审核译文公开或错语言内容 | 发布默认语言连带发布译文；缺失语言回退显示其他语言 | N-09、N-10、N-22；G-17 | CC-IMP-05（Locale / SEO foundation）、CC-IMP-06、CC-IMP-10、FINAL-RELEASE-AUDIT |
| RSG-06 Public Media Eligibility | 私有或已归档文件公开 | 公开输出 `is_public = false`、已归档、未启用或 `source_document` 文件；新链接已归档文件 | N-11、N-24；公开媒体代理归档检查测试 | CC-IMP-06、CC-IMP-10、FINAL-RELEASE-AUDIT |
| RSG-07 Permissions Fail Closed | 越权读写或字段泄露 | 未明确授权即可访问；公开身份可读 working copy 整表；前端隐藏代替服务端拒绝 | N-12～N-15、N-18；§3A.1、§3A.7 | CC-IMP-10、FINAL-RELEASE-AUDIT |
| RSG-08 Environment Separation | 本地结果被当作生产事实 | 本地 schema / trigger / 数据被推定已在生产；生产被用于测试 | §3A.8 provisioning 证据；Open Release Gates；N-17、N-18 | TYPE D Release、FINAL-RELEASE-AUDIT |
| RSG-09 Release Layering | 未授权 push / merge / deploy | 授权自动升级；把"继续"当作 push / deploy | N-19；报告分列 local HEAD / checkpoint / `origin/master` | 所有模块、FINAL-RELEASE-AUDIT |

### 4.2 Module Mapping

| 模块 | 触及 Gate | 要求 |
|---|---|---|
| CC-IMP-05 SEO & Locales | RSG-05 基础（语言行独立、无回退、服务端 slug 锁） | 已完成；Locale / SEO foundation only，不含公开发布 |
| CC-IMP-06 Preview, Readiness & Publish | RSG-01、RSG-02、RSG-03、RSG-05、RSG-06、RSG-07 | **MANDATORY GATES** |
| CC-IMP-07 Archive, Restore & History | RSG-01、RSG-03 | 按 §7 声明与取证 |
| CC-IMP-08 AI Source Intake / Target | RSG-04、RSG-06（归档来源排除） | **MANDATORY GATES** |
| CC-IMP-09 AI Proposal Review / Apply | RSG-03、RSG-04、RSG-05 | **MANDATORY GATES** |
| CC-IMP-10 Public Delivery & Sitemap | RSG-01、RSG-02、RSG-05、RSG-06、RSG-07 | **MANDATORY GATES** |
| FINAL-RELEASE-AUDIT | RSG-01～RSG-09 | **ALL GATES**；§5.5 真实 Golden Path |

### 4.3 当前事实与状态（仓库事实，2026-09-15）

"当前事实"只记录静态读取可证实的内容；未验证项写 OPEN，不推测。

| Gate | 当前事实 | 状态 | Owner / 证明时机 | 关闭所需证据 |
|---|---|---|---|---|
| RSG-01 Draft Never Public | Content（CC-IMP-10 / D-035）：公开详情、列表、Resources hub 与 sitemap 只经 `server/utils/contentPublic.ts` 读取 `published_snapshot`，显式 allowlist DTO；Draft / 归档 / 无快照 / News / 非 Phase-1 类型均 404；working copy、Proposal、Sources、History、内部 id 不进入公开载荷（单元测试 + 真实 Golden Path：Archive → 404、Unpublish → 404）。Products：公开详情 / 列表 / sitemap 均过滤 `status = published`。已发布产品的直接修改风险已由 FINAL-RELEASE-FIX-F（D-037）在 V1 范围内关闭：只有 `draft` 可写业务数据，`review` / `published` / `archived` 一律只读，全部 26 个产品业务写入面（含旧编辑器与 Product Workspace 两套 UI 共用的服务端路由）经同一个 `assertProductDraftForMutation` 守卫，非 Draft 一律 409 且零写入；状态迁移与内容修改被强制拆成两个请求，状态迁移只写 `status` 与服务端派生的 `published_at`。V1 仍**没有** Published Snapshot / Revision Draft：要改已发布产品必须先退回 Draft（期间该产品从公开输出消失），完整快照架构按 D-037 (3) 延后。公开页面模板（FINAL-RELEASE-FIX-D）：Quality & Manufacturing 页的内部施工说明（"supply certificate scans or official badge artwork"）与未经业务确认的认证 / 合规、设施、流程陈述已移除（静态测试 + 1440 / 375 实页检查）；About、Global Service 与首页 FAQ 预告的未经业务确认陈述已按用户冻结的 V1 保守定位清理（PUBLIC-CLAIMS-CLEANUP-01 / D-036）：公司定位、地域覆盖、分销与服务网络、全系列产品与合规能力声明全部移除或改为询盘语言；首页 FAQ 预告改为只显示真实已发布 FAQ，无则整块不渲染；Applications 详情页（DEMO fixture）全部 404 | Content：`PROVEN`（CC-IMP-10 本地范围）；Products：`OPEN`（既有缺口，阻塞产品 CMS 公开切换 / 生产发布） | Content：FINAL-RELEASE-AUDIT 复核；Products：产品发布工作流模块（J-6e / J-10） | 产品修订草稿或经确认的替代合同 |
| RSG-02 Single Public Eligibility Contract | Content：单一判定 `resolvePublicEligibility`（published、未归档、站点发布语言的快照、Phase-1 公开类型、快照类型 / 语言 / slug 一致）由详情、列表、hub 与 sitemap 共用，并有与 D-034 权限工件的等价性测试。Products：`server/api/cms/products/[category]/[slug].get.ts`、`[category].get.ts`、`server/utils/sitemap.ts` 与 `server/utils/contentPublic.ts`（Content 的 related products）各自手写 `status = published` + 已发布分类过滤（sitemap 另排除 `seo_noindex = true`）；FINAL-RELEASE-FIX-F 按施工单 §17 选项 B 保留四处查询并补上等价性测试（`tests/productV1LifecycleSafety.test.ts`）：四个公开出口必须同时带 published 产品条件与已发布分类查询，sitemap 只可再收窄不可放宽，且四者都不得出现 draft / review / archived 或 `status[_neq]`。无公开站内搜索端点。公开错误语义（FINAL-RELEASE-FIX-C）：Products 页面与遗留 Technical Guide 详情页经共享 `utils/publicRoute.ts` 的 `publicPageStatus` 映射——API 404 / 4xx → 页面 404，API 5xx 或上游不可达 → 页面 503，无数据 → 404；产品详情 API 的全部查询（分类、产品、媒体、规格组 / 项、FAQ、区块 / 区块项）与分类产品列表失败均为 503，不再以 404 或空 200 掩盖故障（测试 + 一次 Directus 停机的真实 HTTP） | Content：`PROVEN`（CC-IMP-10 本地范围）；Products：`OPEN` | 产品公开切换模块（产品）；FINAL-RELEASE-AUDIT | 产品共享资格判定或等价性测试；N-01、N-03、N-04、N-16 |
| RSG-03 Human-only Publish | 产品状态迁移表（draft → review、review → draft \| published、published → draft；archived 经 API 既不可达也不可离开）自 FINAL-RELEASE-FIX-F 起只有一份定义（`server/utils/productLifecycle.ts`），由 PATCH 路由、发布面板与测试共读；状态迁移必须单独成请求，不得与业务字段同批提交，发布仍只由已认证管理员的显式动作触发。Content Center 无发布端点（CC-IMP-01～05 路由面测试断言无 publish / archive / restore 路由） | Products：`OPEN`（尚未按本文件取证）；Content：`NOT_YET_EXERCISED` | CC-IMP-06、CC-IMP-07 | N-06～N-08、N-13；AI / Apply 模块不导入发布处理器的测试 |
| RSG-04 AI Applies to Draft Only | 单产品 AI V1 已签收：Apply 只写同一产品 Draft，非 Draft 产品服务端拒绝（Charter H.1、CURRENT-STATE）。该债务已由 FINAL-RELEASE-FIX-F（D-037 (6)(7)(8)）关闭：Apply 请求只能指名"接受了哪一条提案条目"与接受时的值，写入目标与 add / update 的判定全部由服务端依据自己持有的 proposal 与产品现状推导；提案中不存在的条目、重复条目、歧义目标一律整批 409 零写入；提案绑定的来源在写入前重新解析（被移除、禁用或在 Media Library 归档者拒绝整批），并在第一笔写入前再次复查 Draft 状态；Generate 亦在任何 provider 调用之前拒绝非 Draft 产品。原子性属既有架构限制（仓库无数据库驱动与事务设施，一批 Apply 最多 200 次独立 REST 写），V1 不伪装事务，改为生产默认 fail-closed 关闭 Apply（`PRODUCT_AI_APPLY_ENABLED` 非密钥布尔，缺省即关闭）。Content AI 未建。FINAL-RELEASE-LIVE-SOURCE-PREP-01：valid TEST ONLY source_document prepared for live validation（`content_items_files` id 1042，item 6 / `LT180C-test-general.txt`，`text/plain`，enabled，未归档，`is_public = false`）——仅为后续 live validation 准备来源，**Analyze 未执行、Proposal 未生成、Apply 未执行、revision / activity / History 的 AI 链路未验证**，真实 provider 调用 0。FINAL-RELEASE-LIVE-VALIDATION-01-R2：R2 reached SourceRef validation but stopped before Provider invocation; expiry is the leading inference, not directly proven, because `resolveSourceRef` intentionally collapses expiry, malformed/tampered, admin mismatch and subject mismatch into the same null result; no proposal or Apply occurred——Analyze 点击 1 次，服务端在 `server/utils/aiContentIntake.ts:457` 返回 `SELECTION_INVALID_ERROR`（HTTP 200，响应体 `fileResults: []`），该 return 位于 `claimGenerateSlot`（:459）与 `runSubjectProposalEngine`（:477）**之前**，provider dispatch 从未到达；DeepSeek 0 / OpenAI 0，用户授权的 1 次真实调用**仍未消耗**；Proposal `null`、Apply 未执行、`draft_revision` 仍为 9、`last_change_kind` 仍为 `manual_edit`、`published_snapshot` 仍为 NULL。因此 Content AI Golden Path **仍未证明** | Products：已有签收证据（Draft-only 范围）；Content：`NOT_YET_EXERCISED` | CC-IMP-08、CC-IMP-09 | N-06；proposal binding 测试（Blueprint §18）；Apply 不改 status / snapshot |
| RSG-05 Locale Independent, No Fallback | `publishedLocales = ['en']`；Content 公开：只有英文，`/es`、`/pt` 内容 URL 与 `?locale=es` API 均 404，无语言回退、无旧 posts 回退（测试 + 真实 HTTP）；Products 公开页（`/products`、分类、详情）与遗留 posts 页（Technical Guide 详情、FAQ）（FINAL-RELEASE-FIX-C）：页面取数前调用 `assertPublishedLocale()`，不在 `publishedLocales` 的语言一律 404；发布语言只显示该语言文本，详情缺该语言名称 / 标题时 404，FAQ 与 Resources hub 只列出有该语言文本的遗留条目，`field[locale] \|\| field.en` 回退已移除（测试含静态检查 + 真实 HTTP：`/es`、`/pt` 的产品根 / 分类 / 详情、Technical Guide、FAQ 均 404）；`/es`、`/pt` 页面 noindex、无 canonical / hreflang（Blueprint §3）；遗留 `site_content` `home.hero` 经 i18n 回退读取（Blueprint §4，非 Content Center 发布） | Content public：`PROVEN`（CC-IMP-10 本地范围）；Products / 遗留 posts 公开页：`PROVEN`（FINAL-RELEASE-FIX-C 本地范围）；遗留回退（首页 `home.hero`）：`OPEN`（ES / PT 公开启用前须复核） | ES / PT 启用模块；FINAL-RELEASE-AUDIT | 遗留回退复核结论 |
| RSG-06 Public Media Eligibility | `server/api/cms/media/[id].get.ts`：文件须存在、`is_public = true` 且未在 Media Library 归档，否则 404；上游失败 503（CC-IMP-10）。Content 公开载荷只输出公开且未归档的 hero / OG / inline / download 文件；产品公开读取过滤 `products_files.enabled = true`；Content Center 在链接时拒绝归档文件。FINAL-RELEASE-LIVE-SOURCE-PREP-01（本地实测）：新增的 source_document 关联（`content_items_files` id 1042）所指文件 `is_public = false` 且未在 Media Library 归档；`content_items_files` 对 `nuxt-server` 与 Directus public policy 零权限（D-034 工件 `directus-permissions-01-nuxt-server-content-read.sql` 同时将其列入 `forbidden_collections` 与 `public_denied_collections`）；写入后公开详情 404、Resources hub 404、`sitemap.xml` 既不含该条目 slug 也不含该文件 | Content + 媒体代理：`PROVEN`（CC-IMP-10 本地范围）；产品公开切换前复核 | 产品公开切换模块；FINAL-RELEASE-AUDIT | 产品侧 N-11 复核 |
| RSG-07 Permissions Fail Closed | `server/middleware/admin-auth.ts`：Administrator 角色 + 写操作 CSRF Origin 校验。Content 公开读取只用 `nuxt-server`，其 Content 行 / 字段权限由已跟踪工件提供（D-034，verify OK），Directus public policy Content 权限 0；CC-IMP-10 未扩大任何权限。既有 17 行 `nuxt-server` 遗留权限（products、product_categories、products_files、product_faqs、product_sections、product_section_items、product_spec_groups、product_spec_items、posts、site_content、site_settings、site_social_links、directus_files、inquiries、product_page_presets）已由 FINAL-RELEASE-FIX-E（P1-09）纳入已跟踪工件 `directus/schema/directus-permissions-02-nuxt-server-legacy-site.sql`（配套 `.verify.sql` / `.rollback.sql`，D-034 机制；按名称解析角色 / 策略、无硬编码 UUID、幂等、fail closed），并按公开 server 代码的真实请求面收紧：8 处 `fields=*` 全部消除；6 张 Product 子表由 `filter={}` 改为「父产品 status=published 且 enabled=true」（两级子表另含父 section / spec group enabled），draft 产品的子行不再可读；posts 行过滤加上 `content_type IN (technical_guide, faq)`（D-035 (3)）；`directus_files` 去掉 `filename_disk` / `filesize` / `width` / `height`；无任何公开调用者的 `product_page_presets` 权限撤销。`inquiries` 的 create / read / update 字段本就最小（30 / `id` / 4 个 hubspot_*），但该集合无 `user_created` 等列，不改 schema 无法可靠限定行范围，登记为 P2 residual。公开询盘写入（FINAL-RELEASE-FIX-A，修复 FINAL-RELEASE-AUDIT-01 P0-01）：`/api/inquiries` 与遗留适配端点 `/api/contact`、`/api/support-request`、`/api/spare-parts` 共用 `server/utils/publicInquiry.ts` 一条管道——64 KB 请求体上限、四端点共用限流、honeypot、consent 必须为 `true`、字段 allowlist、只经 `nuxt-server` 的 `inquiries` create 权限写入、存储失败 503、0 文件系统写入；限流按 `x-forwarded-for` 首个地址计数，其可信度取决于生产代理 | Content：`PROVEN`（CC-IMP-10 本地范围）；公开询盘写入：`PROVEN`（FINAL-RELEASE-FIX-A 本地范围）；遗留权限工件化与最小化：`PROVEN`（FINAL-RELEASE-FIX-E 本地范围——精确行 / 字段 / 过滤由 `.verify.sql` fail closed 证明，两次 apply 整表一致，rollback 可逐字还原 pre-FIX-E 状态，重启后公开 GET smoke 与基线逐字节一致）；Product 子表过滤的 Directus 运行时正向执行、`inquiries` 行范围：`OPEN` | J-10 / J-11；FINAL-RELEASE-AUDIT | 在存在 published 产品且 products / posts 走 `directus` 模式的环境中取得子表过滤的正向执行证据；`inquiries` 行范围（须先有可依赖的归属列）；N-12～N-15、N-18 |
| RSG-08 Environment Separation | 仅本地开发库；`CMS_MODE` / `CMS_MODE_PRODUCTS` 默认 `fixtures`，DEMO fixtures 只允许在非生产环境使用：生产构建中任一值缺失、为空或不是 `directus` 时，公开 CMS API（产品分类 / 分类 / 详情、遗留 posts 列表 / 详情、首页 `site_content`）经共享 `server/utils/cmsSource.ts` fail closed——503 + 服务端错误日志，不服务 DEMO fixtures、不自动纠正（FINAL-RELEASE-FIX-C：单元测试 + 本地生产构建以空值与 `fixtures` 实测）；首页模板写死的 DEMO 提示与 3 张 demo 资源卡片已移除（FINAL-RELEASE-FIX-D）；Applications 公开页不再读取 DEMO fixtures（PUBLIC-CLAIMS-CLEANUP-01 / D-036）：hub 只使用已确认的八个行业导航标签，8 个 fixture 详情路由一律 404（noindex、无 TODO_CONTENT meta、无公开页面链接），fixture 文件保留供开发与测试；`.env.example` 列出两个变量；Content Center 公开读取与 sitemap 不使用 fixtures，模式不是 `directus` 时返回空列表 / 404（非 503，未改）；Directus 权限（含 FINAL-RELEASE-FIX-E 接管的 17 行 legacy 权限）不在 YAML 快照中，只由已跟踪工件提供：新环境须在 `directus-permissions-01-nuxt-server-content-read.sql` 之后显式 apply `directus-permissions-02-nuxt-server-legacy-site.sql`，分别运行各自的 `.verify.sql` 并重启 Directus（§3A.8 第 2 / 4 步）；FINAL-RELEASE-FIX-E 只改动本地开发库的 `directus_permissions` 行，生产未触碰，本地通过不构成生产证据。生产发布 NOT APPROVED；CURRENT-STATE Open Release Gates 仍 OPEN（持久 Node 22.22.2、生产 RAM / CPU、原生依赖许可证、容器 / 原生包 CVE、生产 extractor 拓扑、生产公开路由 / sitemap smoke）。Published TEST data（N-17）是 release blocker：`npm run release:check-test-data`（`scripts/release-check-test-data.mjs` 在 READ ONLY 事务中执行已跟踪只读查询 `scripts/release-check-test-data.sql`）在 posts、products、product_categories、content_item_locales 中发现处于公开状态且身份字段带明确 `[TEST]` / `TEST ONLY` / `NOT FOR PUBLICATION` 标记的记录时 exit 1，数据库无法查询或输出不完整时 exit 2（fail closed），只有 exit 0 为通过；FINAL-RELEASE-FIX-B 已把本地 7 条 published `[TEST]` legacy posts 撤回为 draft（未删除、标记保留），本地检查 PASS | `OPEN`（Published TEST data 检查：本地 PASS；生产 CMS 模式误配 fail closed：`PROVEN`，FINAL-RELEASE-FIX-C 本地生产构建范围） | TYPE D Release 模块；J-11；BP-DG-15 | Release Review（协议 §13.4）全部项；N-17（含 `npm run release:check-test-data` exit 0）、N-18 |
| RSG-09 Release Layering | 协议 §13 生效；各 review 分支均为本地 commit；`origin/master` = `8f2e384` | 由协议持续约束（每次报告须复核） | 每个模块 | N-19；报告中分别列出 local HEAD / checkpoint / `origin/master` |

---

## 5. Golden Path E2E Contract

Golden Path 证明"正确的人工流程确实能让合格内容公开，并能撤回"。它是触及 RSG-01～RSG-06 的模块（发布、公开交付、sitemap）必须提供的正向证据。

### 5.1 数据与环境规则

- 只在本地或隔离环境执行，**永不在生产执行**。
- 默认用可丢弃的隔离夹具证明（例如自动化测试中的数据库事务回滚、测试替身、临时隔离数据库）。
- 若需要在本地开发库让一条记录真实进入 Published，必须：施工单明确授权、记录为 `TEST ONLY — NOT FOR PUBLICATION`、只存在于本地、同一次运行内撤回并清理、报告复核快照 / 状态已恢复。这不改变 Charter G.5（TEST ONLY 产品不得进入 published）与协议 §12（未验证数据不得进入 Published 或公开输出）对产品与真实环境的约束；有冲突时按更严格者执行，必要时 STOP 请求 Controller 裁定。
- 每一步记录：动作、请求 / 状态码、数据库或公开出口的观察结果。

### 5.2 Content Center Golden Path（完整正向路径）

```text
G-01 Admin Login（已认证管理员）
G-02 Create Draft
G-03 Edit（Content Editor）
G-04 Media & Relations（只链接 is_public 且未归档的 Media Library 文件）
G-05 SEO & Locale
G-06 AI Source（明确选择、允许、未归档的来源）
G-07 AI Proposal（只生成建议，不写入）
G-08 Human Review（Accept / Edit / Reject）
G-09 Apply to Draft（只写 working copy；status 与 published_snapshot 不变）
G-10 Preview（仅管理员、noindex、无 canonical）
G-11 Readiness（Hard 检查通过；无分数；PASS ≠ Publish）
G-12 Manual Publish（人工动作；expectedDraftRevision 匹配；服务端重算 readiness）
G-13 Public Page 200（输出只来自 published_snapshot 的 allowlist 字段）
G-14 Sitemap / indexing eligibility 与公开资格一致（noindex = false 才进入 sitemap）
```

### 5.3 生命周期延续路径

```text
G-15 发布后继续编辑 working copy → 公开内容不变
G-16 再次 Publish → 公开内容更新
G-17 非默认语言：自己的快照 + 在 publishedLocales 中 + 默认语言已发布，才公开
G-18 Unpublish → 404 + sitemap 移除
G-19 Archive → 404 + sitemap 移除 + 关系停止渲染；Restore → Draft、无快照、仍不公开
```

分工：G-01～G-05 由 CC-IMP-02～CC-IMP-05 提供基础；G-06～G-09 由 CC-IMP-08 / CC-IMP-09 证明；G-10～G-12、G-15、G-16 由 CC-IMP-06 证明；G-17 由 CC-IMP-06（发布）与 CC-IMP-10（公开）共同证明；G-18、G-19 由 CC-IMP-06 / CC-IMP-07 证明；G-13、G-14 由 CC-IMP-10 证明；完整串联由 FINAL-RELEASE-AUDIT 证明（§5.5）。

### 5.4 Products Golden Path（产品公开切换 J-10 前须覆盖）

```text
P-01 draft → review → published（人工，满足发布门禁）
P-02 公开详情 / 分类列表 200，sitemap 收录（seo_noindex = false）
P-03 published → draft（撤回）→ 详情 404、列表消失、sitemap 排除
P-04 已发布后修改：按确认的修订合同处理，未审核修改不公开
```

### 5.5 Final Release Audit Golden Path

- FINAL-RELEASE-AUDIT 必须**至少真实跑一条**完整 Golden Path（G-01～G-14），使用 TEST ONLY 记录或专用 release fixture，并按 §5.1 执行：发布与公开步骤只在已授权的非生产环境进行，结束后撤回、清理并留证。
- Production public exposure（生产环境中的真实公开与生产公开 smoke）不在 Golden Path 授权内，仍由 Release policy（协议 §4 TYPE D、§13.4）单独控制。

---

## 6. Negative Safety Path Contract

Negative Path 证明"错误的路径全部被拒绝"。触及某 Gate 的模块，必须为该 Gate 列出的负向路径提供证据（自动化测试优先；需要时加真实本地请求）。

| ID | 负向路径 | 期望结果 | Gate |
|---|---|---|---|
| N-01 | Draft-only 条目 / 语言请求公开详情、列表、sitemap、搜索 | 404 / 不出现 | RSG-01、RSG-02 |
| N-02 | 已发布条目有未发布修改；任意公开 payload | 公开只返回快照；payload 不含 Draft-only 数据、Proposal、Sources、History、内部 readiness、admin 元数据、内部 Directus 字段（§3A.1 allowlist 测试） | RSG-01、RSG-07 |
| N-03 | Unpublish 后请求 | 404 且 sitemap 移除 | RSG-01、RSG-02 |
| N-04 | Archive 后请求（含作为关系目标） | 404、sitemap 移除、关系不渲染 | RSG-01、RSG-02 |
| N-05 | Restore 后未重新发布 | 仍不公开 | RSG-01 |
| N-06 | AI / Apply 尝试写 status、`published_snapshot` 或调用发布 | 不可能（无导入路径）或被拒且不写入 | RSG-03、RSG-04 |
| N-07 | 未认证或错误 Origin 调用发布端点 | 401 / 403，不写入 | RSG-03、RSG-07 |
| N-08 | 保存、Apply 或发布时 Draft revision 过期（stale `expectedDraftRevision` 或 proposal 分析时的 revision） | 409（发布为 `changed_since_review`），不写入 | RSG-03、RSG-04 |
| N-09 | 请求不在 `publishedLocales` 的语言，或该语言无快照 | 404；绝不回退显示默认语言内容 | RSG-05 |
| N-10 | 默认语言未发布时发布非默认语言 | 拒绝，不写入 | RSG-05 |
| N-11 | 公开渲染或请求 private（`is_public = false`）、已归档、关联未启用或 `source_document` 文件 | 不渲染 / 404；快照 / DTO 不含该文件 | RSG-06 |
| N-12 | `nuxt-server` 身份读取 working copy 列、junction、proposal、revision | 被拒 / 字段不可见 | RSG-07、RSG-01 |
| N-13 | 非管理员访问 `/admin/*`、`/api/admin/*` | 302 登录 / 401 / 403 | RSG-07 |
| N-14 | 通过通用 PATCH 设置 status、`published_snapshot`、revision、发布时间 | 422 或忽略，不写入 | RSG-03、RSG-07 |
| N-15 | 通过条目 A 的路由操作条目 B 的子记录（IDOR） | 403 / 404，不写入 | RSG-07 |
| N-16 | `noindex = true` 的已发布内容 | robots noindex 且 sitemap 排除（同一快照来源） | RSG-02 |
| N-17 | TEST ONLY 数据 | 永不出现在生产公开输出；本地真实发布须按 §5.1 清理 | RSG-01、RSG-08 |
| N-18 | 生产环境访问 Directus Admin（:8055） | 不可从公网访问 | RSG-07、RSG-08 |
| N-19 | 未经明确授权执行 push / merge / deploy | 不执行；报告如实列出三方 hash | RSG-09 |
| N-20 | 凭证、token、cookie、`.env` 值 | 永不出现在日志、提交、报告、公开输出 | RSG-07、RSG-08 |
| N-21 | 把条目 A 的 proposal 应用到条目 B（wrong content） | 409 拒绝，Draft 不变 | RSG-04 |
| N-22 | 把某语言的 proposal 应用到另一语言（wrong locale） | 409 拒绝，Draft 不变 | RSG-04、RSG-05 |
| N-23 | 应用已过期、已应用或服务重启后丢失的 proposal | 409 拒绝，不重建、不写入 | RSG-04 |
| N-24 | 新链接一个已在 Media Library 归档的文件（内容媒体、OG 图片、AI 来源） | 422 拒绝，不写入 | RSG-06 |

---

## 7. 高风险模块执行流程

```text
1. Identify touched gates     —— 对照 §0.2 与 §2，列出本模块触及的 RSG-xx
2. Read safety gates          —— 读取本文件与各 Gate 依据章节
3. Declare required evidence  —— 开工报告写明每个触及 Gate 的 Golden / Negative 证据（§5、§6 编号）
4. Implement                  —— 只在授权范围内施工；发现 Gate 冲突 → STOP
5. Prove every touched gate   —— 执行并记录证据；任何 VIOLATED → STOP（P0）
6. Closeout                   —— 报告 Gate Results / Open Gates / P0 Violations，更新本文件 §4 矩阵中受影响的行（仅限事实变化）
```

- 开工报告未识别触及的 Gate（或未写 `none` 并说明理由）时，不得开始实现。
- 高风险模块的收口报告必须包含 Safety Gates Touched、Gate Results、Evidence、Open Gates、P0 Violations；P0 Violations 必须为 `NONE` 才能 PASS。
- 模块自己引入的 Gate 破坏：必须在模块内修复并重新取证，否则 STOP，不得提交破坏性变更。
- 发现既有（非本模块引入）的 Gate 缺口：登记为 `OPEN` 并写明 owner，不隐藏、不顺手扩大范围修复；若它阻塞本模块 → STOP。
- 证据不足以证明时，状态写 `OPEN`，不得写 `PROVEN`。

---

## 8. 与现有 Gate 的关系

- `CURRENT-STATE.md` 的 Open Release Gates、Charter N.6（J-10 上线门槛）、Implementation Blueprint J-11 与 `BP-DG-15`、`BP-DG-09`（Locale / canonical / noindex / SEO release）、`BP-DG-10`（角色矩阵 / final publisher）、`CH-DG-09`、`CH-DG-14` 全部继续有效。本文件**不解除、不关闭、不重新编号**任何 Decision Gate。
- FD-004.2 的 P0 边界继续有效；RSG-03 / RSG-04 与之一致并更具体。
- Content Center Blueprint §31 的 P0 public isolation contract 与 §32 测试矩阵继续有效；§5、§6 是它们在模块验收层面的证据清单。
- `08-decision-log.md` D-033 记录本文件与 Safe Autopilot 方法的长期治理地位；Gate 细则只在本文件维护。
- 生产发布状态：**NOT APPROVED**。

## 9. 变更控制

- 修改、放宽、删除 Gate 或负向路径：只能由用户 / Controller 明确授权的 TYPE C 治理模块进行，并同步 CURRENT-STATE。
- §4 矩阵的事实更新（例如某 Gate 在某模块被 `PROVEN`）：由对应授权模块在收口时更新，不需要单独治理模块。
- 施工单可以为某 Gate 增加更严格的证据，但不能删减本文件要求的证据。
