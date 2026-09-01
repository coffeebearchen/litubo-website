# LITUBO 后台内容管理系统 — 一期规格文档

> **版本：** 1.4 — 第 2.8 节补齐产品参数方案、多语言实现方式、全量 M2M Junction 清单与最坏情况预算核算
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
| 基础 SEO | 首页、Blog 文章、产品页面的 title / description / OG 图片 |
| **Products（产品）** | **一期上线必需**：产品分类、型号管理、技术参数、媒体关联、草稿/发布/下架，前台产品列表与详情页实时更新 |

### 1.3 一期范围之外（二期及以后）

以下功能不在一期开发范围，**不得提前实现**：

- 复杂多角色权限（二期）
- CRM 自动同步 / HubSpot（二期）
- 统计报表与访客分析（二期）
- 视频上传与转码（二期）
- 公开 AI 对话（二期）
- Excel 批量导入（二期）
- 自动发布 / 自动邮件（二期）
- Applications / Downloads / Certificates / Company 页面的后台管理（随后扩展模块，见第四章）
- Products 后台管理属于一期范围，但开发顺序在管理员登录、媒体库、首页内容、Blog 发布、询盘管理全部验收通过之后（见第五章阶段 6）

---

## 二、技术设计

### 2.1 推荐实现方式

根据项目已确认技术栈（`docs/project/01-technical-decision.md`），后台采用以下方案：

| 层 | 选型 | 理由 |
|---|---|---|
| 后台 UI | **Directus** 内置管理界面 | 零前端开发量；字段、权限、媒体库开箱即用；可配置工作流和字段级权限 |
| 数据库 | **PostgreSQL** | 与 Directus 原生集成；支持 JSONB 存储多语言字段；已在技术决策中确认 |
| 文件存储 | **宿主机持久化挂载卷**（一期）→ 腾讯云 COS（二期选项） | 详见 2.3 节 |
| 公开 API | Directus REST API（容器内网）+ Nuxt server 层封装 | 前台通过 content adapter 读取，Directus API 不对外暴露；详见 2.4 节 |
| 容器编排 | **Docker Compose**，与现有 Nginx 共存 | 沿用已有运维模型，单独 network 隔离 |

### 2.2 安全边界（强制规则）

#### 访问地址架构

```
公开前台              https://www.litubo.com/
                          ↓ Cloudflare 代理
                       Nginx（腾讯云服务器）
                          ↓
                       Nuxt SSR 服务（:3000）

管理后台              https://admin.litubo.com/   ← 部署时确认是子域还是子路径
                          ↓ Nginx（IP 白名单拦截，不经 Cloudflare 缓存）
                       Directus UI（容器内 :8055）

Directus API          http://directus:8055/       ← 仅容器内网可达，不对外暴露
                          ↑
                       Nuxt server/api/ 函数（服务器内部调用）
                          ↑
                       前台 Vue 组件（useFetch / useAsyncData）
```

**前台数据链路规则（不可绕过）：**
- 前台 Vue 组件**永远不**直接调用 Directus API；
- 唯一合法路径：`Vue 组件 → Nuxt server/api/ → Directus REST API（内网）→ PostgreSQL`；
- Nuxt server 函数对返回数据做字段过滤，不透传 Directus 内部字段（如 `directus_user_id` 等）。

#### Nginx 安全配置要求

- 后台域名或路径仅允许指定 IP 段（办公室/VPN）访问；非白名单 IP 返回 403，不返回 404 或重定向；
- 后台域名不加入 Cloudflare 代理（设为 DNS only），防止缓存管理界面；
- `robots.txt` 的 `Disallow` 规则覆盖后台路径；后台地址不出现在 `sitemap.xml`。

#### 管理员账号与凭据管理

- 一期只创建一个管理员账号，通过 Directus 初始化环境变量注入（`ADMIN_EMAIL` / `ADMIN_PASSWORD`）；
- **密码和 Token 的规则：**

| 变量 | 存放位置 | 是否提交 Git |
|---|---|---|
| `ADMIN_EMAIL` | `.env`（服务器） | **否** |
| `ADMIN_PASSWORD` | `.env`（服务器） | **否** |
| `DIRECTUS_SECRET` | `.env`（服务器） | **否** |
| `DIRECTUS_TOKEN`（Nuxt 用静态 token） | `.env`（服务器） | **否** |
| 以上变量名（不含值） | `.env.example` | **是** |

