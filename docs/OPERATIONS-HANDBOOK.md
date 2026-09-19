# LITUBO 网站运营操作手册

> 适用版本：阶段 1–6 已完成后的生产系统  
> 维护责任人：LITUBO 市场与销售团队  
> 技术支持：开发团队  
> 最后更新：2026-09

---

## 目录

1. [基础与登录](#1-基础与登录)
2. [媒体库管理](#2-媒体库管理)
3. [产品管理](#3-产品管理)
4. [首页 Hero 管理](#4-首页-hero-管理)
5. [Blog / FAQ / 知识库管理](#5-blog--faq--知识库管理)
6. [询盘管理](#6-询盘管理)
7. [备份与恢复](#7-备份与恢复)
8. [未来 HubSpot / AI 集成](#8-未来-hubspot--ai-集成)
9. [上线前清单](#9-上线前清单)

---

## 1. 基础与登录

### Directus 是什么

Directus 是本网站的内容管理系统（CMS）。它运行在腾讯云服务器上，通过 Docker 容器启动。运营团队在 Directus 后台新建和编辑内容，Nuxt 前台网站通过 API 读取并展示这些内容。

Directus 后台不对公网开放，也没有独立的后台域名：它只监听服务器本机的 `127.0.0.1:8055`。生产环境只能在管理员本机建立 SSH 隧道后访问 `http://localhost:8055/admin`（`docs/ADMIN-CMS-SETUP.md` §6.2 / §7）。

### 本地开发环境登录

在开发机上启动本地 CMS：

```bash
docker compose up -d
```

浏览器打开 `http://localhost:8055`，使用开发管理员账号登录。开发账号仅限本地使用，不共享密码。

### 哪些系统设置不要碰

以下操作**只有开发人员才可以执行**，运营团队不要触碰：

| 禁止操作 | 原因 |
|---------|------|
| 修改 Roles / Policies / Permissions | 权限矩阵已精确配置，误改会导致前台报 403 或数据泄露 |
| 删除或重命名 Collection | 会破坏 API 结构，前台立即崩溃 |
| 新建或删除字段 | 同上，且可能导致数据库迁移错误 |
| 修改 Webhooks 或 Flows | 影响自动化逻辑 |
| 修改 nuxt-server 服务账号 | 该账号是前台唯一数据读取通道 |
| 直接修改数据库（psql） | 绕过 CMS 校验，风险极高 |

### 管理员密码忘记后的处理原则

1. **不要**尝试自行修改数据库密码字段。
2. 联系有服务器访问权限的开发人员。
3. 开发人员通过 `docker exec` 进入容器，使用 Directus CLI 重置管理员密码。
4. 新密码通过安全渠道（而非明文邮件）传递给运营人员。
5. 登录后立即在个人资料页修改为强密码。

---

## 2. 媒体库管理

### 16 个文件夹用途

| 文件夹 | 存放内容 |
|--------|---------|
| `products/hero` | 产品详情页顶部主图（比例 16:9 或 4:3） |
| `products/gallery` | 产品详情页图集轮播图 |
| `products/thumbnails` | 产品列表卡片缩略图 |
| `products/datasheets` | 产品规格说明书 PDF |
| `products/certificates` | 产品认证文件 PDF |
| `applications/hero` | 应用场景页顶部主图 |
| `applications/gallery` | 应用场景图集 |
| `blog/covers` | 文章、案例、FAQ 的封面图 |
| `blog/inline` | 文章正文内嵌图片 |
| `homepage/hero` | 首页 Hero 背景图 |
| `homepage/sections` | 首页各功能模块配图 |
| `company/about` | 公司介绍页图片 |
| `company/team` | 团队成员照片 |
| `downloads/brochures` | 企业宣传册、产品目录 PDF |
| `downloads/case-studies` | 案例研究 PDF |
| `misc` | 其他临时文件，定期清理 |

### 图片命名规则

- 全小写英文，单词之间用连字符（`-`），不用空格或下划线
- 包含描述性前缀：`xi-700-hero.jpg`、`metal-detector-gallery-01.jpg`
- PDF 加版本后缀：`xi-700-datasheet-v2.pdf`
- 禁止使用：`图片1.jpg`、`image(1).jpg`、`final_FINAL.png`

### 上传规则

- 图片推荐格式：JPEG（照片）、PNG（带透明）、WebP（体积最优）
- 图片宽度不超过 3000px，单文件不超过 3 MB
- PDF 单文件不超过 20 MB
- 上传前在本地确认文件未损坏、可正常打开

### 替换与删除规则

**替换文件**：不要删除旧文件后上传新文件。正确做法：
1. 上传新文件到同一文件夹
2. 在引用该文件的 Collection（如产品、文章）中更新图片字段
3. 确认前台已显示新图片后，再删除旧文件

**删除文件**：删除前必须确认该文件没有被任何 Collection 引用。检查方法：
1. 在 Directus 媒体库中打开文件详情
2. 查看右侧"Used In"列表
3. 只有"Used In"为空时才可删除

### is_public 的含义

每个文件都有一个 `is_public` 开关（在文件自定义字段中）。

- `is_public = true`：文件可通过前台公开媒体地址 `/api/cms/media/<文件 id>` 访问，适用于需要在网页展示的图片和 PDF。该地址每次请求都会重新检查：文件必须 `is_public = true` 且未在 Media Library 归档
- `is_public = false`：文件只有管理员可见，适用于内部文件

**规则**：所有上传到前台使用的图片和 PDF，必须将 `is_public` 设为 `true`，否则前台该地址返回 404（图片不显示）；已归档的文件同样返回 404。

### 绝对不要删除

已被以下地方引用的文件严禁删除：
- 任何 `products` 记录的 hero_image、gallery、datasheet、certificate 字段
- `site_content` 的首页 Hero 图片
- 任何 `posts` 记录的 cover_image 字段
- 正文中已链接的内联图片

---

## 3. 产品管理

### 新建产品

1. 进入 **Content → Products**
2. 点击右上角 **+** 新建
3. 填写必填字段（标有 `*` 的）：
   - `name`：产品英文名称
   - `slug`：URL 路径（纯英文小写加连字符，如 `x-ray-inspection-xi700`），全局唯一
   - `category`：选择已有分类
4. 将 `status` 设为 `draft`（草稿），点击保存

### 草稿与发布

- **草稿（draft）**：前台不可见，可反复编辑
- **已发布（published）**：前台立即可见
- **已下架（archived）**：前台不可见，数据保留

发布前请检查：
- 所有图片已上传且 `is_public = true`
- SEO 标题和描述已填写
- 产品参数和描述完整
- slug 唯一，无中文或特殊字符

将 `status` 改为 `published` 后保存，前台 5 分钟内（Cloudflare 缓存刷新后）生效。

### 产品各字段说明

| 字段 | 说明 | 是否必填 |
|------|------|---------|
| `name` | 产品英文名 | ✅ |
| `slug` | URL 路径标识符 | ✅ |
| `category` | 产品分类（关联 product_categories） | ✅ |
| `status` | draft / published / archived | ✅ |
| `short_description` | 列表页简短描述（100 字以内） | 推荐 |
| `hero_image` | 详情页顶部主图 | 推荐 |
| `gallery` | 图集（关联 products_files） | 可选 |
| `datasheet` | 产品规格 PDF | 可选 |
| `certificate` | 认证文件 PDF | 可选 |
| `seo_title` | 页面 title 标签 | 推荐 |
| `seo_description` | meta description | 推荐 |
| `specifications` | JSON 格式参数表 | 可选 |

### 发布后前台变化

产品发布后：
- 产品列表页新增该产品卡片
- 产品详情页可通过 `/products/[slug]` 访问
- Technical Matching 表单的"产品兴趣"列表可能包含该产品名称（如果 TM 列表从 CMS 读取）

### 哪些事情不需要开发人员

- 新建、编辑、发布、下架产品
- 修改产品文本内容、参数、图片、PDF
- 修改 SEO 标题和描述

### 哪些情况必须联系开发人员

- 需要新增产品字段（如新增一个"功能视频"字段）
- 需要修改产品详情页的布局或样式
- 需要更改分类结构（重命名 category slug 会导致 URL 404）
- 产品发布后前台 24 小时仍未显示

---

## 4. 首页 Hero 管理

### 可编辑字段

进入 **Content → Site Content**，找到 `key = homepage_hero` 的记录（应只有一条）：

| 字段 | 内容 | 字符建议 |
|------|------|---------|
| `headline` | 主标题 | 不超过 60 字符 |
| `subheadline` | 副标题/描述语 | 不超过 120 字符 |
| `cta_label` | 按钮文字 | 不超过 20 字符 |
| `cta_url` | 按钮跳转链接 | 站内路径如 `/technical-matching` |
| `hero_image` | 背景图 | 见图片规格 |

Hero 背景图规格：
- 最小宽度 1920px，最大 3000px
- 比例约 16:6 至 16:7（宽幅横图）
- 格式：JPEG 或 WebP
- 文件大小不超过 2 MB

### 绝对不可修改的规则

以下内容**不由 CMS 控制**，修改需要开发人员改代码，运营不要自行尝试：

- Hero 版式结构（文字左/右对齐、渐变层、全屏高度）
- 字体、字号、颜色（由设计系统统一管理）
- 按钮样式（形状、颜色、hover 效果）
- 图片裁切方式（由 CSS object-fit 控制）
- 移动端展示逻辑

**背景图替换原则**：即使图片尺寸不理想，也不要在 Photoshop 里强行拉伸，这会导致人物或产品变形。请提供符合比例的图片，或联系摄影师补拍。

### fixtures 与 CMS 模式说明

网站有两种内容模式，由服务器环境变量控制：

- **`CMS_MODE=directus`**：从 Directus 实时读取内容（生产模式）
- **`CMS_MODE=fixtures`**：从本地硬编码数据读取（开发离线模式）

运营人员在后台修改内容后，只有服务器运行在 `directus` 模式下才会生效。如果修改了 CMS 内容但前台没有变化，请联系开发人员确认当前运行模式。

---

## 5. Blog / FAQ / 知识库管理

### content_type 与 topics 的区别

所有文章统一存储在 **Content → Posts** Collection 中，通过两个字段区分类型：

**`content_type`（内容类型）**——文章的形式：

| 值 | 含义 |
|----|------|
| `blog` | 博客文章、行业洞见 |
| `case_study` | 客户案例研究 |
| `knowledge` | 技术知识库、白皮书 |
| `faq` | 常见问题 |
| `news` | 公司新闻 |

**`topics`（话题标签）**——文章的应用领域，一篇文章可选多个：

- `x-ray`、`metal-detection`、`checkweighing`
- `packaged-food`、`meat-seafood`、`frozen-food` 等
- 与产品分类和应用页面保持对应

### FAQ 的 faq_group

FAQ 类型的文章需要额外填写 `faq_group` 字段，用于将同类 FAQ 分组展示：

| faq_group 值 | 显示区域 |
|-------------|---------|
| `products` | 产品相关 FAQ |
| `service` | 服务支持 FAQ |
| `ordering` | 采购/询价 FAQ |
| `general` | 通用 FAQ |

FAQ 的标题应为完整的疑问句（如"X 光机可以检测液体中的异物吗？"）。

### 如何发布文章

1. 进入 **Content → Posts**，点击 **+** 新建
2. 填写必填字段：
   - `title`：文章标题（英文）
   - `slug`：URL 路径（如 `x-ray-vs-metal-detection-comparison`）
   - `content_type`：选择文章类型
   - `locale`：选择语言（en / es / pt）
3. 填写正文（`body` 字段，Markdown 或富文本）
4. 上传封面图（`cover_image`）
5. 选择 `topics` 话题标签
6. 将 `status` 保持为 `draft` 直到内容审核完毕
7. 确认无误后将 `status` 改为 `published`

### 正文图片

正文内嵌图片的步骤：
1. 先将图片上传到媒体库的 `blog/inline` 文件夹
2. 确认 `is_public = true`
3. 在正文中使用 Markdown 格式引用：`![图片说明](/assets/图片ID)`
4. 图片宽度建议不超过 1200px

### 草稿 / 发布 / 下架规则

| 状态 | 前台表现 |
|------|---------|
| `draft` | 不可见 |
| `published` | 可见，出现在列表和搜索 |
| `archived` | 不可见，数据保留，可恢复 |

已发布文章下架后，原 URL 会返回 404。如需保留 SEO 权重，应联系开发人员配置重定向。

### 严禁批量发布低质量 AI 内容

以下行为会损害 LITUBO 品牌和 SEO，严格禁止：

- 将 AI 生成的未经审核文章批量设为 published
- 发布重复或高度相似的文章
- 使用 AI 生成的虚假客户案例、数字或认证声明
- 发布未经技术人员确认的产品规格内容

所有文章发布前需经过人工审核和事实核查。

---

## 6. 询盘管理

### 新询盘怎样看

每当前台有人提交任何联系表单，系统都会在 **Content → Inquiries** 中生成一条新记录，status 默认为 **New（新建）**。

如果 SMTP 邮件已配置（见第 8 章），销售/技术团队还会收到邮件通知。邮件中只包含询盘类型和记录 ID，不包含联系人详情，需登录 Directus 后台查看完整信息。

**查看新询盘的流程**：
1. 登录 Directus 后台
2. 进入 Content → Inquiries
3. 按 `created_at` 降序排列，或按 `status = new` 过滤
4. 点击记录查看详情

### status、note、assigned_to 字段使用

| 字段 | 用途 | 操作人 |
|------|------|--------|
| `status` | 当前处理状态 | 销售/客服 |
| `note` | 内部跟进备注（客户不可见） | 销售/客服 |
| `assigned_to` | 负责跟进的员工 | 销售主管 |

**status 字段的值**：

| 值 | 含义 | 建议操作 |
|----|------|---------|
| `new` | 新询盘，未处理 | 尽快查看并回复 |
| `in_progress` | 正在跟进 | 更新 note 记录沟通进展 |
| `resolved` | 已完成（成交或明确无意向） | 填写最终 note |
| `spam` | 垃圾询盘 | 标记后不再跟进 |

**操作规范**：
- 接手询盘后立即将 status 改为 `in_progress`，assigned_to 填写自己
- 每次电话或邮件沟通后在 note 中追加记录（格式：`2026-09-05 张三：已发送报价单`）
- 避免覆盖他人备注，应追加而非替换

### Technical Matching 的含义

`inquiry_type = technical_matching` 的询盘来自"技术匹配"页面，对应 `/technical-matching` 表单。

这类询盘包含额外字段：
- `tm_product_interest`：客户感兴趣的产品类型
- `tm_product_format`：产品包装形式
- `tm_line_speed`：生产线速度
- `tm_package_dimensions`：包装尺寸
- `tm_contaminant_concern`：目标检测的异物类型
- `tm_existing_equipment`：现有设备情况

处理 TM 询盘时，应优先将这些技术信息转交给售前工程师评估，而非直接发通用报价。

### 垃圾询盘处理规则

- 将明显垃圾询盘的 status 设为 `spam`
- **不要删除** spam 记录（可用于后续防垃圾分析）
- 如有疑问，宁可保留为 `new` 后再判断

### 隐私删除规则

如客户要求删除其个人数据（GDPR/隐私权请求）：
1. 联系开发人员执行删除操作（需数据库层面操作）
2. 不要运营人员自行在 CMS 界面删除（可能遗漏关联数据）
3. 在内部日志中记录删除时间和请求来源

### 邮件通知状态判断

系统是否会发送邮件通知取决于服务器环境变量 `SMTP_HOST` 是否已配置：

- **已配置**：每次新询盘提交后，销售/支持邮箱会收到通知
- **未配置（当前开发阶段）**：不发送邮件，需手动查看 Directus

判断方式：向前台提交一个测试询盘（用真实邮箱），看是否收到通知邮件。如果没有收到，说明 SMTP 尚未配置，请联系开发人员。

---

## 7. 备份与恢复

### GitHub 备份什么

GitHub 仓库（代码库）包含：
- 所有前台源代码（Nuxt/Vue 页面、组件、API）
- 后台 Schema 定义（`directus/schema/`）
- 文档（`docs/`）
- 配置文件（`document-extractor/Dockerfile`、`docker-compose.yml` / `docker-compose.local.yml`）

> **订正（FINAL-RELEASE-PRODUCTION-PREFLIGHT-01，2026-09-18）：** 本行原先还列出"nginx 配置"，但仓库中**没有任何
> nginx / Caddy / Traefik 配置文件**，也没有 Nuxt 应用的 Dockerfile——生产反向代理方案与 Nuxt 的生产运行方式
> （宿主机进程还是容器）**尚未决定**，因此也不在 Git 的备份范围内。见
> `docs/project/PRODUCTION-PREFLIGHT.md` §10 / §13。
>
> **同步（FINAL-RELEASE-PRODUCTION-PREFLIGHT-02，2026-09-18）：** 两者现已在决定层面冻结（`docs/project/08-decision-log.md`
> D-043）：Nuxt 是 systemd 管理的宿主进程，不使用 Dockerfile；生产沿用主机上已有的 Nginx，为 LITUBO 单独建一个虚拟主机。
> 但 LITUBO 的虚拟主机配置与 systemd unit **都还没有编写**，留给后续获授权的部署模块，所以仓库中仍然没有这些文件。见
> `docs/project/PRODUCTION-PREFLIGHT.md` §39。

**不包含**：
- 运营数据（产品、文章、询盘记录）——存储在数据库
- 媒体文件（图片、PDF）——存储在服务器磁盘
- 环境变量（`.env`）——不可提交 Git
- 备份文件（`backups/`）——不可提交 Git
- 开发测试数据——不可提交 Git

### PostgreSQL 与 uploads 的备份方式

> **自 FINAL-RELEASE-PRODUCTION-READY-02（D-040）起：** 数据库与 Directus uploads 是**同一个备份集**，必须在停写窗口内一起备份、一起恢复；不要再单独导出数据库或单独打包 uploads。完整步骤、校验项与失败处理以 `docs/project/PRODUCTION-BACKUP-RESTORE-RUNBOOK.md` 为准。（本节原先的命令使用了不存在的容器名 `litubo-cms-db-1` 与错误的用户 / 库名，并把数据库与媒体分开备份，已移除。）

**备份**（由有服务器访问权限的开发人员执行；备份期间网站的 CMS 读取与询盘提交返回 503，期间不要登录后台）：

```bash
docker compose stop directus
node scripts/backup-create.mjs --postgres-container litubo-cms-postgres-1 --database <数据库名> \
  --directus-container litubo-cms-directus-1 --uploads-dir <uploads 目录> --output-dir <Git 之外的备份目录>
docker compose start directus
```

得到的 `litubo-backup-YYYYMMDD-HHMMSS/` 目录包含 `database.dump`、`uploads.tar`、`SHA256SUMS`、`manifest.json`，四者缺一不可。备份集含业务数据，以及数据库里的凭证类记录（service token、密码哈希），须按敏感资料保管。

**备份频率、保留期、异地存储、加密**：尚待生产运维决定（TO BE CONFIRMED）。上线初期建议保留多个带日期的备份集，且不要只存放在数据所在的同一块磁盘上。

### 恢复前必须先做什么

在执行任何恢复操作前：

1. **先恢复到测试目标验证**：`node scripts/backup-restore.mjs` 只接受名称带 TEST 的新数据库和新建或空的 TEST uploads 目录；它先校验 checksum，任何不一致都拒绝恢复
2. **记录当前状态**：截图或导出当前数据，作为恢复前的参考点
3. **通知相关人员**：告知维护窗口，预计多少分钟不可用
4. **生产切换须单独授权**：把恢复出的数据切换为生产数据不是恢复工具的功能，目前没有经过演练的步骤，需要单独的发布授权

### 严禁提交到 Git 的文件

- `.env`（含所有密钥）
- `backups/`（数据库导出文件）
- `dev-data/`（本地测试数据）
- 任何包含密码、Token、内网 IP 的文件

---

## 8. HubSpot / AI 集成

### 当前状态（Phase 7A 完成后）

**HubSpot 同步代码已就绪，尚未配置 Token。**  
同步代码框架已在 Phase 7A 实施完成。当前所有询盘写入 Directus 后，`hubspot_sync_status` 字段值为 `not_configured`，表示尚未连接真实 HubSpot 账户。

**当前询盘的 hubspot_sync_status = `not_configured`**，这是预期的正常状态，不是错误。

**AI 辅助回复：尚未启用。**  
`inquiries` 表中预留了 `ai_draft_reply` 字段（AI 建议回复草稿），当前字段为空，AI 功能未接入任何真实 API。

### Directus inquiries 新增字段说明

Phase 7A 在 `inquiries` 表中新增了以下 4 个字段，运营人员可在 Directus 后台查看：

| 字段 | 含义 | 可能值 |
|------|------|--------|
| `hubspot_sync_status` | HubSpot 同步状态 | `not_configured`（未配置 Token）/ `pending`（同步中）/ `synced`（成功）/ `failed`（失败，含超时） |
| `hubspot_contact_id` | HubSpot Contact ID | 同步成功后自动填入，否则为空 |
| `hubspot_synced_at` | 同步时间戳 | 同步操作发生时自动记录 |
| `hubspot_error_summary` | 错误摘要 | 同步失败时记录技术性错误码，不含个人信息 |

### 密钥存放原则

- `HUBSPOT_ACCESS_TOKEN`：只能放在腾讯云服务器的 `.env` 文件中，不写入代码、文档或 Git
- `OPENAI_API_KEY` 或其他 AI 服务密钥：同上
- **运行时注入（D-039）：** 这些服务端 secret（以及 `DIRECTUS_TOKEN`、`SMTP_PASS`、`SUBMISSION_IP_SECRET`、`DEEPSEEK_API_KEY`）只在运行时注入 Nuxt 服务进程的环境——由部署 secret manager / 进程管理器 / 容器环境在服务启动时提供；构建不需要、构建产物也不包含它们。构建好的 server 不会自己读取 `.env` 文件，只有被注入进程环境的值才生效；更换后重启 Nuxt 服务即可，无需重新构建。见 `docs/project/PRODUCTION-PROVISIONING-RUNBOOK.md` §2。

### Phase 7B 运营人员操作步骤

Phase 7B 由开发团队在 HubSpot 账户中完成以下设置后通知运营：

1. 在 HubSpot 中创建 Private App，获取 Access Token（所需权限：`crm.objects.contacts.write`）
2. 在 HubSpot 联系人属性中创建以下 7 个自定义属性：
   `litubo_inquiry_type`、`litubo_source_url`、`litubo_utm_source`、`litubo_utm_medium`、`litubo_utm_campaign`、`litubo_product_interest`、`litubo_last_inquiry_at`
3. 在服务器 `.env` 中添加 `HUBSPOT_ACCESS_TOKEN=<token值>`
4. 按当时实际部署方式重启 Nuxt 服务（本地与生产的重启命令需按实际服务名称确认后再执行，不要自行推断）
5. 向前台提交一个真实测试询盘
6. 登录 HubSpot 后台，确认该询盘已作为 Contact 出现，且自定义属性有值
7. 查看 Directus 中该询盘的 `hubspot_sync_status` 是否变为 `synced`
8. 如状态为 `failed`，联系开发人员查看日志（`hubspot_error_summary` 会显示错误码）

**注意**：Phase 7A / 7B 只同步 HubSpot Contact，不创建 Deal，不关联 Pipeline。

### 各功能计划状态说明

| 功能 | 当前状态 | 启用条件 |
|------|---------|---------|
| 询盘写入 Directus | ✅ 已启用 | — |
| 邮件通知 | ⏸ 待配置 | 服务器配置 SMTP_HOST |
| HubSpot Contact 同步 | ⏸ 代码已就绪，待配置 Token（Phase 7B） | Phase 7B：在 .env 设置 HUBSPOT_ACCESS_TOKEN 后重启服务 |
| HubSpot Deal 创建 | 🚫 本期不实施 | 后续独立模块 |
| AI 辅助草稿 | ❌ 尚未启用 | 需开发人员接入 |
| AI 自动发邮件 | 🚫 永不允许 | — |

### AI 不能自动给客户发邮件

**这是不可逾越的规则**：AI 生成的任何内容（`ai_draft_reply` 字段）只能作为参考草稿，必须经过人工审核修改后，由真实员工通过正常邮件客户端发送。

系统设计层面已禁止 AI 直接触发任何对外发送行为。运营团队也不应通过任何变通方式绕过此限制。

---

## 9. 上线前清单

在域名切换到正式服务器、网站对外公开访问前，必须完成以下项目：

### Cloudflare / Turnstile

- [ ] Cloudflare DNS 已正确解析到腾讯云服务器
- [ ] HTTPS/TLS 证书已颁发（Cloudflare 自动或 Let's Encrypt）
- [ ] 防火墙规则：只开放 80/443 端口，屏蔽 8055（Directus 不直接对外）
- [ ] Turnstile 密钥已配置（如表单启用 Turnstile 人机验证）：`NUXT_PUBLIC_TURNSTILE_SITE_KEY` 和 `TURNSTILE_SECRET_KEY`

### HubSpot 同步

- [ ] HubSpot Portal ID 已确认
- [ ] Access Token 已放入服务器 `.env`
- [ ] 测试询盘已成功同步到 HubSpot
- [ ] HubSpot 中的字段映射已确认（邮箱、公司名、消息内容等）

### SMTP 邮件发送测试

- [ ] SMTP 服务商已选定（如腾讯企业邮、SendGrid）
- [ ] `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM` 已配置
- [ ] `CONTACT_EMAIL` 和 `SALES_EMAIL` 已配置
- [ ] 从前台提交真实测试询盘，确认相应邮箱收到通知
- [ ] 确认邮件未进垃圾箱（检查 SPF/DKIM/DMARC）

### 数据库与媒体备份

- [ ] 自动备份脚本已部署并测试（cron job）
- [ ] 备份文件已成功传输到异地存储（腾讯云 COS 或其他）
- [ ] 已执行一次完整恢复测试（从备份还原并验证数据完整性）

### Google Search Console / SEO

- [ ] Google Search Console 已添加域名并完成验证
- [ ] sitemap.xml 已提交（URL: `https://litubo.com/sitemap.xml`）
- [ ] robots.txt 已确认（不屏蔽 Googlebot）
- [ ] 各主要页面的 SEO title 和 description 已填写
- [ ] Open Graph 图片（OG image）已上传并配置

### 隐私政策

- [ ] 隐私政策页面（`/privacy-policy`）内容已由法务审核
- [ ] `PRIVACY_POLICY_VERSION` 环境变量已与政策版本号对应
- [ ] 所有表单的"同意条款"勾选框指向正确的隐私政策页面链接
- [ ] 如面向欧盟用户，Cookie 同意横幅已配置（如需要）

### 上线后首周监控

- [ ] Nuxt 服务日志每天检查一次（关注 5xx 错误）
- [ ] Directus 后台每天检查新询盘
- [ ] 确认 Cloudflare 分析中有真实流量
- [ ] 检查首页、产品页、博客页在移动端和桌面端的显示效果

---

*本手册随网站功能迭代持续更新。如发现错误或内容缺失，请联系开发团队修订。*
