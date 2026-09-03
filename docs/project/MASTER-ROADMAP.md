# LITUBO Website — Master Roadmap（M1–M9）

> 本文件是项目总控路线图。所有新会话必须在读完 `CURRENT-STATE.md` 后读此文件，以确认当前处于哪个里程碑、有哪些进入条件和禁止事项。

**当前位置：M4 / Phase 9A-1（Product CMS Admin 基础信息，正在施工）**

---

## 总览

| 里程碑 | 名称 | 状态 | 关联 Phase |
|--------|------|------|-----------|
| M1 | Nuxt 框架 + 全站 Shell | ✅ 已完成 | Phase 1 |
| M2 | Directus CMS 基础 + 产品数据模型 | ✅ 已完成 | Phase 2–3 |
| M3 | 内容管理 + 询盘 + HubSpot + SEO | ✅ 已完成 | Phase 4–8 |
| **M4** | **Product CMS Admin + 产品详情页（Phase 9A）** | **🔨 施工中** | **Phase 9A-1 / 9A-2** |
| M5 | AI 产品资料导入助手（Phase 9B） | ⏳ 待授权 | Phase 9B |
| M6 | ES/PT 内容审校与发布 | ⏳ 待授权 | Phase 10 |
| M7 | HubSpot 生产激活（Phase 7B） | ⏳ 待用户操作 | Phase 7B |
| M8 | 生产部署 + Cloudflare DNS 切换 | ⏳ 待授权 | Phase 11 |
| M9 | 发布验证 + 监控 + 首次正式上线 | ⏳ 待授权 | Phase 12 |

---

## M1 — Nuxt 框架 + 全站 Shell

**状态：✅ 已完成（Phase 1）**

### 完成内容

- Nuxt 3 + Vue 3 + TypeScript strict 模式
- EN/ES/PT 三语言路由（`prefix_except_default`）
- Header（固定深绿色）、五个桌面端 Mega Menu、移动端 Accordion 导航
- Footer、全局 CSS Token、响应式基线（320–1440px）
- 所有公开路由骨架注册，CMS 适配器模式（fixtures / directus 切换）

### 验收结果

typecheck 0 errors、lint 0 errors、build SUCCESS、375px 无水平溢出

---

## M2 — Directus CMS 基础 + 产品数据模型

**状态：✅ 已完成（Phase 2–3）**

### 完成内容

- Directus 11 + PostgreSQL 16，Docker Compose 本地运行
- `product_categories`、`products`、`products_files`（M2M junction）
- `nuxt-server` 角色最小权限（READ only, published only）
- Nuxt server API `/api/cms/products`、`/api/cms/products/[category]/[slug]`
- 媒体库 `directus_files`（`is_public` 字段）

---

## M3 — 内容管理 + 询盘 + HubSpot + SEO

**状态：✅ 已完成（Phase 4–8）**

### 完成内容

| Phase | 内容 |
|-------|------|
| 4 | `site_content` singleton CMS（首页 Hero） |
| 5 | `posts` collection（Insight、Case Study、FAQ、News、Technical Guide） |
| 6 | `inquiries` 统一询盘管理（contact/technical_matching/distributor/spare_parts/support_request/send_product_test） |
| 7A | HubSpot Contact 同步框架（代码已就绪，Token 待 Phase 7B 配置） |
| 8B-1 | SEO 基础：canonical、OG、Twitter Card、hreflang、html lang、robots.txt |

### 剩余待办（不影响 M4 施工）

- Phase 7B：用户在 HubSpot 创建 Private App，配置 `HUBSPOT_ACCESS_TOKEN`，完成真实 Contact 同步验收
- Phase 8B-2：XML Sitemap 自动生成（M4 完成后排期）

---

## M4 — Product CMS Admin + 新版产品详情页（Phase 9A）

**状态：🔨 当前施工目标**

### 进入条件（已满足）

- M1–M3 完成且 build 正常
- Directus 11 本地运行、现有 collections 完好
- `phase9a1-before.yaml` schema 快照已导出
- PostgreSQL 备份已完成
- 用户单独授权本次施工

### M4 分两个子里程碑

#### 9A-1（当前施工）

**目标：** 管理员登录 + Product Center 基础信息 + Draft/Review 流程

**范围：**
- Directus：`product_page_presets`（新建）、`products` 新增 4 字段（`model_or_series`、`page_preset_id`、`published_at`、`review_notes`）、`status` 增加 `review` 选项
- LITUBO Admin：`/admin/login`、`/admin/products`（列表）、`/admin/products/new`、`/admin/products/[id]`
- 安全：JWT httpOnly Cookie、登录失败 5 次锁定 15 分钟、CSRF Origin 检查、管理员角色验证
- 发布限制：9A-1 只允许 `draft ↔ review`；Published/Archived 按钮在 9A-1 禁用

**禁止（9A-1）：**
- 任何 AI UI 或按钮
- 创建任何产品测试数据或假产品
- 修改公开前台页面
- 将任何产品状态设为 `published` 或 `archived`
- push、部署、改服务器