- 禁止将真实密码或 token 写入任何 `.ts`、`.vue`、`docker-compose.yml` 或文档文件；
- 静态 token 仅在 Directus 数据库中生成，Nuxt server 从 `process.env.DIRECTUS_TOKEN` 读取；
- 禁止在管理界面开启公开注册（`PUBLIC_REGISTRATION=false`）。

### 2.3 媒体文件持久化方案

#### 核心原则

图片和 PDF 文件**必须存储在容器外部的宿主机目录**，以持久化挂载卷方式挂入容器。Docker 容器的可写层在 `docker-compose down --volumes` 或镜像重建时会丢失；文件绝对不能依赖容器层生存。

#### 一期：宿主机持久化挂载卷

```yaml
# docker-compose.yml 示例（片段）
services:
  directus:
    volumes:
      - /data/litubo/uploads:/directus/uploads   # 图片/PDF 上传目录
      - /data/litubo/db:/var/lib/postgresql/data  # PostgreSQL 数据目录（若 pg 在同一 compose）
```

- `/data/litubo/uploads` 是腾讯云服务器上的宿主机目录，**不在 Git 中**；
- 该目录需纳入**服务器级备份**（腾讯云快照或 rsync 到 COS）；
- Docker 升级、镜像拉取、`docker-compose up --build` 均不影响挂载目录的文件；
- `docker-compose down` 不加 `--volumes` 不删除文件；`down --volumes` **会删除 named volume**，因此使用 bind mount（绝对路径）而非 named volume。

#### 环境对照

| 环境 | 上传目录（宿主机路径） | 挂载进容器路径 | 备注 |
|---|---|---|---|
| 本地开发 | `./dev-data/uploads`（项目内，已在 `.gitignore`） | `/directus/uploads` | 开发机本地，丢了重传即可 |
| 腾讯云正式 | `/data/litubo/uploads` | `/directus/uploads` | **纳入服务器快照备份** |

#### 备份策略（一期最低要求）

1. **数据库**：每日 `pg_dump` 导出，存储到 `/data/litubo/backups/`，保留 14 天；
2. **上传文件**：每日 rsync 或腾讯云磁盘快照，保留 7 天；
3. 备份脚本通过 cron 执行，不依赖 Directus 或 Nuxt 服务正常运行。

#### 二期选项：腾讯云 COS 对象存储

Directus 支持通过 storage adapter 将文件直接存储到 S3 兼容的对象存储（腾讯云 COS 支持 S3 API）。迁移时只需更换 Directus 的 `STORAGE_*` 环境变量，前台代码和 URL 结构不变。一期无需实现，但挂载卷方案不阻止此迁移。

---

### 2.4 数据存储结构

> **v1.3 命名更新：** 本节中出现的旧 Collection 名称已按第 2.8 节合并原则替换：`page_home` → `site_content`（以 `page_key` 区分）；`blog_posts` → `posts`（以 `content_type` 区分）；`form_submissions` → `inquiries`（以 `inquiry_type` 区分）；`product_downloads` → 合并入 M2M Junction `products_files`（以 `file_role` 区分）。下方字段设计保留作参考，实际开发以新命名和第 2.8 节预算表为准。

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

### 2.5 前台读取数据的接口边界

**原则：** 前台组件永远不直接调用 Directus API，必须通过 Nuxt `server/` 层封装的 content adapter（已在 2.2 节安全规则中说明）。

一期需要新增的 server adapter：

| 文件 | 作用 |
|---|---|
| `server/utils/directus.ts` | Directus client 初始化，读取 `DIRECTUS_URL` 和 `DIRECTUS_TOKEN` |
| `server/api/cms/home.get.ts` | 返回首页内容字段 |
| `server/api/cms/blog/index.get.ts` | 返回已发布 Blog 列表（分页、分类过滤） |
| `server/api/cms/blog/[slug].get.ts` | 返回单篇 Blog 详情 |
| `server/api/cms/products/index.get.ts` | 返回产品分类列表 |
| `server/api/cms/products/[category].get.ts` | 返回某分类下的已发布产品列表 |
| `server/api/cms/products/[category]/[slug].get.ts` | 返回单个产品详情 |

现有 `content/fixtures/` 保持不变，作为本地开发无 CMS 时的 fallback；adapter 通过环境变量 `CMS_MODE=directus | fixtures` 切换。

### 2.6 图片从 `public/images/` 迁移到媒体库的方案

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

### 2.7 本地开发、测试、正式部署差异

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

### 2.8 Directus Collection 预算与合并原则

#### 2.8.1 许可证限额

LITUBO 使用 **Directus Core（免费方案）**，受以下限制约束：

| 限制项 | 值 |
|---|---|
| 最大自定义 Collection 数 | **25 个** |
| 最大后台用户数 | **3 个** |

