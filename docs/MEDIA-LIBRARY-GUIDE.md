# LITUBO 统一媒体库操作指南

> 适用版本：阶段 2（Directus 文件夹结构与上传规范）
> 面向读者：负责上传和管理媒体资源的运营人员

---

## 目录

1. [总体说明](#1-总体说明)
2. [文件夹结构](#2-文件夹结构)
3. [命名规则](#3-命名规则)
4. [格式与尺寸要求](#4-格式与尺寸要求)
5. [上传操作步骤](#5-上传操作步骤)
6. [替换文件](#6-替换文件)
7. [持久化说明](#7-持久化说明)
8. [禁止事项](#8-禁止事项)

---

## 1. 总体说明

LITUBO 媒体库使用 **Directus 内置文件系统（`directus_files`）**，所有图片和 PDF 均通过 Directus Admin 界面管理。

- 本阶段（阶段 2）只建立文件夹结构和上传规范，不创建任何自定义 Collection；
- 文件夹（Folder）不计入 Directus 25 个 Collection 限额，可自由使用；
- 文件与产品的关联（`products_files` M2M Junction）留待阶段 3 Products 数据模型实现，本阶段上传的文件只需放入正确文件夹和遵守命名规则；
- Directus 地址（本地开发）：**http://localhost:8055/admin/files**；
- 生产环境通过 SSH 隧道访问，见 `docs/ADMIN-CMS-SETUP.md` 第 6.2 节。

---

## 2. 文件夹结构

媒体库共 **16 个文件夹**，按内容类型分层组织：

```
File Library
├── home                     首页图片（Hero、路径卡、CTA 横幅、最新资讯占位图）
├── products                 产品图片
│   ├── xray                 X-Ray 检测系列（Hero、gallery 图）
│   ├── metal-detection      金属检测系列
│   ├── checkweigher         重量检测系列
│   ├── combination          组合检测系列
│   ├── conveyor             输送与拒绝系统
│   └── technical-docs       产品技术文件（数据手册、说明书 PDF）
├── applications             应用场景图（8 个行业场景）
├── resources                资源内容图片
│   ├── insights             Insights / News / Technical Guides 文章封面图
│   ├── case-studies         案例研究图
│   └── downloads            可下载文档封面缩略图
├── company                  公司页图片
│   └── global-service       全球服务地图、大区覆盖图、服务团队照片
└── certifications           质量证书（ISO 9001、CE、FDA、HACCP）
```

> **规则：** 上传时必须选择正确文件夹；不允许将文件上传到 File Library 根目录（根目录仅用于组织文件夹）。

---

## 3. 命名规则

| 规则 | 说明 |
|---|---|
| 字符集 | 英文小写字母、数字、连字符（`-`），不使用空格、下划线或特殊字符 |
| 产品图前缀 | 使用产品 slug 作为前缀，例如 `xr-demo-series-hero.jpg`，slug 必须与路由完全一致 |
| 类别概览图 | `products-[category]-card.jpg`（如 `products-xray-card.jpg`） |
| 类别 Hero 图 | `products-[category]-hero.jpg`（如 `products-xray-hero.jpg`） |
| 应用场景图 | `app-[scene].jpg`（如 `app-packaged-food.jpg`） |
| 公司页图 | `company-[page]-[role].jpg`（如 `company-about-hero.jpg`） |
| 质量证书 | `cert-[standard].jpg`（如 `cert-iso9001.jpg`、`cert-ce.jpg`） |
| 测试文件 | 必须以 `test-` 开头；验收后立即删除，不留入生产库 |

---

## 4. 格式与尺寸要求

### 图片

| 用途 | 格式 | 推荐尺寸 | 文件大小上限 |
|---|---|---|---|
| 首页 Hero（右列纵向图） | JPG（q80–85） | 800 × 1000 px（9:16 或方形） | 500 KB |
| 路径卡 / 应用场景 | JPG（q80–85） | 800 × 600 px（4:3） | 300 KB |
| 产品 Hero | JPG（q80–85） | 1200 × 800 px（3:2） | 500 KB |
| 产品 Gallery | JPG（q80–85） | 1000 × 750 px（4:3） | 400 KB |
| 类别概览卡 | JPG（q80–85） | 800 × 450 px（16:9） | 300 KB |
| 文章封面 / Case Study | JPG（q80–85） | 1200 × 675 px（16:9） | 400 KB |
| 下载封面缩略图 | JPG（q80–85） | 400 × 600 px（2:3） | 150 KB |
| 公司页 Hero | JPG（q80–85） | 1440 × 810 px（16:9） | 600 KB |
| 质量证书 / 徽标 | JPG 或 PNG | 400 × 300 px | 150 KB |
| 图标 / 示意图 | SVG | — | 50 KB |

### PDF 文件（数据手册、说明书）

- 放入 `products/technical-docs` 文件夹；
- 文件名格式：`[product-slug]-datasheet.pdf` 或 `[product-slug]-manual.pdf`；
- 大小建议不超过 10 MB；如超出，提前压缩。

---

## 5. 上传操作步骤

### 5.1 上传新文件

1. 打开 Directus Admin → **File Library**（左侧导航）；
2. 在左侧文件夹树中点击目标文件夹（例如 `products / xray`）；
3. 点击右上角 **+** 按钮 → **Upload File(s)**；
4. 选择本地文件（可多选）；
5. 上传完成后，在文件详情面板填写 **Title**（显示名称，供管理界面识别用）和 **Description**（alt 文字备注，用于前台无障碍属性）；
6. 确认文件出现在正确文件夹中。

### 5.2 移动文件到正确文件夹

如文件上传到了错误位置：

1. 点击文件打开详情面板；
2. 在 **Location** 下拉框中选择正确文件夹；
3. 点击右上角保存（✓）。

---

## 6. 替换文件

如需更新某个已在前台引用的图片而不改变其文件 ID（推荐方式，无需修改 Nuxt 代码）：

1. 打开目标文件的详情面板；
2. 点击预览图下方 **Replace File**；
3. 选择新文件；
4. Directus 保留原文件 ID，替换磁盘上的实际文件；前台下次请求时自动显示新图。

> **注意：** 替换后如浏览器有缓存，需强制刷新（Ctrl+Shift+R）才能看到新图。

---

## 7. 持久化说明

所有上传文件存储在容器外部的**宿主机持久化挂载目录**：

| 环境 | 宿主机路径 | 容器内路径 |
|---|---|---|
| 本地开发 | `./dev-data/uploads/`（项目内，已在 `.gitignore`） | `/directus/uploads` |
| 腾讯云生产 | `/data/litubo/uploads/` | `/directus/uploads` |

- `docker compose down`（不加 `--volumes`）**不会**删除文件；
- `docker compose down --volumes` 与 named volume 有关，LITUBO 使用 bind mount，因此此命令**不影响**上传文件；但为避免误操作，仍然禁止在生产环境使用 `--volumes`；
- 文件夹结构存储在 PostgreSQL（`directus_folders` 表），与文件同样受 bind mount 持久化保护；
- 本地 `dev-data/` 目录已在 `.gitignore` 中排除，不进入 Git；
- **生产环境必须纳入服务器备份**（见 `docs/ADMIN-CMS-SETUP.md` 第 2.3 节）。

### 持久化验证记录（阶段 2 验收，2026-09-02）

| 验证项 | 结果 |
|---|---|
| 完整重启（`down` → `up -d`，不加 `--volumes`） | ✓ 通过 |
| 重启后 16 个文件夹全部保留（PostgreSQL 查询确认） | ✓ 通过 |
| 重启后测试文件物理文件保留（`dev-data/uploads/` 确认） | ✓ 通过 |
| Directus Admin 删除文件后物理文件同步清除 | ✓ 通过 |
| `dev-data/uploads/` 不进入 Git（`.gitignore` 确认） | ✓ 通过 |

---

## 8. 禁止事项

| 禁止 | 原因 |
|---|---|
| 上传真实产品图、客户资料、合同、真实 PDF 到本地开发环境后提交 Git | `dev-data/` 整体已排除 Git，但养成习惯避免误操作 |
| 将文件上传到 File Library 根目录（非文件夹） | 破坏统一分类，影响阶段 3 产品关联 |
| 使用中文、空格或特殊字符命名文件 | 可能导致 URL 编码问题 |
| 在本阶段创建自定义 Collection 来管理媒体 | 直接消耗 25 个 Collection 限额；媒体库由 Directus 内置 `directus_files` + Folder 完全覆盖 |
| 在本阶段配置 `file_role` 或产品关联字段 | 文件与产品角色的关联在阶段 3 Products 数据模型中统一设计 |
| 在文档或代码中记录任何真实密码、token 或服务器路径 | 密钥管理规则见 `docs/ADMIN-CMS-SETUP.md` 第 8 节 |