**9A-1 验收条件：**
- typecheck 0 errors、lint 0 errors、build SUCCESS
- `/admin/login` 登录正常，错误密码拒绝，5 次失败后 429
- 未登录访问 `/admin/products` 重定向到 `/admin/login`
- 普通角色用户 Cookie 访问 `/api/admin/*` 返回 403
- 产品列表、新建、基础字段编辑正常
- Draft → Review → Draft 状态流转正常
- 禁止出现 Published 产品
- 侧边栏无任何 AI 入口
- 公开前台 `/products/...` 无任何变化
- 本地 Git commit 完成

#### 9A-2（9A-1 验收通过后授权）

**目标：** 内容模块 + 参数 + 媒体 + FAQ + SEO + 新版公开产品详情页 + LT-180C 真实样板

**范围：**
- Directus：`product_sections`（含 `body_en/es/pt`、`media_id`、`external_url`）、`product_section_items`、`product_spec_groups`、`product_spec_items`、`product_faqs`、`product_source_records`（`source_file_id → directus_files`）
- `products_files` 扩展（11 种 `file_role`、alt_text、enabled、language、version、published_date）
- LITUBO Admin：Content/Specs/Media/FAQ/SEO 编辑器页面
- 公开前台：`ProductPageViewModel`、新版 `[slug].vue`、全套 section 组件
- LT-180C 真实 Draft 录入与验收

**9A-2 发布限制解除条件：** 用户确认新版详情页渲染正确后，Published 按钮开放

---

## M5 — AI 产品资料导入助手（Phase 9B）

**状态：⏳ M4 完成 + 用户单独授权后执行**

### 范围（概要）

- `product_import_jobs`（新建）、`product_source_records.import_job_id`（与 M4 中的 `source_file_id` 配合）
- Provider Adapter 模式：OpenAI / DeepSeek / Mock
- 环境变量：`OPENAI_API_KEY`、`DEEPSEEK_API_KEY`、`AI_DEFAULT_PROVIDER`、`AI_DEFAULT_MODEL`、`AI_MONTHLY_BUDGET_USD`
- Settings 页面：只显示连接状态、模型、测试、预算、审计；**绝不显示完整密钥**
- AI 只生成 Draft，人工审核后发布；永不自动发布

### 禁止（M5）

- 连接真实 OpenAI / DeepSeek Key，除非用户在 M5 开始时单独授权
- AI 生成内容绕过人工审核直接发布
- AI 相关 UI 在 M4 内出现

---

## M6 — ES/PT 内容审校与发布

**状态：⏳ M4 完成后排期**

### 进入条件

- 所有英文内容完整、经用户确认
- 西班牙语和葡语译文由真实翻译人员审核通过

### 禁止

- 用机器翻译直接填充并发布 ES/PT
- 未经用户授权启用 `/es/` 或 `/pt/` 语言路由的 indexed 状态

---

## M7 — HubSpot 生产激活（Phase 7B）

**状态：⏳ 用户操作，开发配合**

### 用户必须完成

1. 在 HubSpot 账户创建 **Private App**（权限：`crm.objects.contacts.write`）
2. 创建 7 个自定义联系人属性（见 `CURRENT-STATE.md` Phase 7B 节）
3. 将 Access Token 写入生产服务器 `.env`
4. 重启 Nuxt 服务后提交真实测试询盘

### 禁止

- 开发人员代为操作 HubSpot 账户
- 将 Access Token 写入代码或文档

---

## M8 — 生产部署 + Cloudflare DNS 切换

**状态：⏳ M4 + M7 完成后，用户单独授权**

### 进入条件

- 所有代码 push 到 GitHub，CI 通过
- 腾讯云服务器 Docker Compose 部署就绪
- Cloudflare 配置确认
- 旧 Wix 网站迁移计划确认

### 禁止（未授权前绝对禁止）

- `git push` 到任何远程仓库
- 修改 DNS 记录
- 修改生产服务器 Docker 配置
- 修改 Cloudflare 设置
- 关闭或迁移旧 Wix 网站

---

## M9 — 发布验证 + 监控 + 正式上线

**状态：⏳ M8 完成后**

### 验收内容

- Google Search Console 收录验证
- Cloudflare Analytics 数据流正常
- 所有公开页面 canonical / hreflang / robots 正确
- 核心 Web Vitals（LCP/CLS/FCP）基线测量
- 移动端与桌面端完整验收

---

## 全局安全与操作守则

以下规则在 M1–M9 任何阶段均不可违反：

| 规则 | 说明 |
|------|------|
| `git push` | 未获用户单独授权，禁止 |
| 生产部署 | 未获用户单独授权，禁止 |
| 改服务器配置 | 未获用户单独授权，禁止 |
| 改 DNS / Cloudflare | 未获用户单独授权，禁止 |
| AI Key（真实）| 未获 M5 授权，禁止接入；Key 只存 `.env`，不进 Git |
| 假产品 / 假参数 | 任何阶段禁止创建 |
| AI 自动发布 | 禁止；AI 只生成 Draft |
| Token 泄露 | `.env` 不进 Git；Token 不出现在代码、日志、文档中 |
| `product_source_records` | 绝不向 `nuxt-server` 开放任何权限 |

---

*最后更新：2026-09-03，Phase 9A-1 施工开始时写入。*