> ⚠️ **上线前须以 Directus Admin → Settings → Project 实际显示的授权限额为准复核**，以防版本更新或定价政策变化影响上述数字。

#### 2.8.2 关键架构决策

**决策 1：产品技术参数（specifications）——采用 JSONB Repeater（方案 A）**

`products` Collection 中增加一个 `specifications` 字段，类型为 **JSON / Repeater**，每行结构如下：

```json
{
  "label_en": "Detection Width",
  "label_es": "Ancho de detección",
  "label_pt": "Largura de detecção",
  "value": "500",
  "unit": "mm",
  "display_order": 1,
  "visible": true
}
```

- Directus Repeater 界面原生支持行的新增、删除、拖拽排序；
- 不新增任何额外 Collection；
- 一期无跨产品参数对比筛选需求，JSONB 完全满足；
- 如二期需要跨产品参数检索，可迁移为独立 `product_specifications` Collection（届时再计入预算）。

**决策 2：多语言（EN / ES / PT）——采用扁平列命名**

所有需要多语言的文本字段，在同一 Collection 内以 `_en` / `_es` / `_pt` 后缀区分，例如：

- `products.name_en`、`products.name_es`、`products.name_pt`
- `posts.title_en`、`posts.title_es`、`posts.title_pt`
- `site_content.value_en`、`site_content.value_es`、`site_content.value_pt`

**不使用** Directus 内置翻译功能（Translations Junction）。原因：Directus Translations 功能会为每个启用该功能的 Collection 自动创建一个 `*_translations` Junction 表，每个 Junction 均计入 25 个限额。若对 `products`、`product_categories`、`posts`、`site_content` 4 个 Collection 启用，则额外占用 **4 个**额度，得不偿失。

一期 `_es` 和 `_pt` 字段可为 `null`；前台 adapter 按优先级回退：`_es`/`_pt` → `_en`。后续填充 ES/PT 内容无需任何数据库迁移。

#### 2.8.3 M2M / Junction 表完整清单

Directus 为每个 M2M 关系自动创建 Junction 表，**每个 Junction 均计入 25 个限额**，无论表本身是否有自定义字段。

| Junction 名称 | 关联关系 | 一期状态 | 说明 |
|---|---|---|---|
| `products_files` | `products` ↔ `directus_files` | **一期建立** | 含 `file_role` 字段（`gallery` / `datasheet` / `manual` / `certificate`），替代原 `product_downloads`；计入限额 |
| `products_related` | `products` ↔ `products`（自关联） | **暂不创建** | 一期相关产品以 JSONB 数组存储 slug；如二期需要双向管理，届时申请 |
| `products_applications` | `products` ↔ `applications` | **暂不创建** | `applications` Collection 本身为二期条件性建立；建立前此 Junction 无意义 |
| `posts_tags` | `posts` ↔ `tags` | **暂不创建** | `tags` 集合与此 Junction 均为二期可选；一期标签用枚举字段 |
| `products_translations` | Directus Translations Junction | **永不创建** | 采用扁平列方案，不使用 Directus Translations 功能 |
| `product_categories_translations` | Directus Translations Junction | **永不创建** | 同上 |
| `posts_translations` | Directus Translations Junction | **永不创建** | 同上 |
| `site_content_translations` | Directus Translations Junction | **永不创建** | 同上 |

#### 2.8.4 `site_content` 固定页面覆盖范围

`site_content` 以 `page_key` + `section_key` 两个字段唯一标识每条记录，覆盖以下所有固定页面，**不为任何单页新建独立 Collection**：

| `page_key` | 对应页面路由 | 典型 `section_key` 举例 |
|---|---|---|
| `home` | `/` | `hero`、`intro`、`stats`、`cta` |
| `company-about` | `/company/about` | `mission`、`history`、`team-intro` |
| `company-quality` | `/company/quality` | `certifications`、`process` |
| `company-facilities` | `/company/facilities` | `intro`、`gallery-caption` |
| `company-global` | `/company/global` | `coverage`、`distributors-intro` |
| `contact` | `/contact` | `hero`、`office-address`、`form-intro` |
| `support-spare-parts` | `/support/spare-parts` | `hero`、`form-intro` |
| `support-technical-matching` | `/support/technical-matching` | `hero`、`form-intro` |
| `legal-privacy` | `/legal/privacy` | `body` |
| `legal-terms` | `/legal/terms` | `body` |

如后续新增固定页面，新增 `page_key` 记录即可，无需新建 Collection。

