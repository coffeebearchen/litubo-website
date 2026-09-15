# LITUBO — Release Safety Gates

> **状态：** ACTIVE（`RELEASE-SAFETY-GATES-01`，TYPE C · A1 GOVERNANCE_DOCS，用户 / Controller 授权，2026-09-15）
> **角色：** 全项目唯一 canonical 的公开安全红线与高风险模块证据合同。定义 P0 Safety Gate、Gate 矩阵、Golden Path E2E 合同与 Negative Safety Path 合同。
> **Runtime effect：** none。本文件不创建、不修改任何路由、API、权限、数据库、Directus、AI、媒体或发布行为，也不关闭任何现有 Gate。

---

## 0. 权威与适用范围

### 0.1 权威关系

- 受 `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md`（V1.1）约束；**不修改 Charter**。本文件把 Charter、Decision Log、Content Center Freeze / Blueprint、`PROJECT-EXECUTION-PROTOCOL.md` 中已经存在的公开安全边界，收拢为一份可逐项证明的清单。
- 与 Charter / Decision / Freeze / Blueprint / 施工单同时适用时，**以更严格者为准**。
- 施工单、Blueprint 细化、模块报告**不得削弱**任何 Gate；只允许增加更严格的证据要求。
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
  AND locale_row.published_snapshot IS NOT NULL
  AND locale ∈ runtimeConfig.public.publishedLocales
  AND contentTypes[item.content_type].publicEnabled = true
  AND (locale = default OR default locale is published)

