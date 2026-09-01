# LITUBO 后台内容管理系统 — 一期规格文档

> **版本：** 1.0 — 初稿
> **状态：** 待审批后方可开始开发
> **适用范围：** 一期上线所需最小可运行后台闭环
> **技术栈锁定：** Nuxt 3 + Vue 3 + TypeScript / Directus + PostgreSQL / Docker Compose

---

## 一、定位与边界

### 1.1 后台的职责

LITUBO 管理后台是面向内部运营人员的内容操作界面，**不是**页面搭建器，也不是设计工具。

- 管理员通过后台编辑**已定义字段**；
- 前台页面版式、组件结构、间距、排版由设计系统固定，后台无权修改布局；
- 所有前台渲染逻辑保留在 Nuxt 组件层，后台只影响数据内容；
- 后台地址不对外公开，不出现在 sitemap、robots.txt 或任何公开链接。

### 1.2 一期范围之内

| 模块 | 说明 |
|---|---|
| 管理员登录 | 单账号 JWT 登录，无公开注册 |
| 媒体库 | 图片和 PDF 的上传、替换、管理 |
| 首页内容 | Hero 区域字段编辑 |
| Blog / 资讯 | 全生命周期：草稿→发布→下架 |
| 询盘管理 | Contact 和 Technical Matching 提交记录的查看与状态管理 |
| 基础 SEO | 首页、Blog 文章的 title / description / OG 图片 |

### 1.3 一期范围之外（二期及以后）

以下功能不在一期开发范围，**不得提前实现**：

- 复杂多角色权限（二期）
- CRM 自动同步 / HubSpot（二期）
- 统计报表与访客分析（二期）
- 视频上传与转码（二期）
- 公开 AI 对话（二期）
- Excel 批量导入（二期）
- 自动发布 / 自动邮件（二期）
- Products / Applications / Downloads / Certificates / Company 页面的后台管理（随后扩展模块，见第五章）

---

## 二、技术设计

### 2.1 推荐实现方式

根据项目已确认技术栈（`docs/project/01-technical-decision.md`），后台采用以下方案：

| 层 | 选型 | 理由 |
|---|---|---|
| 后台 UI | **Directus** 内置管理界面 | 零前端开发量；字段、权限、媒体库开箱即用；可配置工作流和字段级权限 |
| 数据库 | **PostgreSQL** | 与 Directus 原生集成；支持 JSONB 存储多语言字段；已在技术决策中确认 |
| 文件存储 | **本地磁盘**（一期）→ 对象存储（二期） | 一期部署在腾讯云单机，挂载数据卷即可；二期迁移到 COS 时只需更换 Directus storage adapter |
| 公开 API | Directus REST API（内网调用）+ Nuxt server 层封装 | 前台通过 content adapter 读取，不直接暴露 Directus 端点 |
| 容器编排 | **Docker Compose**，与现有 Nginx 共存 | 沿用已有运维模型，单独 network 隔离 |

### 2.2 后台路由与安全边界

```
公开域名            https://www.litubo.com/
后台内网访问路径     https://admin.litubo.com/  (或 /admin/ 子路径，部署时确认)
Directus API       http://directus:8055/  (容器内网，不暴露到公网)
```

**安全规则：**

- Nginx 限制 `/admin/` 或 `admin.` 子域只允许办公室 IP 或 VPN 访问；
- Directus 管理界面不在 Cloudflare 缓存路径内；
- Directus API 不向公网开放；Nuxt server 函数在服务器内网调用 Directus；
- 一期只设一个 `admin` 账号；禁止公开注册；Token 存储在 Directus 数据库，不写入 `.env` 明文；
- 所有 API 调用使用 HTTPS；静态 token 只在 `.env` 内配置，不提交到 Git。

### 2.3 数据存储结构

Directus 通过图形界面配置 Collections（对应数据库表）。以下为一期必须创建的 Collections：

#### `directus_users`（Directus 内置）
- 一期只使用内置用户管理，无需自定义字段。