#### 2.8.5 合并原则（禁止拆分）

以下合并规则为强制规则，**不得**因产品类型、内容类别或表单来源增加而拆分：

| 资源类型 | ❌ 禁止做法 | ✓ 正确做法 |
|---|---|---|
| 产品型号 | 每类产品（X-Ray、金属检测等）各建一个 Collection | 统一 `products`，以 `category_id` 外键关联 `product_categories` |
| 博客与资讯 | Insights、Technical Guides、Case Studies、News 各建 Collection | 统一 `posts`，以 `content_type` 枚举字段区分 |
| 表单询盘 | Contact、Technical Matching、Spare Parts、Support 各建 Collection | 统一 `inquiries`，以 `inquiry_type` 枚举字段区分 |
| 媒体文件 | 为产品图片、PDF、质量证书各建 Collection | 使用 Directus 内置 `directus_files` + 文件夹（Folder）分组，**不额外建 Collection** |
| SEO 字段 | 建立全局 SEO Collection | SEO 字段随内容实体（`products`、`posts`、`site_content`）保存在同一 Collection |
| 固定页面 | 每页建一个 singleton Collection | 统一 `site_content`，以 `page_key` + `section_key` 区分；具体 `page_key` 见第 2.8.4 节 |
| 应用场景 / 下载 / 证书 / 合作伙伴 | 默认提前建立 Collection | **仅当**确定需要独立的、有结构化筛选的前台列表页面时，方可申请新建 Collection |
| 产品技术参数 | 建立独立 `product_specifications` Collection | `products.specifications` JSONB Repeater 字段；见第 2.8.2 节 |
| 多语言内容 | 启用 Directus Translations（产生 `*_translations` Junction 表） | 扁平列命名（`_en` / `_es` / `_pt`）；见第 2.8.2 节 |

**新增 Collection 的审批规则（硬性约束）：** 任何新 Collection 在开发前必须：

1. 在预算表中新增一行，注明用途和预计数量；
2. 说明为何无法通过现有 Collection 的类型字段或 JSONB 字段解决；
3. 确认最坏情况总数仍 ≤ 23（保留至少 2 个真实余量）；
4. 经明确确认后方可开始开发。

#### 2.8.6 计数规则说明

**不计入** 25 个限额的内容：

- Directus 内置系统 Collection（`directus_users`、`directus_files`、`directus_folders`、`directus_roles` 等）；
- 文件夹（Folder）：可自由创建用于媒体分组，不占用额度。

**计入** 25 个限额的内容：

- 通过 Settings → Data Model 创建的所有自定义 Collection；
- Directus 为 M2M 关系**自动创建的 Junction 表**——每个 M2M 关系对应一个 Junction，每个均占用一个额度，无论是否有自定义字段。

#### 2.8.7 预算核算

**已规划实际 Collection（一期确定建立）**

| 序号 | Collection 名称 | 类型 | 说明 |
|---|---|---|---|
| 1 | `products` | 主 Collection | 所有产品型号 |
| 2 | `product_categories` | 主 Collection | 5 条分类定义 |
| 3 | `products_files` | M2M Junction | 产品 ↔ 文件；含 `file_role` |
| 4 | `posts` | 主 Collection | 全部博客与资讯 |
| 5 | `inquiries` | 主 Collection | 全部表单询盘 |
| 6 | `site_content` | 主 Collection | 所有固定页面内容 |

**一期确定建立小计：6 个**

---

**二期条件性 Collection（确认需要时再建）**

| 序号 | Collection 名称 | 类型 | 触发条件 |
|---|---|---|---|
| 7 | `applications` | 主 Collection | 需要独立可筛选前台列表 |
| 8 | `partners` | 主 Collection | 需要公开合作伙伴查询页 |
| 9 | `certificates` | 主 Collection | 需要独立证书目录页 |
| 10 | `download_assets` | 主 Collection | 需要通用资料下载库 |

**二期条件性小计（若全部建立）：4 个**

---

**二期若建立关系 Collection 所需 Junction**

| 序号 | Junction 名称 | 触发条件 |
|---|---|---|
| 11 | `products_related` | 需要双向相关产品管理 |
| 12 | `products_applications` | `applications` Collection 建立后 |

**二期 Junction 小计（若全部建立）：2 个**

---

**永不计入（已明确排除）**

| 名称 | 原因 |
|---|---|
| `products_translations` 等 4 个翻译 Junction | 采用扁平列方案，Directus Translations 功能不启用 |
| `product_specifications` Collection | 采用 JSONB Repeater，不建立独立 Collection |
| `posts_tags` / `tags` | 一期不建标签系统；如需建立须重新核算 |

