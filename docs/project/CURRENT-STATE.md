# LITUBO 项目当前状态文档

> 本文件是新 Claude 会话的首要阅读文件。读完此文件后，再读 `docs/ADMIN-CMS-SPEC.md` 和 `docs/OPERATIONS-HANDBOOK.md`，然后执行只读 Git/Docker 核对，再开始任何实施工作。

---

## 1. 项目身份

| 项目 | 值 |
|------|-----|
| 仓库名称 | `litubo-website` |
| GitHub 远程 | `git@github.com:coffeebearchen/litubo-website.git` |
| 当前分支 | `master` |
| 最新 commit SHA | `5c8c704` |
| 最新 commit 说明 | `docs: add Chinese operations handbook for phases 1–6` |

**技术架构：** Nuxt 3 + Vue 3 + TypeScript（SSR/hybrid）/ Directus 11 + PostgreSQL 16 / Docker Compose / 本地开发中，未来部署至腾讯云美国服务器，Cloudflare Free 作为前端边缘（DNS、TLS、缓存）。

---

## 2. 已完成阶段

### Phase 1 — Nuxt 基础架构与全局 Shell

**commit 范围：** 项目初始化 ~ Module 1 完成

- Nuxt 3 项目创建，TypeScript strict 模式，EN/ES/PT 三语言路由（`prefix_except_default`）
- Header（固定深绿色）、五个桌面端 Mega Menu、移动端 Accordion 导航
- Footer 四栏网格、全局 CSS Token、响应式基线（320 ~ 1440px 无水平溢出）
- 所有公开路由骨架已注册（产品、应用、资源、支持、公司、隐私政策等）
- CMS 适配器模式：前台读 fixtures，后续切换 Directus 时不改组件

**Schema 快照：** 无（Phase 1 无 Directus 变更）

---

### Phase 2 — 媒体库

**commit：** `ec2b1e5`（phase2-before-products schema 快照）

- Directus `directus_files` 新增自定义字段 `is_public`（boolean）
- 媒体库上传、替换、管理流程就绪
- 上传目录挂载至宿主机持久化卷

**Schema 快照：** `directus/schema/phase2-before-products.yaml`

---

### Phase 3 — 产品 CMS

**commit 范围：** `3ecbb19` → `025daaa` → `608a661`

- Directus collections：`product_categories`、`products`、`products_files`（M2M junction）
- `nuxt-server` 角色：products READ 权限（最小权限原则）
- Nuxt server API endpoints：`/api/cms/products`、`/api/cms/products/[slug]`
- 前台产品列表页 `/products` 和详情页 `/products/[category]/[slug]` 切换为 CMS 数据

**Schema 快照：** `directus/schema/phase3-products.yaml`

---

### Phase 4 — 首页 Hero CMS

**commit：** `0aecbcf`

- Directus collection：`site_content`（singleton 键值对，`content_key = 'home.hero'`）
- Hero 区域标题、副标题、CTA 文字可在 Directus 后台编辑
- 前台通过 `/api/cms/site-content/[key]` 读取

**Schema 快照：** `directus/schema/phase4-site-content.yaml`

---

### Phase 5 — Blog / Insight / FAQ / 知识库

**commit 范围：** `6b44133` → `525feb5`

- Directus collection：`posts`（含 `status`、`content_type`、`topics` JSON、多语言字段 `title_en/es/pt`、`body_en/es/pt` 等）
- 内容类型：`insight`、`technical_guide`、`case_study`、`news`、`faq`
- Topics 过滤为服务端 post-fetch（Directus JSON 类型不支持 subset 操作符）
- 路由：`/resources/insights/[slug]`、`/resources/case-studies/[slug]` 等

**Schema 快照：** `directus/schema/phase5-posts.yaml`

---

### Phase 6 — 统一询盘管理

**commit 范围：** `6975a56` → `9b62e30`

- Directus collection：`inquiries`（统一存储所有表单来源）
- 询盘类型：`contact`、`technical_matching`、`distributor`、`spare_parts`、`support_request`、`send_product_test`
- 字段覆盖：联系信息、Technical Matching 参数、UTM 追踪、`raw_fields` JSON、AI 预留字段（`ai_summary`、`ai_draft_reply`、`ai_intent`、`ai_confidence`、`ai_recommended_products`、`ai_reviewed`、`ai_processed_at`）
- Nuxt server API：`POST /api/inquiries`（字段白名单、长度校验、HTML 消毒、IP 哈希限流、Honeypot）
- 邮件通知：`server/utils/sendInquiryEmail.ts`（best-effort，SMTP 配置后生效）
- Directus 不可用时前台返回 503

**Schema 快照：** `directus/schema/phase6-inquiries.yaml`

---

## 3. CMS 与安全边界

| 边界 | 说明 |
|------|------|
| Directus Admin 地址 | 仅内网访问（127.0.0.1:8055），不对公网开放 |
| 前台访问 CMS 的方式 | 仅通过 Nuxt server API 层（`server/api/`、`server/utils/`），Directus REST API 不暴露给浏览器 |
| Directus Token | `.env` 中管理，不进 Git，不写入任何文档 |
| Directus Collection 数量 | 上限 25（Directus 社区版限制）；当前已用：`product_categories`、`products`、`products_files`、`site_content`、`posts`、`inquiries` = **6 个**（含 M2M junction 1 个） |
| 不进 Git 的内容 | `.env`、PostgreSQL 数据文件、`directus/uploads/`、数据库备份 |

---

## 4. 当前状态 — HubSpot Phase 7A 已完成

