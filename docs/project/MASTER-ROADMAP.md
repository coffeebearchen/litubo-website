# LITUBO Website — Master Roadmap（M1–M9）

> 本文件是项目总控路线图。所有新会话必须在读完 `CURRENT-STATE.md` 后读此文件，以确认当前处于哪个里程碑、有哪些进入条件和禁止事项。

**当前位置：M4 / M4-Next-3 Settings 最小版已完成（本地验收通过）— 等待 9C-2 Media Library 批量 → 9B AI 导入 → Content Center → 正式上线授权**

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

**状态：✅ Phase 9A-1 + 9A-2 核心闭环已完成（本地验收通过，未 push）— 后续子项待授权**

### 已完成子里程碑

#### 9A-1 ✅（完成）

管理员登录 + Product Center 基础信息 + Draft/Review 流程 + JWT 安全层 + 全量 typecheck/lint/build 通过

#### 9A-2 ✅（完成）

内容模块 + 参数组 + 媒体 + FAQ + SEO + 管理员预览 + 公开 Directus 接入 + 完整 Published→Draft 验收闭环

**已完成项（9A-2 核心）：**
- Directus：`product_sections`、`product_section_items`、`product_spec_groups`、`product_spec_items`、`product_faqs`、`product_source_records`（6 collections）
- Admin 子页面：Content / Specs / Media / FAQ / SEO / Preview
- 公开前台：`CMS_MODE_PRODUCTS=directus` 开关、完整产品详情页渲染
- 状态机：Draft → Review → Published → Draft（管理员完整控制）
- 验收：Published 时前台可见 + noindex + sitemap 排除；Draft 撤回后列表消失 + 404
- `nuxt-server` 权限：`product_categories`（18字段）、`products`（25字段），均含 sort
- 面包屑 `currentColor+opacity`：26 条路由全量验证通过（375px + 1440px）
- 规格 note 独立行显示（斜体 `display:block`）

**当前 Directus 测试产品：** ID=3，status=draft，seo_noindex=true，TEST ONLY 标识保留

### M4 待授权后续子项

以下按严格顺序执行，每步须独立授权：

#### M4-Next-1：Media Library 基础版 ✅（Phase 9C-1，commit 7e9d41c）

- 上传、替换、管理媒体文件 ✅
- 整合至产品媒体编辑流程 ✅

#### M4-Next-1P：管理员会话续期安全强化 ✅（Phase 9C-1P，commits f2b9ef1 + 收口 commit）

- auto-refresh 端点：Directus 401/403 清 cookie；网络错误/5xx 不清 cookie ✅
- 前端单飞锁 + visibilitychange 补刷 + 错误分支分离 ✅
- **9C-2 保留给 Media Library 批量选择/归类**（勿覆盖此编号）

#### M4-Next-2：9C-2 Media Library 批量选择/归类（预留编号，待授权）

- 批量选择文件、批量归类到文件夹
- 文件搜索增强

#### M4-Next-3：Settings 最小版 ✅（完成，本地验收通过）

**已完成：**
- `site_settings`（singleton）+ `site_social_links`（O2M）Directus collections
- Admin `/admin/settings` 页面：公司联系信息 / Social Links CRUD / Security 只读面板
- 公开 API `GET /api/cms/site-settings` 输出白名单字段 + enabled 社交链接
- Footer 从 CMS 读取，hardcoded fallback 保底
- LinkedIn / YouTube / Instagram / Facebook 四平台动态社交图标
- Schema 快照：`directus/schema/phase-settings-after.yaml`

#### M4-Next-4（= M5）：Phase 9B AI 产品导入与审核

见 M5 节；AI 仅生成 Draft，人工审核后发布，永不自动发布

#### M4-Next-5：Content Center

内容运营中心（博文、资源、页面等综合管理）

#### M4-Next-6：真实产品资料录入与正式上线

**push 授权、DNS 切换、生产部署须用户单独授权**

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

*最后更新：2026-09-04，M4-Next-3 Settings 最小版完成写入。*