---

**最坏情况核算（所有条件性项均建立）**

| 分项 | 数量 |
|---|---|
| 一期确定建立 | 6 |
| 二期条件性主 Collection（全建） | 4 |
| 二期条件性 Junction（全建） | 2 |
| 多语言 Junction（永不建立） | 0 |
| `product_specifications` Collection（永不建立） | 0 |
| **最坏情况总数** | **12** |
| Directus Core 硬限额 | 25 |
| **最坏情况余量** | **13** |

> **结论：** 即使一期 + 二期所有条件性 Collection 全部建立，最坏情况总数为 **12 个**，远低于 23 个上限，余量 **13 个**，满足"至少保留 2 个真实余量"的硬性约束。
>
> ⚠️ **上线前须以 Directus 实际授权界面复核限额数字，以防版本更新改变政策。**

---

## 三、一期最小验收闭环——两条不可拆分链路

在进入详细步骤设计之前，先明确一期后台上线的**最终交付物**是以下两条完整链路能够端到端跑通。每条链路中的每一步都是必需的，任何一步不通，链路即视为未完成。

---

### 链路 A — 媒体与首页内容管理闭环

```
管理员登录 Directus 后台
    ↓
进入 Files（媒体库）→ 上传或选择图片
    ↓
进入 page_home（首页内容）→ 替换 Hero 图片绑定 / 修改标题文字 / 修改 CTA 文本 → 保存
    ↓
打开前台 https://www.litubo.com/（或本地 localhost:3000）
    ↓
刷新页面 → Hero 区域显示新图片 + 新文字 + 新 CTA，布局和遮罩不变
```

**链路 A 验收标准（必须全部通过）：**
1. 管理员账号密码正确 → 进入 Directus 管理界面，无需联系开发人员；
2. 上传一张新 PNG/JPG → 在媒体库 `home` folder 中可见，`/assets/{uuid}` 可在浏览器直接访问；
3. 在 `page_home` 中将 Hero 图片换绑为刚上传的新图 → 保存；
4. 前台首页刷新 → Hero 背景图变为新图片；
5. 在 `page_home` 中修改 `hero_title_en` → 保存 → 前台首页标题更新；
6. 1280px 和 375px 下布局、遮罩、CTA 按钮样式无变化；
7. `CMS_MODE=fixtures` 时前台仍正常显示（fallback 有效，不依赖 Directus 也不崩溃）。

---

### 链路 B — Blog 内容发布闭环

```
管理员登录 Directus 后台
    ↓
进入 blog_posts → 新建文章 → 填写 slug / 标题 / 摘要 / 正文 / 封面图 / SEO 字段
    ↓
状态设为 draft → 保存
    ↓
打开前台 /resources → 确认该文章不出现（草稿不公开）
    ↓
回到 Directus → 状态改为 published → 保存
    ↓
打开前台 /resources → 文章卡片出现（标题 / 摘要 / 封面图 / 日期）
    ↓
点击卡片 → 进入 /resources/insights/{slug} → 显示完整正文 + SEO title
    ↓
回到 Directus → 状态改为 archived → 保存
    ↓
前台 /resources 卡片消失；直接访问 /resources/insights/{slug} → 返回 404
```

**链路 B 验收标准（必须全部通过）：**
1. 草稿状态 → 前台列表不出现；
2. 发布 → 前台列表立即出现卡片，含标题、摘要、封面图（媒体库图片）、发布日期；
3. 进入详情页 → Rich Text 正文正确渲染（粗体、列表、外链）；
4. 浏览器 `<title>` 标签 = Directus 中设置的 `seo_title_en`；
5. `<meta name="description">` = `seo_description_en`；
6. 下架 → 列表消失，slug 返回 404，不返回空白页或 500；
7. ES / PT 字段为空时前台降级显示 EN 内容，不报错。

---

## 四、一期最小闭环详细设计

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

## 五、一期 Products 模块详细设计

Products 是一期上线必需模块。开发顺序排在管理员登录、媒体库、首页内容闭环、Blog 发布闭环、询盘管理全部验收通过之后（见第六章阶段 6）。

### 5.1 Products 数据模型