#### `media`（Directus 内置：`directus_files`）
- `id` UUID
- `filename_disk` 磁盘文件名
- `filename_download` 用于下载的显示文件名
- `type` MIME 类型（image/*, application/pdf）
- `filesize`
- `width`, `height`（图片）
- `folder` 分组：`home` / `products` / `applications` / `resources` / `company` / `certifications`
- `title` 管理界面显示名称
- `description` alt 文字备注

#### `page_home`（首页内容，单条记录）
- `id` integer (singleton)
- `hero_image` → 外键 → `directus_files`
- `hero_eyebrow_en` varchar
- `hero_title_en` varchar
- `hero_body_en` text
- `hero_cta_primary_label_en` varchar
- `hero_cta_primary_url` varchar
- `hero_cta_secondary_label_en` varchar
- `hero_cta_secondary_url` varchar
- `seo_title_en` varchar
- `seo_description_en` text
- `seo_og_image` → 外键 → `directus_files`
- `updated_at` timestamp

> ES / PT 字段命名规则：将 `_en` 后缀替换为 `_es` / `_pt`，结构完全相同。一期只要求 EN 字段必填，ES/PT 可为空。

#### `blog_posts`（Blog 文章）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID | 主键 |
| `slug` | varchar unique | URL 标识，英文小写连字符 |
| `status` | enum: `draft` / `published` / `archived` | 发布状态 |
| `publish_date` | timestamp | 定时发布时间（可为 null） |
| `title_en` | varchar | 英文标题 |
| `title_es` | varchar | 西班牙语标题（可为空） |
| `title_pt` | varchar | 葡语标题（可为空） |
| `excerpt_en` | text | 摘要 EN |
| `excerpt_es` | text | 摘要 ES |
| `excerpt_pt` | text | 摘要 PT |
| `body_en` | text (rich text) | 正文 EN（Markdown 或 WYSIWYG） |
| `body_es` | text | 正文 ES |
| `body_pt` | text | 正文 PT |
| `cover_image` | 外键 → `directus_files` | 封面图 |
| `category` | varchar | 分类：`insight` / `case-study` |
| `tags` | JSON array | 标签列表 |
| `seo_title_en` | varchar | |
| `seo_description_en` | text | |
| `seo_og_image` | 外键 → `directus_files` | |
| `author` | varchar | 显示用作者名（非系统账号） |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

#### `form_submissions`（询盘记录）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | varchar | `{formId}-{timestamp}` |
| `form_id` | enum: `contact` / `technical-matching` / `spare-parts` / `support-request` | 表单来源 |
| `locale` | varchar | `en` / `es` / `pt` |
| `values` | JSONB | 完整表单字段值 |
| `status` | enum: `new` / `in-progress` / `resolved` / `spam` | 处理状态 |
| `note` | text | 内部备注 |
| `source_url` | varchar | 来源页面 |
| `submitted_at` | timestamp | |
| `handled_at` | timestamp | 处理时间（可为 null） |
| `handled_by` | varchar | 处理人备注 |

> **迁移说明：** 一期前台 API（`server/api/contact.post.ts` 等）目前将提交写入本地 `.data/submissions/*.json`。后台接入后，将这三个 server API 改为写入 Directus `form_submissions` collection，原 JSON 文件记录一次性手动导入。

### 2.4 前台读取数据的接口边界

**原则：** 前台组件永远不直接调用 Directus API，必须通过 Nuxt `server/` 层封装的 content adapter。

```
前台 Vue 组件
    ↓ useFetch / useAsyncData
Nuxt server/api/ 或 content adapter
    ↓ 内网 HTTP（服务器内部）
Directus REST API :8055
    ↓
PostgreSQL
```

一期需要新增的 server adapter：

| 文件 | 作用 |
|---|---|
| `server/utils/directus.ts` | Directus client 初始化，读取 `DIRECTUS_URL` 和 `DIRECTUS_TOKEN` |
| `server/api/cms/home.get.ts` | 返回首页内容字段 |
| `server/api/cms/blog/index.get.ts` | 返回已发布 Blog 列表（分页、分类过滤） |
| `server/api/cms/blog/[slug].get.ts` | 返回单篇 Blog 详情 |

现有 `content/fixtures/` 保持不变，作为本地开发无 CMS 时的 fallback；adapter 通过环境变量 `CMS_MODE=directus | fixtures` 切换。

### 2.5 图片从 `public/images/` 迁移到媒体库的方案

**迁移策略（上线前一次性操作，不影响现有代码）：**

1. 将 `public/images/` 下各子目录的图片批量上传到 Directus 媒体库对应 folder；
2. Directus 为每张图片生成 UUID 和服务路径，例如 `/assets/{uuid}.jpg`；
3. 在 `page_home`、`blog_posts` 等 collection 中绑定对应的 `directus_files` 外键；
4. 前台 content adapter 返回图片 URL 时，改为返回 Directus assets 路径；
5. `public/images/` 目录下的 `.gitkeep` 保留，原始图片文件可在 Git 中删除（或保留作为备份，由运维决定）。

**迁移前后对比：**

```
迁移前：/images/home/home-hero-inspection-line.png
迁移后：/assets/3c8a12bc-xxxx-xxxx-xxxx-abcdef012345?width=1920
```

迁移期间前台保持兼容，两种路径均可读取（adapter 层判断）。

### 2.6 本地开发、测试、正式部署差异

| 环境 | CMS 数据来源 | 文件存储 | 说明 |
|---|---|---|---|
| **本地开发** | `fixtures/`（`CMS_MODE=fixtures`） | `public/images/` | 无需 Directus，直接用 fixture 数据 |
| **后台开发/测试** | Directus 本地容器（`CMS_MODE=directus`） | 本地磁盘挂载卷 | `docker-compose.dev.yml` 启动 Directus + PostgreSQL |
| **正式部署** | 腾讯云 Directus 容器 | 腾讯云服务器磁盘或 COS（二期） | `docker-compose.yml` 生产配置，Nginx 反向代理 |

**.env 关键变量（不提交 Git，通过 `.env.example` 记录）：**
```
DIRECTUS_URL=http://directus:8055
DIRECTUS_TOKEN=<static-admin-token>
CMS_MODE=directus
```

---

## 三、一期最小闭环详细设计

### 步骤 A — 管理员登录 + 数据库基础

**工作内容：**
- 在 `docker-compose.yml` 中添加 `directus` 和 `postgres` 服务；
- 初始化 Directus，创建管理员账号（邮箱 + 密码，不存储在代码中）；
- 创建 `page_home`、`blog_posts`、`form_submissions` collections 及所有一期字段；
- Nginx 配置：限制 `/admin/` 路径访问来源 IP；
- 配置 `.env.example`，记录所有必需变量名称（不含真实值）。

**浏览器验收标准：**
- 访问后台 URL → 显示 Directus 登录界面；
- 正确账号密码 → 进入管理界面，左侧菜单显示所有一期 collections；
- 错误密码 → 拒绝登录，无 500 错误；
- 从非允许 IP 访问 → Nginx 返回 403。

---

### 步骤 B — 媒体库

**工作内容：**
- 在 Directus 中创建 folders：`home` / `products` / `applications` / `resources` / `company` / `certifications`；
- 将现有 `public/images/` 下已有图片上传到对应 folder；
- 配置 Directus files 字段：title、description（alt text）、folder 归属；
- 确认 `/assets/{uuid}` 路径可在浏览器访问。

**浏览器验收标准：**
- 管理员进入 Files 模块 → 可看到所有已上传图片按 folder 分组；
- 点击一张图片 → 可查看 URL、尺寸、MIME 类型；
- 上传新图片（PNG/JPG/WebP/PDF）→ 成功入库，可在 folder 中找到；
- 删除一张测试图片 → 从 folder 中消失；
- 访问 `/assets/{uuid}` → 浏览器显示图片，无 401/404。

---

### 步骤 C — 首页内容管理闭环

**工作内容：**
- 在 Directus `page_home` singleton 中录入首页 Hero 字段数据；
- 绑定 Hero 图片（选择媒体库中已上传的 `home-hero-inspection-line.png`）；
- 实现 `server/api/cms/home.get.ts`，返回首页内容 JSON；
- 前台 `pages/index.vue` 的 Hero 区域改为从 API 读取（保持布局不变）；
- 更新 content adapter：`CMS_MODE=fixtures` 时继续读 fixture，`CMS_MODE=directus` 时调用 Directus。

**不允许修改的内容：**
- Hero 的 CSS 布局、z-index 结构、响应式断点；
- 遮罩层渐变参数；
- 两个 CTA 按钮的样式和位置。

**浏览器验收标准：**
- 管理员在 Directus `page_home` 中修改 `hero_title_en` → 保存 → 前台首页刷新后显示新标题；
- 管理员替换 Hero 图片（绑定媒体库中另一张图片）→ 前台刷新后显示新图片；
- 1280px / 375px 布局无变化，文字可读性不受影响；
- `CMS_MODE=fixtures` 时前台仍正常显示（fixture fallback 有效）。

---

### 步骤 D — Blog 发布闭环

**工作内容：**
- 在 Directus `blog_posts` collection 中新建一篇测试文章，状态设为 `draft`；
- 确认草稿不出现在前台列表；
- 改为 `published` → 确认前台 `/resources` 列表出现该文章；
- 实现 `/resources/insights/[slug]` 详情页（目前路由存在但内容未对接 CMS）；
- 实现分页或简单列表；
- 测试 `archived` 状态：文章从列表消失，直接访问 slug 返回 404。

**Blog 字段在 Directus 界面的操作流：**
```
新建文章 → 填写 slug + 标题 + 摘要 + 正文（Rich Text）+ 选封面图 → 填写 SEO 字段
→ 状态设为 draft（预览）→ 状态改为 published（上线）→ 状态改为 archived（下架）
```

**浏览器验收标准：**
- 新建草稿 → 前台列表页不出现；
- 发布 → 前台 `/resources` 列表立即出现该文章卡片（标题、摘要、封面图、日期）；
- 点击卡片 → 进入 `/resources/insights/{slug}` → 显示完整正文和 SEO title；
- 下架 → 列表消失，访问 slug → 404；
- Rich Text 正文中的粗体、列表、外链在前台正确渲染。

---

### 步骤 E — 询盘管理

**工作内容：**
- 修改 `server/api/contact.post.ts`、`spare-parts.post.ts`、`support-request.post.ts`，将写入目标从本地 JSON 文件改为 Directus `form_submissions` collection；
- 将 `.data/submissions/*.json` 现有记录一次性导入 `form_submissions`；
- 在 Directus 界面配置 `form_submissions` 的列表视图：显示 form_id、status、submitted_at、values 摘要；
- 管理员可修改 `status`（new → in-progress → resolved）和填写 `note`；
- 配置 `handled_at` 字段在管理员修改状态时自动记录时间戳（Directus hook 或手动填写）。

**浏览器验收标准：**
- 前台提交 Contact 表单 → Directus `form_submissions` 列表出现新记录，状态为 `new`；
- 管理员打开该记录 → 查看所有表单字段值（name、email、company、message 等）；
- 管理员将状态改为 `resolved`，填写 note → 保存成功；
- 前台提交 Technical Matching 表单 → 同样出现，`form_id` 为 `technical-matching`；
- 垃圾内容可标记为 `spam`，不影响正常记录计数。

---

### 步骤 F — 基础 SEO 字段管理

**工作内容：**
- `page_home` collection 的 `seo_title_en`、`seo_description_en`、`seo_og_image` 字段已在步骤 A 创建；
- `blog_posts` collection 的 SEO 字段已在步骤 A 创建；
- 前台 `useHead()` 调用改为从 CMS 数据读取（当 `CMS_MODE=directus` 时）；
- OG 图片 URL 构建为 Directus assets 路径，带 `width=1200` 查询参数。

**浏览器验收标准：**
- 管理员修改首页 `seo_title_en` → 前台刷新后 `<title>` 标签显示新内容；
- 查看 `<meta name="description">` → 与 Directus 中一致；
- 发布一篇 Blog，填写 SEO 字段 → 访问该文章 URL → `<title>` 和 `<meta>` 正确；
- 用社交媒体预览工具检查 OG 图片 URL → 可访问、尺寸合适。

---

## 四、随后扩展的独立模块

以下模块在一期 A–F 验收完成后，按需逐步开发，**互不依赖，可独立交付**。

### 4.1 Products 模块

**Collections 需新增：**
- `product_categories`：id、slug、title（多语言）、intro（多语言）、hero_image、order、seo
- `products`：id、category_id、slug、name（多语言）、summary（多语言）、hero_image、gallery（图片数组）、highlights（JSONB）、specifications（JSONB）、downloads（关联 `download_assets`）、status、seo

**前台变化：**
- `pages/products/index.vue` 和 `pages/products/[category]/index.vue` 从 fixtures 切换到 CMS adapter；
- `pages/products/[category]/[slug].vue` 读取 CMS 产品详情。

**验收标准：** 管理员在后台新增一个产品 → 前台产品列表立即出现；修改规格表 → 前台详情页更新。

### 4.2 Applications 模块

**Collections 需新增：**
- `applications`：id、slug、title（多语言）、overview（多语言）、challenges（JSONB）、recommended_solutions（关联 product_categories）、hero_image、seo

**验收标准：** 管理员修改某应用场景的挑战描述 → 前台对应页面内容更新。

### 4.3 Resources / Downloads 模块

**Collections 需新增：**
- `download_assets`：id、title（多语言）、file（关联 directus_files）、document_type（datasheet / manual / certificate）、language、related_products、version、publish_date、status

**验收标准：** 管理员上传一份新数据表 PDF → 前台 Downloads 页面立即出现，可点击直接下载（无下载门槛）。

### 4.4 Certificates 模块

**Collections 需新增：**
- `certificates`：id、title（多语言）、cert_image（关联 directus_files）、issuing_body、valid_until、display_order

**验收标准：** 管理员替换 ISO 9001 证书扫描件 → 前台 Quality & Manufacturing 页面图片更新。

### 4.5 Company 页面内容

**Collections 需新增：**
- `company_content`：多个 singleton 字段组，对应 about / quality / global-service 页面的可编辑文本段落和图片。

**验收标准：** 管理员修改 About 页面公司简介段落 → 前台更新。

### 4.6 Distributor / Partner Leads

**Collections 需新增：**
- `distributor_leads`：与 `form_submissions` 结构类似，额外字段：territory、company_type、annual_turnover_range、status（new / qualified / rejected）。

**验收标准：** 前台 Find a Distributor 表单提交 → 记录进入独立列表，与普通 Contact 询盘分开管理。

---

## 五、后台一期开发顺序

### 阶段 1 — 管理员登录 + 数据库基础

**开发任务：**
1. 在 `docker-compose.yml` 新增 `directus` 服务（`directus/directus:latest`）和 `postgres` 服务；
2. 配置 Directus 初始账号（环境变量注入，不写入代码）；
3. 在 Directus 中创建 `page_home`、`blog_posts`、`form_submissions` collections 及全部一期字段；
4. Nginx 配置后台路径 IP 白名单；
5. `.env.example` 记录所有必需变量；
6. `docker-compose.dev.yml` 供本地后台开发使用。

**浏览器验收：**
- 访问后台 URL → Directus 登录界面；
- 正确账号 → 进入管理界面，三个 collections 均可见；
- 错误 IP → 403。

---

### 阶段 2 — 媒体库

**开发任务：**
1. 在 Directus 创建 folder 层级；
2. 将现有 `public/images/` 下图片上传到对应 folder；
3. 为每张图片填写 title 和 description（alt text）；
4. 确认 `/assets/{uuid}` 可访问。

**浏览器验收：**
- 媒体库按 folder 分类显示全部图片；
- 新图片上传成功；
- `/assets/{uuid}` 浏览器直接访问图片。

---

### 阶段 3 — 首页内容闭环

**开发任务：**
1. 在 `page_home` 中录入首页 Hero 现有内容，绑定 Hero 图片；
2. 实现 `server/utils/directus.ts` Directus client；
3. 实现 `server/api/cms/home.get.ts`；
4. 修改 `pages/index.vue` Hero 区域：`CMS_MODE=directus` 时从 API 读取，`fixtures` 时保持现状；
5. 不修改 Hero CSS 和布局。

**浏览器验收：**
- 后台修改标题 → 前台刷新显示新标题；
- 替换 Hero 图片 → 前台更新；
- 1280px / 375px 布局不变。

---

### 阶段 4 — Blog 发布闭环

**开发任务：**
1. 实现 `server/api/cms/blog/index.get.ts`（列表，过滤 `status=published`）；
2. 实现 `server/api/cms/blog/[slug].get.ts`（详情）；
3. 修改 `pages/resources/index.vue` 从 CMS 读取 Blog 列表；
4. 完善 `pages/resources/insights/[slug].vue` 从 CMS 读取文章正文；
5. 配置 Nuxt `generateRoutes` 或 `routeRules` 确保动态 slug 在 SSR 模式下正常；
6. 实现 Rich Text 渲染（Directus 返回 Markdown 或 HTML，前台对应处理）。

**浏览器验收：**
- 草稿不出现在列表；
- 发布 → 立即出现卡片；
- 进入详情页 → 正文、SEO title 正确；
- 下架 → 404。

---

### 阶段 5 — 询盘管理

**开发任务：**
1. 修改 `server/api/contact.post.ts` 写入 Directus `form_submissions`；
2. 修改 `server/api/spare-parts.post.ts` 同上；
3. 修改 `server/api/support-request.post.ts` 同上；
4. 将现有 `.data/submissions/*.json` 手动导入 `form_submissions`；
5. 在 Directus 界面配置列表视图字段和状态筛选器。

**浏览器验收：**
- 前台提交表单 → Directus 出现记录；
- 状态可修改；
- 备注可填写；
- Technical Matching 和 Contact 可通过 `form_id` 区分。

---

### 阶段 6 — 扩展模块（Products / Applications / Resources 等）

按 4.1–4.6 节逐模块推进，每个模块完成后独立验收。

---

## 六、二期功能边界（不在一期讨论范围）

| 功能 | 说明 |
|---|---|
| 多角色权限 | Directus 角色/权限按内容类型细分（编辑、发布、只读） |
| CRM 自动同步 | HubSpot / Salesforce 询盘推送 |
| 统计报表 | 询盘量、页面浏览量、地区分布 |
| 视频上传与转码 | Directus + FFmpeg 或第三方 CDN 视频托管 |
| 公开 AI 对话 | 前台访客 AI 询问产品 |
| Excel 批量导入 | 产品数据、应用场景批量更新 |
| 自动发布与自动邮件 | 定时发布、提交后自动回复 |
| 多站点 / 多品牌 | Directus 多项目支持 |
| 下载门槛 | 填表后才可下载 PDF |

---

## 七、附录：关键文件路径对照

| 文件 | 说明 |
|---|---|
| `content/fixtures/products.ts` | 产品 DEMO 数据，CMS 接入前使用 |
| `content/fixtures/applications.ts` | 应用场景 DEMO 数据 |
| `server/api/contact.post.ts` | Contact 表单 API，阶段 5 改写 |
| `server/api/spare-parts.post.ts` | 零件询盘 API，阶段 5 改写 |
| `server/api/support-request.post.ts` | 技术支持 API，阶段 5 改写 |
| `public/images/` | 现有静态图片，阶段 2 迁移到 Directus |
| `.data/submissions/` | 当前本地 JSON 提交记录，阶段 5 迁移 |
| `docs/IMAGE-ASSET-LIST.md` | 图片命名和尺寸规格，媒体库上传时参考 |
| `.env.example` | 阶段 1 创建，记录所有 CMS 相关变量名 |