**状态：Phase 7A 本地实施完成，已提交，等待 Phase 7B Token 真实验收。**

### Phase 7A 完成内容

| 类别 | 完成项 |
|------|--------|
| Directus 字段 | `inquiries` 新增 4 个 `hubspot_*` 字段 |
| Directus 权限 | nuxt-server READ=id、CREATE+hubspot_sync_status、UPDATE=hubspot 字段 |
| 新建文件 | `server/utils/syncHubspot.ts`、`directus/schema/phase6-before-hubspot.yaml`、`directus/schema/phase7-hubspot.yaml` |
| 修改文件 | `server/utils/writeInquiry.ts`（?fields=id）、`server/api/inquiries.post.ts`（syncHubspot 集成）、`nuxt.config.ts`、`.env.example`、`pages/privacy-policy.vue`、`docs/OPERATIONS-HANDBOOK.md` |
| 类型 | `types/content.ts` 新增 `HubspotSyncStatus` 类型 |
| 验收 | typecheck 0 错误、lint 0 错误、build 通过、隐私政策页面浏览器验证通过、mock 分支验证（success/error/timeout/INVALID_PROPERTY）通过 |

### 无 Token 状态说明

当前所有询盘写入后 `hubspot_sync_status = not_configured`，这是正确的预期状态。

### Phase 7B 仍需用户完成的内容

### Phase 7B 需要用户完成（开发人员不可代劳）

1. 在 HubSpot 账户中创建 **Private App**（不是 API Key），权限：`crm.objects.contacts.read`、`crm.objects.contacts.write`
2. 在 HubSpot **联系人属性** 中创建 4 个自定义属性：`litubo_inquiry_type`、`litubo_locale`、`litubo_related_product_slug`、`litubo_source_url`
3. 将 Private App 的 Access Token 写入服务器 `.env`：`HUBSPOT_ACCESS_TOKEN=<token>`
4. 重启 Nuxt（`docker compose restart nuxt`）
5. 提交真实测试询盘，验证 HubSpot Contact 和 `hubspot_sync_status=success`

**不需要创建 Deal、Pipeline 或 Stage——Phase 7A/B 只同步 Contact。**

---

### 历史待办（已完成的 7A）——不需要的内容

#### 7A 不需要的内容（不要向用户索取）

- HubSpot Access Token
- HubSpot Portal ID
- Pipeline ID / Stage ID
- HubSpot Deal 配置

Phase 7A 只编写 Contact 同步代码框架；无 Token 时同步状态落为 `not_configured`，这本身是 7A 的验收测试内容。

### 7A 必须实施的内容

#### Directus 层

`inquiries` collection 新增 4 个字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `hubspot_sync_status` | string | `not_configured` / `success` / `error` / `timeout` |
| `hubspot_contact_id` | string | HubSpot Contact ID（有 Token 后填入） |
| `hubspot_synced_at` | timestamp | 同步时间戳 |
| `hubspot_error_summary` | text | 错误摘要（可读，不含敏感信息） |

`nuxt-server` 角色权限调整：
- READ：仅 `id` 字段（`POST /items/inquiries?fields=id` 前置验证）
- CREATE：白名单新增 `hubspot_sync_status`
- UPDATE：仅上述 4 个 `hubspot_*` 字段

#### 代码层

| 文件 | 操作 |
|------|------|
| `server/utils/syncHubspot.ts` | **新建**：HubSpot Contact 同步函数；无 Token → `not_configured`；有 Token → 调用 API（≤3 秒超时）；结果写回 Directus |
| `server/utils/writeInquiry.ts` | **修改**：POST 请求改为 `?fields=id`，确保返回 `data.id` |
| `server/api/inquiries.post.ts` | **修改**：Step 9 之后增加受控 `await syncHubspot(...)`（≤3 秒），不影响表单成功响应 |
| `nuxt.config.ts` | **修改**：`runtimeConfig` 新增 `hubspotAccessToken` |
| `.env.example` | **修改**：新增 `HUBSPOT_ACCESS_TOKEN=` |
| `pages/privacy-policy.vue` | **修改**：补充隐私政策正文 |
| `docs/OPERATIONS-HANDBOOK.md` | **修改**：HubSpot 状态更新为"代码已就绪，尚未配置 Token，当前状态为 not_configured" |
| `directus/schema/phase7-hubspot.yaml` | **新建**：4 个新字段及权限的 schema 快照 |

#### 7A 结束时操作手册状态

```
HubSpot 同步代码已准备，尚未配置 Token，当前询盘状态为 not_configured。
```

**不得**写"已启用"。

### 未来 Phase 7B（用户单独授权后）

由用户在 HubSpot 账户创建 Private App，提供 `HUBSPOT_ACCESS_TOKEN`，开发团队完成真实 Contact 同步验收。Deal、Pipeline、AI 助手等属于更后续的独立模块。

---

## 5. 新会话接手步骤

1. **读此文件**（`docs/project/CURRENT-STATE.md`）
2. **读** `docs/ADMIN-CMS-SPEC.md`
3. **读** `docs/OPERATIONS-HANDBOOK.md`
4. **执行只读核对并报告**：

   ```
   git status --short
   git branch --show-current
   git log -12 --oneline
   git remote -v
   docker compose ps
   ```

5. **比对**：若实际状态（分支、最新 commit SHA、容器状态）与本文件记录不一致，停止并报告差异，不猜测，不自动修复。
6. **等待用户授权**后再开始任何实施工作。

---

*最后更新：2026-09-02，由 Claude Code 在"项目档案固化"任务中写入。*