#### `product_categories`（产品分类）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | varchar | 业务 id（如 `cat-xray`） |
| `slug` | varchar unique | URL 标识，与现有路由完全一致（见路由文档） |
| `title_en` | varchar | 分类名称 EN（必填） |
| `title_es` | varchar | 分类名称 ES（可为空，降级显示 EN） |
| `title_pt` | varchar | 分类名称 PT |
| `intro_en` | text | 分类简介 EN |
| `intro_es` | text | 分类简介 ES |
| `intro_pt` | text | 分类简介 PT |
| `hero_image` | 外键 → `directus_files` | 分类列表卡片主图 |
| `display_order` | integer | 排列顺序 |
| `seo_title_en` | varchar | |
| `seo_description_en` | text | |
| `seo_og_image` | 外键 → `directus_files` | |

> 分类 slug 固定为：`x-ray-inspection` / `metal-detection` / `checkweighers` / `combination-inspection` / `conveyors-reject-systems`，与前台路由 `[category]` 参数完全对应，**不可更改**。

#### `products`（产品型号）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID | 主键 |
| `category_id` | 外键 → `product_categories` | 所属分类 |
| `slug` | varchar unique | 产品页 URL 标识 |
| `status` | enum: `draft` / `published` / `archived` | 发布状态 |
| `name_en` | varchar | 产品型号名称 EN（必填） |
| `name_es` | varchar | |
| `name_pt` | varchar | |
| `summary_en` | text | 列表摘要 EN（必填） |
| `summary_es` | text | |
| `summary_pt` | text | |
| `body_en` | text (rich text) | 产品正文详情 EN |
| `body_es` | text | |
| `body_pt` | text | |
| `hero_image` | 外键 → `directus_files` | 产品详情页主图 |
| `gallery` | M2M → `directus_files` | 详情图集（多张，可排序） |
| `highlights` | JSONB | 核心卖点列表，结构：`[{ icon, title_en, body_en, title_es, body_es, title_pt, body_pt }]` |
| `specifications` | JSONB | 技术参数表，结构：`[{ label_en, value, unit }]`（行数组，可排序） |
| `applications` | JSON array of slugs | 适用应用场景 slug（关联 applications 模块） |
| `related_products` | M2M → `products` | 相关产品 |
| `cta_primary_label_en` | varchar | 默认"Talk to an engineer" |
| `cta_secondary_label_en` | varchar | 默认"Find a distributor" |
| `seo_title_en` | varchar | |
| `seo_description_en` | text | |
| `seo_og_image` | 外键 → `directus_files` | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

#### `product_downloads`（产品资料关联，可选）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID | |
| `product_id` | 外键 → `products` | |
| `file` | 外键 → `directus_files` | PDF 文件 |
| `title_en` | varchar | 文件显示名 |
| `document_type` | enum: `datasheet` / `manual` / `certificate` | |
| `language` | varchar | `en` / `es` / `pt` / `all` |
| `display_order` | integer | |

### 5.2 Products 一期范围确认

一期 Products 后台**必须支持**：

- [x] 新建、编辑产品（草稿 / 发布 / 下架）；
- [x] 产品分类（固定分类，不可在后台增删分类 slug，只能编辑内容）；
- [x] 型号名称、简介、正文（Rich Text）；
- [x] 核心卖点（highlights）：可在后台逐条添加、编辑、排序；
- [x] 技术参数表（specifications）：可在后台逐行添加 label / value / unit、排序；
- [x] 主图（hero_image）、详情图集（gallery）与媒体库关联；
- [x] PDF 资料与媒体库关联（product_downloads）；
- [x] 应用行业标记（applications slug 列表）；
- [x] 相关产品关联；
- [x] CTA 文本（一期可用默认值，管理员可覆盖）；
- [x] 页面 title / description / OG 图片（SEO 字段）；
- [x] EN / ES / PT 字段预留，一期只要求 EN 必填，ES / PT 可为空；
- [x] 发布后前台 `/products`（分类列表）与 `/products/[category]/[slug]`（详情页）立即更新。

一期**不要求**：
- 产品对比功能；
- 产品搜索索引（由 Blog+Products 内容积累后二期处理）；
- 批量导入。

### 5.3 Products 前台对接

**需修改的前台文件（后台开发阶段进行）：**
- `pages/products/index.vue` — 从 fixtures 切换到 CMS adapter；
- `pages/products/[category]/index.vue` — 从 fixtures 切换到 CMS adapter；
- `pages/products/[category]/[slug].vue` — 从 fixtures 切换到 CMS adapter，渲染 highlights、specifications、gallery、downloads。

**新增 server adapter 文件：**
- `server/api/cms/products/index.get.ts` — 返回分类列表（含 hero_image URL）；
- `server/api/cms/products/[category].get.ts` — 返回该分类下 `status=published` 产品列表；
- `server/api/cms/products/[category]/[slug].get.ts` — 返回产品详情全量字段。