public output      = allowlist(published_snapshot) only
sitemap / search   = eligible AND type sitemapEligible AND snapshot.noindex = false
files in output    = RSG-06
relations rendered = target itself eligible in the same locale（产品目标：product status = published）
archived / unpublished / restored-not-republished → not eligible
```

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

## 4. Safety Gate Matrix（仓库事实，2026-09-15）

"当前事实"只记录静态读取可证实的内容；未验证项写 OPEN，不推测。

| Gate | 当前事实 | 状态 | Owner / 证明时机 | 关闭所需证据 |
|---|---|---|---|---|
| RSG-01 Draft Never Public | Content Center 无任何公开路由 / API；本地 `published_snapshot` 非空行 0。Products：公开详情 / 列表 / sitemap 均过滤 `status = published`；但产品已发布后修改立即上线，无 Revision Draft（Blueprint §3、§35 P2），与 Charter G.1 意图存在既有缺口 | Content：`NOT_YET_EXERCISED`；Products：`OPEN`（既有缺口，阻塞产品 CMS 公开切换 / 生产发布） | Content：CC-IMP-06、CC-IMP-10；Products：产品发布工作流模块（J-6e / J-10） | N-01～N-05、N-17 通过；DTO key allowlist 测试；产品修订草稿或经确认的替代合同 |
| RSG-02 Single Public Eligibility Contract | `server/api/cms/products/[category]/[slug].get.ts`、`[category].get.ts` 与 `server/routes/sitemap.xml.ts` 各自手写 `status = published` + 已发布分类过滤（当前条件一致，sitemap 另排除 `seo_noindex = true`）；无公开站内搜索端点；Content Center 无公开出口 | `OPEN` | CC-IMP-10（内容）；产品公开切换模块（产品） | 共享资格判定或等价性测试；N-01、N-03、N-04、N-16 |
| RSG-03 Human-only Publish | 产品 BFF 状态迁移表（draft ↔ review → published）；Content Center 无发布端点（CC-IMP-01～05 路由面测试断言无 publish / archive / restore 路由） | Products：`OPEN`（尚未按本文件取证）；Content：`NOT_YET_EXERCISED` | CC-IMP-06、CC-IMP-07 | N-06～N-08、N-13；AI / Apply 模块不导入发布处理器的测试 |
| RSG-04 AI Applies to Draft Only | 单产品 AI V1 已签收：Apply 只写同一产品 Draft，非 Draft 产品服务端拒绝（Charter H.1、CURRENT-STATE）。既有债务：Product Apply 未逐项核对提交内容与服务端 proposal（Blueprint §18、§35，完整性债务，非发布路径）。Content AI 未建 | Products：已有签收证据（Draft-only 范围）；Content：`NOT_YET_EXERCISED` | CC-IMP-08、CC-IMP-09 | N-06；proposal binding 测试（Blueprint §18）；Apply 不改 status / snapshot |
| RSG-05 Locale Independent, No Fallback | `publishedLocales = ['en']`；`/es`、`/pt` 页面 noindex、无 canonical / hreflang（Blueprint §3）；Content Center 每语言独立行、Admin 中无回退（CC-IMP-05 已验收）；遗留 `site_content` `home.hero` 经 i18n 回退读取（Blueprint §4，非 Content Center 发布） | Content public：`NOT_YET_EXERCISED`；遗留回退：`OPEN`（ES / PT 公开启用前须复核） | CC-IMP-06、CC-IMP-10；ES / PT 启用模块 | N-09、N-10；遗留回退复核结论 |
| RSG-06 Public Media Eligibility | `server/api/cms/media/[id].get.ts` 只检查 `is_public`，**不检查归档状态**（Blueprint §3、§35 P1 #10）；产品公开读取过滤 `products_files.enabled = true`；Content Center 在链接时拒绝归档文件 | `OPEN`（已知缺口） | CC-IMP-10（Blueprint P1 #10）；产品公开切换前同样适用 | N-11；归档文件经代理 404 的测试 |
| RSG-07 Permissions Fail Closed | `server/middleware/admin-auth.ts`：Administrator 角色 + 写操作 CSRF Origin 校验；`nuxt-server` 字段 / 行权限不在 schema 快照中，未经测试证实（Blueprint §3、§35 P1 #9） | `OPEN` | CC-IMP-10（`nuxt-server` 权限）；J-10 / J-11 | N-12～N-15、N-18 |
| RSG-08 Environment Separation | 仅本地开发库；`CMS_MODE` / `CMS_MODE_PRODUCTS` 默认 `fixtures`；生产发布 NOT APPROVED；CURRENT-STATE Open Release Gates 仍 OPEN（持久 Node 22.22.2、生产 RAM / CPU、原生依赖许可证、容器 / 原生包 CVE、生产 extractor 拓扑、生产公开路由 / sitemap smoke） | `OPEN` | TYPE D Release 模块；J-11；BP-DG-15 | Release Review（协议 §13.4）全部项；N-17、N-18 |
| RSG-09 Release Layering | 协议 §13 生效；各 review 分支均为本地 commit；`origin/master` = `8f2e384` | 由协议持续约束（每次报告须复核） | 每个模块 | N-19；报告中分别列出 local HEAD / checkpoint / `origin/master` |

---

## 5. Golden Path E2E Contract

Golden Path 证明"正确的人工流程确实能让合格内容公开，并能撤回"。它是触及 RSG-01～RSG-06 的模块（发布、公开交付、sitemap）必须提供的正向证据。

### 5.1 数据与环境规则

- 只在本地或隔离环境执行，**永不在生产执行**。
- 默认用可丢弃的隔离夹具证明（例如自动化测试中的数据库事务回滚、测试替身、临时隔离数据库）。
- 若需要在本地开发库让一条记录真实进入 Published，必须：施工单明确授权、记录为 `TEST ONLY — NOT FOR PUBLICATION`、只存在于本地、同一次运行内撤回并清理、报告复核快照 / 状态已恢复。这不改变 Charter G.5（TEST ONLY 产品不得进入 published）与协议 §12（未验证数据不得进入 Published 或公开输出）对产品与真实环境的约束；有冲突时按更严格者执行，必要时 STOP 请求 Controller 裁定。
- 每一步记录：动作、请求 / 状态码、数据库或公开出口的观察结果。

### 5.2 Content Center Golden Path（CC-IMP-06 / CC-IMP-07 / CC-IMP-10 合计须覆盖）

```text
G-01 创建 Draft（默认语言）
G-02 编辑内容、链接 is_public 且未归档的媒体、设置 SEO
G-03 Admin 预览：noindex、无 canonical、仅管理员可见
G-04 Readiness 硬检查通过（无分数）
G-05 管理员人工 Publish（expectedDraftRevision 匹配）
G-06 公开详情 200，输出仅来自 published_snapshot 的 allowlist 字段
G-07 符合条件时出现在 sitemap；noindex=false 与 robots 一致
G-08 发布后继续编辑 working copy → 公开内容不变
G-09 再次 Publish → 公开内容更新
G-10 非默认语言：在 publishedLocales 中且默认语言已发布时才可公开
G-11 Unpublish → 404 + sitemap 移除
G-12 Archive → 404 + sitemap 移除 + 关系停止渲染；Restore → Draft、无快照、仍不公开
```

### 5.3 Products Golden Path（产品公开切换 J-10 前须覆盖）

```text
P-01 draft → review → published（人工，满足发布门禁）
P-02 公开详情 / 分类列表 200，sitemap 收录（seo_noindex = false）
P-03 published → draft（撤回）→ 详情 404、列表消失、sitemap 排除
P-04 已发布后修改：按确认的修订合同处理，未审核修改不公开
```

---

## 6. Negative Safety Path Contract

Negative Path 证明"错误的路径全部被拒绝"。触及某 Gate 的模块，必须为该 Gate 列出的负向路径提供证据（自动化测试优先；需要时加真实本地请求）。

| ID | 负向路径 | 期望结果 | Gate |
|---|---|---|---|
| N-01 | Draft-only 条目 / 语言请求公开详情、列表、sitemap、搜索 | 404 / 不出现 | RSG-01、RSG-02 |
| N-02 | 已发布条目有未发布修改 | 公开只返回快照；payload 不含 working copy、revision、`last_change_kind`、内部 id 等键（allowlist 测试） | RSG-01 |
| N-03 | Unpublish 后请求 | 404 且 sitemap 移除 | RSG-01、RSG-02 |
| N-04 | Archive 后请求（含作为关系目标） | 404、sitemap 移除、关系不渲染 | RSG-01、RSG-02 |
| N-05 | Restore 后未重新发布 | 仍不公开 | RSG-01 |
| N-06 | AI / Apply 尝试写 status、`published_snapshot` 或调用发布 | 不可能（无导入路径）或被拒且不写入 | RSG-03、RSG-04 |
| N-07 | 未认证或错误 Origin 调用发布端点 | 401 / 403，不写入 | RSG-03、RSG-07 |
| N-08 | 发布时 `expectedDraftRevision` 过期 | 409 `changed_since_review`，不写入 | RSG-03 |
| N-09 | 请求不在 `publishedLocales` 的语言，或该语言无快照 | 404；绝不回退显示默认语言内容 | RSG-05 |
| N-10 | 默认语言未发布时发布非默认语言 | 拒绝，不写入 | RSG-05 |
| N-11 | 公开请求 `is_public = false`、已归档、关联未启用或 `source_document` 文件 | 404；快照 / DTO 不含该文件 | RSG-06 |
| N-12 | `nuxt-server` 身份读取 working copy 列、junction、proposal、revision | 被拒 / 字段不可见 | RSG-07、RSG-01 |
| N-13 | 非管理员访问 `/admin/*`、`/api/admin/*` | 302 登录 / 401 / 403 | RSG-07 |
| N-14 | 通过通用 PATCH 设置 status、`published_snapshot`、revision、发布时间 | 422 或忽略，不写入 | RSG-03、RSG-07 |
| N-15 | 通过条目 A 的路由操作条目 B 的子记录（IDOR） | 403 / 404，不写入 | RSG-07 |
| N-16 | `noindex = true` 的已发布内容 | robots noindex 且 sitemap 排除（同一快照来源） | RSG-02 |
| N-17 | TEST ONLY 数据 | 永不出现在生产公开输出；本地真实发布须按 §5.1 清理 | RSG-01、RSG-08 |
| N-18 | 生产环境访问 Directus Admin（:8055） | 不可从公网访问 | RSG-07、RSG-08 |
| N-19 | 未经明确授权执行 push / merge / deploy | 不执行；报告如实列出三方 hash | RSG-09 |
| N-20 | 凭证、token、cookie、`.env` 值 | 永不出现在日志、提交、报告、公开输出 | RSG-07、RSG-08 |

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

- 模块自己引入的 Gate 破坏：必须在模块内修复并重新取证，否则 STOP，不得提交破坏性变更。
- 发现既有（非本模块引入）的 Gate 缺口：登记为 `OPEN` 并写明 owner，不隐藏、不顺手扩大范围修复；若它阻塞本模块 → STOP。
- 证据不足以证明时，状态写 `OPEN`，不得写 `PROVEN`。

---

## 8. 与现有 Gate 的关系

- `CURRENT-STATE.md` 的 Open Release Gates、Charter N.6（J-10 上线门槛）、Implementation Blueprint J-11 与 `BP-DG-15`、`BP-DG-09`（Locale / canonical / noindex / SEO release）、`BP-DG-10`（角色矩阵 / final publisher）、`CH-DG-09`、`CH-DG-14` 全部继续有效。本文件**不解除、不关闭、不重新编号**任何 Decision Gate。
- FD-004.2 的 P0 边界继续有效；RSG-03 / RSG-04 与之一致并更具体。
- Content Center Blueprint §31 的 P0 public isolation contract 与 §32 测试矩阵继续有效；§5、§6 是它们在模块验收层面的证据清单。
- 生产发布状态：**NOT APPROVED**。

## 9. 变更控制

- 修改、放宽、删除 Gate 或负向路径：只能由用户 / Controller 明确授权的 TYPE C 治理模块进行，并同步 CURRENT-STATE。
- §4 矩阵的事实更新（例如某 Gate 在某模块被 `PROVEN`）：由对应授权模块在收口时更新，不需要单独治理模块。
- 施工单可以为某 Gate 增加更严格的证据，但不能删减本文件要求的证据。