### 5.4 Products 浏览器验收标准

1. 管理员在 Directus 新建一个产品，状态设为 `draft` → 前台 `/products` 不出现该产品；
2. 状态改为 `published` → 前台对应分类列表立即出现该产品卡片（名称、摘要、主图）；
3. 点击产品卡片 → 进入详情页，显示：主图、标题、正文、核心卖点、技术参数表、图集、PDF 下载链接；
4. 管理员在 Directus 修改技术参数一行 → 前台详情页刷新后更新；
5. 在 Directus 上传新图片并加入该产品 gallery → 前台详情页图集更新；
6. 在 Directus 上传 PDF 并关联到该产品 → 前台详情页出现下载链接，点击可直接下载（无门槛）；
7. 状态改为 `archived` → 列表消失，直接访问 slug → 404；
8. 浏览器 `<title>` 和 `<meta name="description">` 与 Directus SEO 字段一致；
9. 375px / 768px / 1280px 各断点布局无溢出，技术参数表在移动端可横向滚动或自适应。

---

## 六、随后扩展的独立模块（一期之后）

以下模块在一期 A–F 及 Products 全部验收完成后，按需逐步开发，**互不依赖，可独立交付**。

### 6.1 Applications 模块

**Collections 需新增：**
- `applications`：id、slug、title（多语言）、overview（多语言）、challenges（JSONB）、recommended_solutions（关联 product_categories）、hero_image、seo

**验收标准：** 管理员修改某应用场景的挑战描述 → 前台对应页面内容更新。

### 6.2 Resources / Downloads 模块

**Collections 需新增：**
- `download_assets`：id、title（多语言）、file（关联 directus_files）、document_type（datasheet / manual / certificate）、language、related_products、version、publish_date、status

**验收标准：** 管理员上传一份新数据表 PDF → 前台 Downloads 页面立即出现，可点击直接下载（无下载门槛）。

### 6.3 Certificates 模块

**Collections 需新增：**
- `certificates`：id、title（多语言）、cert_image（关联 directus_files）、issuing_body、valid_until、display_order

**验收标准：** 管理员替换 ISO 9001 证书扫描件 → 前台 Quality & Manufacturing 页面图片更新。

### 6.4 Company 页面内容

**Collections 需新增：**
- `company_content`：多个 singleton 字段组，对应 about / quality / global-service 页面的可编辑文本段落和图片。

**验收标准：** 管理员修改 About 页面公司简介段落 → 前台更新。

### 6.5 Distributor / Partner Leads

**Collections 需新增：**
- `distributor_leads`：与 `form_submissions` 结构类似，额外字段：territory、company_type、annual_turnover_range、status（new / qualified / rejected）。

**验收标准：** 前台 Find a Distributor 表单提交 → 记录进入独立列表，与普通 Contact 询盘分开管理。

---

## 七、后台一期开发顺序

### 阶段 1 — 管理员登录 + 数据库基础

**开发任务：**
1. 在 `docker-compose.yml` 新增 `directus` 服务（`directus/directus:latest`）和 `postgres` 服务；
2. 配置 Directus 初始账号（环境变量注入，不写入代码）；
3. 在 Directus 中创建所有一期 collections：`page_home`、`blog_posts`、`form_submissions`、`product_categories`、`products`、`product_downloads`；
4. Nginx 配置后台路径 IP 白名单；
5. `.env.example` 记录所有必需变量；
6. `docker-compose.dev.yml` 供本地后台开发使用。

**浏览器验收：**
- 访问后台 URL → Directus 登录界面；
- 正确账号 → 进入管理界面，所有 collections 均可见；
- 错误 IP → 403。

---

### 阶段 2 — 媒体库

**开发任务：**
1. 在 Directus 创建 folder 层级（`home` / `products` / `applications` / `resources` / `company` / `certifications`）；
2. 将现有 `public/images/` 下图片上传到对应 folder；
3. 为每张图片填写 title 和 description（alt text）；
4. 确认 `/assets/{uuid}` 路径可在浏览器访问。

**浏览器验收：**
- 媒体库按 folder 分类显示全部图片；
- 新图片（PNG/JPG/WebP）和 PDF 上传成功；
- `/assets/{uuid}` 浏览器直接访问，无 401/404。

---

### 阶段 3 — Products 产品管理闭环

**开发任务：**
1. 在 Directus `product_categories` 中录入全部 5 个分类内容，绑定 hero_image，确认排序；
2. 新建一个测试产品，填写名称、简介、正文、核心卖点、技术参数，上传主图（选自媒体库），上传 PDF 并关联到 `product_downloads`；
3. 实现 `server/utils/directus.ts` Directus client（若尚未创建）；
4. 实现 `server/api/cms/products/index.get.ts`、`[category].get.ts`、`[category]/[slug].get.ts`；
5. 修改 `pages/products/index.vue`、`pages/products/[category]/index.vue`、`pages/products/[category]/[slug].vue`，切换到 CMS adapter；
6. `CMS_MODE=fixtures` 时保持 fixture fallback 有效。

**浏览器验收：**
1. 管理员在 Directus 新建产品，状态设为 `draft` → 前台 `/products` 不出现该产品；
2. 状态改为 `published` → 前台对应分类列表立即出现该产品卡片（名称、摘要、主图）；
3. 点击产品卡片 → 进入详情页，显示：主图、标题、正文、核心卖点、技术参数表；
4. 管理员上传新主图并绑定到该产品 → 前台详情页刷新后图片更新；
5. 管理员录入一行技术参数（label / value / unit）→ 前台详情页刷新后出现该参数；
6. 管理员上传 PDF 并关联到该产品 → 前台详情页出现下载链接，点击可直接下载（无门槛）；
7. 状态改为 `archived` → 列表消失，直接访问 slug → 404；
8. 浏览器 `<title>` 和 `<meta name="description">` 与 Directus SEO 字段一致；
9. 375px / 768px / 1280px 各断点无溢出。

---

### 阶段 4 — 首页内容闭环

**开发任务：**
1. 在 `page_home` 中录入首页 Hero 现有内容，绑定 Hero 图片（选自媒体库）；
2. 实现 `server/api/cms/home.get.ts`；
3. 修改 `pages/index.vue` Hero 区域：`CMS_MODE=directus` 时从 API 读取，`fixtures` 时保持现状；
4. 不修改 Hero CSS 和布局。

**浏览器验收：**
- 后台修改 `hero_title_en` → 前台刷新显示新标题；
- 替换 Hero 图片绑定 → 前台更新；
- 1280px / 375px 布局、遮罩、CTA 不变。

---

### 阶段 5 — Blog 发布闭环

**开发任务：**
1. 实现 `server/api/cms/blog/index.get.ts`（列表，过滤 `status=published`）；
2. 实现 `server/api/cms/blog/[slug].get.ts`（详情）；
3. 修改 `pages/resources/index.vue` 从 CMS 读取 Blog 列表；
4. 完善 `pages/resources/insights/[slug].vue` 从 CMS 读取文章正文；
5. 配置 Nuxt `routeRules` 确保动态 slug 在 SSR 模式下正常；
6. 实现 Rich Text 渲染（Directus 返回 Markdown 或 HTML，前台对应处理）。

**浏览器验收：**
- 草稿不出现在列表；
- 发布 → 前台 `/resources` 立即出现文章卡片（标题、摘要、封面图、日期）；
- 进入详情页 → 正文、SEO title 正确；
- 下架 → 列表消失，slug → 404。

---

### 阶段 6 — 询盘管理

**开发任务：**
1. 修改 `server/api/contact.post.ts` 写入 Directus `form_submissions`；
2. 修改 `server/api/spare-parts.post.ts` 同上；
3. 修改 `server/api/support-request.post.ts` 同上；
4. 将现有 `.data/submissions/*.json` 手动导入 `form_submissions`；
5. 在 Directus 界面配置列表视图字段和状态筛选器。

**浏览器验收：**
- 前台提交表单 → Directus 出现记录，状态为 `new`；
- 管理员可查看所有字段值，修改状态，填写备注；
- Technical Matching 和 Contact 可通过 `form_id` 区分。

---

### 阶段 7 — 基础 SEO

**开发任务：**
1. 前台 `useHead()` 全面切换为从 CMS 数据读取（`CMS_MODE=directus`）；
2. 覆盖范围：首页、所有 Blog 文章页、所有产品详情页；
3. OG 图片 URL 构建为 Directus assets 路径，带 `width=1200` 查询参数。

**浏览器验收：**
- 修改首页 `seo_title_en` → 前台 `<title>` 更新；
- 访问 Blog 文章或产品页 → `<title>` / `<meta description>` / OG 图片 URL 与 Directus 字段一致；
- 社交媒体预览工具检查 OG 图片 → 可访问。

---

### 阶段 8 — 扩展模块（Applications / Downloads / Certificates / Company 等）

按第六章 6.1–6.5 节逐模块推进，每个模块完成后独立验收。

---

## 八、二期功能边界（不在一期讨论范围）

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

## 九、附录：关键文件路径对照

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
