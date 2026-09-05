# LITUBO — Phase 9C-2：Media Library 基础版规划

> **文件定位：** 本文件是 LITUBO 项目 **Phase 9C-2（M4-Next-2）Media Library 基础版**的**正式规划文件**。后续所有 9C-2 开发、验收、授权讨论均以此文件为准。
> **第六章**单独定义 9C-2 对未来 **Phase 9B（AI 产品资料导入与人工审核）**的接口与安全边界；Phase 9B 是独立的后续阶段，须 9C-2 完成后单独授权，不在本文件开发范围内。
> **本文件只描述规划，不触发任何代码、schema 或数据变更。**
>
> **前置阅读（必须先读）：**
> 1. `docs/project/MEDIA-AND-PRODUCT-DATA-GOVERNANCE.md`（v0.1 治理规范，已确认决策 #1/#2/#3）
> 2. `docs/project/MASTER-ROADMAP.md`
> 3. `docs/project/CURRENT-STATE.md`

---

## 目录

0. [阶段编号与范围对照表](#零阶段编号与范围对照表)
1. [双资料区边界](#一双资料区边界)
2. [Media Library 数据模型与文件夹组织](#二-media-library-数据模型与文件夹组织)
3. [全局引用与删除保护](#三全局引用与删除保护)
4. [Media Library 各阶段功能范围](#四-media-library-各阶段功能范围)
5. [权限、审计与存储策略](#五权限审计与存储策略)
6. [Phase 9B 接口与安全边界（9C-2 视角）](#六-phase-9b-接口与安全边界9c-2-视角)
7. [实施模块拆分与依赖顺序](#七实施模块拆分与依赖顺序)
8. [开放决策记录（分组）](#八开放决策记录分组)
9. [本文件更新规则](#九本文件更新规则)

---

## 零、阶段编号与范围对照表

### 0.1 本规划文件的正式阶段归属

本文件是 **MASTER-ROADMAP.md M4-Next-2 / Phase 9C-2「Media Library 基础版」**的**正式规划文件**。

> 本文件覆盖 Phase 9C-2 的完整规划，包含数据模型、功能范围、文件生命周期、权限策略、验收标准和已确认开放决策。
> **第六章**单独定义 9C-2 对未来 **Phase 9B（M4-Next-4，AI 产品资料导入与人工审核）**的接口与安全边界。Phase 9B 是独立阶段，须 9C-2 完成后单独授权。本文件不构成 9C-2 + 9B 的联合规划文档。
> 文件名已于 2026-09-04 从 `PHASE-9B-0-MEDIA-LIBRARY-FOUNDATION-SPEC.md` 更名为 `PHASE-9C-2-MEDIA-LIBRARY-FOUNDATION-SPEC.md`（该文件在更名时未被 git 追踪，不影响 git 历史）。

### 0.2 各名称的正式阶段对照

| 会话中使用的名称 | MASTER-ROADMAP 正式名称 | 归属里程碑 | 状态 |
|----------------|----------------------|----------|------|
| 9A-2C（本地发布/撤回验收）| 9A-2 验收补充（不在 ROADMAP 单独列出）| M4 | ✅ 已完成（CURRENT-STATE.md 记录）|
| **本规划文档**（`PHASE-9C-2-...`）| **M4-Next-2 / Phase 9C-2** Media Library 基础版正式规划（第六章定义 9B 接口边界，Phase 9B 属独立后续阶段）| M4 | ✅ 规划已确认（2026-09-04）|
| Media Library 批量选择/归类 | **M4-Next-2 / Phase 9C-2** | M4 | ⏳ 待授权 |
| AI 产品导入 | **M4-Next-4（= M5）/ Phase 9B** | M5 | ⏳ 待授权 |
| B0 系列（备份/GitHub/治理规划）| **运维任务序列**（不在 M1–M9 里程碑表内）| 独立运维 | ⏳ 部分完成（见 §0.4）|
| Media Library 基础版 | M4-Next-1 / Phase 9C-1 | M4 | ✅ 已完成（commit `7e9d41c`）|
| Settings 最小版 | M4-Next-3 | M4 | ✅ 已完成 |

### 0.3 ROADMAP 编号不一致项与最小修订建议

> **原则：** 不改 ROADMAP 的代码或阶段顺序，只描述问题并给出最小文字修订建议，由用户决定是否采纳。

**不一致 #1：B0 系列未出现在 M1–M9 总览表中**

- **现状：** B0（B0-0 到 B0-6，备份/GitHub 同步/治理规划）多次出现在 MASTER-ROADMAP.md 的标题行文字中，但 M1–M9 总览表没有 B0 条目。新会话读 ROADMAP 时容易误以为 B0 是偶发性临时操作，不清楚其完成状态。
- **最小修订建议：** 在 MASTER-ROADMAP.md 的"全局安全与操作守则"节末尾，新增"运维任务序列（B0）"段落，明确 B0 是独立于 M1–M9 的运维任务，并列出 B0-0 到 B0-6 的范围及当前状态（见 §0.4）。不影响 M1–M9 编号和顺序。

**不一致 #2：9A-2C 未在 ROADMAP 的 M4 节列出**

- **现状：** MASTER-ROADMAP.md M4 节明确列出 9A-2D/9A-2E/9A-2F，但没有 9A-2C（本地发布/撤回验收）。
- **评估：** 9A-2C 是 9A-2 验收的补充测试，不引入新代码，CURRENT-STATE.md 已有完整记录。保持现状影响极小。
- **最小修订建议：** 在 MASTER-ROADMAP.md M4 节"9A-2 ✅（完成）"说明中追加一句："9A-2C 本地发布/撤回验收通过（2026-09-04，见 CURRENT-STATE.md）。"

**不一致 #3：ROADMAP 没有"9B-0"阶段定义**

- **现状：** 本文件名含"9B-0"，但 Phase 9B 在 ROADMAP 中指整个 AI 导入阶段（M5），不区分子阶段。
- **最小修订建议：** 在 MASTER-ROADMAP.md 的 M4-Next-2 节下新增一行说明："规划文档：`docs/project/PHASE-9C-2-MEDIA-LIBRARY-FOUNDATION-SPEC.md`（M4-Next-2 + Phase 9B 联合规划）。"不新增"9B-0"作为独立阶段编号。

### 0.4 B0 运维任务完成状态

| 任务 | 内容 | 状态 |
|------|------|------|
| B0-0 | 媒体治理规范文档写入（`MEDIA-AND-PRODUCT-DATA-GOVERNANCE.md`）| ✅ 已完成（commit `c555d9c`）|
| B0-1 | 9 个本地 commit push 至 GitHub | ✅ 已完成 |
| B0-2 | PostgreSQL 数据库增量备份 | ⏳ 待用户执行 |
| B0-3 | 删除 3 个零字节 SQL dump 文件 | ⏳ 待用户授权 |
| B0-4 | Directus uploads 媒体备份至外部磁盘 | ⏳ 待决策 #7（磁盘路径）|
| B0-5 | `private-product-source/` 备份至外部磁盘 | ⏳ 待决策 #7 |
| B0-6 | 生成统一 MANIFEST 校验文件 | ⏳ B0-2 至 B0-5 完成后执行 |

---

## 一、双资料区边界

### 1.1 Directus Media Library（公开媒体库）

**定义：** 经人工审核、适合在网站公开页面或 Admin 后台业务中引用的媒体资产。

| 文件类别 | 允许格式 | 最大尺寸 | 存储位置 | 对外可见性 | 审核路径 |
|---------|---------|---------|---------|-----------|---------|
| 产品图片 | JPG / PNG / WebP | 50 MB | Directus bind mount（`DIRECTUS_UPLOADS_DIR`）| 通过 `/assets/:id?width=&format=webp` 按需转换 | 管理员上传 → 归入对应文件夹 → 填写 alt/caption 后关联产品 |
| 说明书 / 数据表 | PDF | 50 MB | 同上 | 通过产品页 `file_role=manual/datasheet` 关联后可下载 | 原始 Word/Excel → 人工转 PDF → 上传 → 标注 file_role |
| 证书 | PDF | 50 MB | 同上 | 通过产品页 `file_role=certificate` 关联后可下载 | 上传 → 填写 `language`、`version_label` → 关联产品 |
| 产品手册（宣传册）| PDF | 50 MB | 同上 | 同上（`file_role=brochure`）| 同上 |
| 品牌素材 / Logo | JPG / PNG / WebP | 50 MB | 同上 | 按引用决定；无引用则不展示 | 上传 → 归入 `brand` 文件夹 |
| 首页 / 应用场景图 | JPG / PNG / WebP | 50 MB | 同上 | 同上 | 上传 → 归入 `home` / `applications` 文件夹 |

**当前格式白名单（已实现，不扩展）：**

```
upload.post.ts  ALLOWED_TYPES = { image/jpeg, image/jpg, image/png, image/webp, application/pdf }
                ALLOWED_EXTS  = /\.(jpe?g|png|webp|pdf)$/i
                MAX_SIZE      = 50 MB
```

**永不上传到 Media Library 的内容：**

- Word（`.docx`）、Excel（`.xlsx`）、ZIP、GIF、BMP、SVG 矢量原图（当前 upload 端点已拒绝）
- 未经人工审核的 AI 生成内容
- 包含未脱敏个人信息（PII）的文档
- 尚未转为 PDF 的原始草稿

### 1.2 私有原始资料区

**定义：** 供内部工作、AI 导入源或人工转换的原始资料，不进入公开媒体库。

| 文件类别 | 允许格式 | 存储位置 | 对外可见性 | 审核路径 |
|---------|---------|---------|-----------|---------|
| 原始产品说明书 | Word / Excel / PDF | `private-product-source/`（本地磁盘，已在 `.gitignore` 排除）| 完全私有 | 人工审核 → 转 PDF → 上传至 Media Library |
| AI 导入源文件 | Word / Excel / PDF | 独立受保护导入区（Phase 9B 单独授权后另行设计）| 仅 Admin 导入流程可见 | AI 读取 → 生成 source_records（needs_review）→ 人工审核 |
| 内部工作草稿 | 任意 | 同上 | 完全私有 | 无自动化路径 |

**三个不变约束（来自 v0.1 决策 #3，已确认）：**

1. 现有上传 API 的格式白名单**永不扩展**至 `.docx`/`.xlsx`
2. `private-product-source/` 不进 Git、不通过任何 API 公开
3. AI 阶段的原始资料导入区须单独授权后另行设计，不复用公开媒体库入口

### 1.3 边界维持机制（架构图）

```
┌──────────────────────────────────┐     ┌──────────────────────────────────┐
│     Directus Media Library       │     │       私有原始资料区               │
│                                  │     │  (private-product-source/)        │
│  ✅ JPG / PNG / WebP / PDF       │     │  ✅ Word / Excel / 未审核 PDF      │
│  ✅ 人工审核后上传                │     │  ✅ AI 导入源（Phase 9B 另行设计）  │
│  ✅ /api/admin/media/upload      │     │  ❌ 不通过任何 Nuxt/Directus API    │
│  ✅ 可被产品/页面 UUID 引用       │     │  ❌ 不进 Directus                   │
│  ❌ 无 Word / Excel              │     │  ❌ 不进 Git                        │
└──────────────────────────────────┘     └──────────────────────────────────┘
            │                                          │
            │ 人工转换（Word/Excel → PDF）              │ AI 读取（Phase 9B 另行设计）
            └──────────────────────────────────────────┘
```

---

## 二、Media Library 数据模型与文件夹组织

### 2.1 文件夹命名规范（来自 v0.1 决策 #2，已确认）

| 规则 | 内容 |
|------|------|
| 命名格式 | 英文、小写、kebab-case（例：`products/xray`） |
| 文件夹含义 | 只表达**稳定业务大类**，不编码型号/语言/用途/营销活动 |
| 禁止的文件夹名示例 | `LT-180C`（型号）、`zh`（语言）、`hero`（页面用途）、`2024-campaign`（营销活动）|
| 型号信息归属 | `products.model_or_series`（结构化字段）|
| 语言信息归属 | `products_files.language`（junction 字段）|
| 版本信息归属 | `products_files.version_label`（junction 字段）|
| 用途信息归属 | `products_files.file_role`（junction 字段，11 值）|

**v0.1 推荐文件夹结构（已确认，可在此处追加新文件夹）：**

| 文件夹路径 | 用途 |
|-----------|------|
| `products/xray` | X 射线检测设备图片与 PDF |
| `products/metal-detection` | 金属检测设备图片与 PDF |
| `resources/manuals` | 可公开的操作说明书（PDF）|
| `resources/certificates` | 认证证书（PDF）|
| `home` | 首页用图 |
| `applications` | 应用场景图 |
| `brand` | 品牌标识、Logo |
| `test-only` | 测试专用媒体（不对外展示）|

> 新增文件夹须在本文件第八节开放决策中记录后方可创建，保持目录结构可追溯。

### 2.2 文件元数据字段分层规划

| 字段 | 层 | 当前状态 | 说明 |
|------|---|---------|------|
| `id`（UUID）| 原始资产 1 | ✅ 已有 | 全局唯一，贯穿所有引用 |
| `type`、`filesize`、`width`、`height` | 原始资产 1 | ✅ 已有（只读）| Directus 自动填充 |
| `uploaded_on` | 原始资产 1 | ✅ 已有（只读）| Directus 自动 |
| `title` | 元数据 2 | ✅ 已有（可编辑，max 255）| 语言不敏感，全局共用 |
| `description` | 元数据 2 | ✅ 已有（可编辑，max 1000）| 内部备注 |
| `folder` | 元数据 2 | ✅ 已有（可移动，单父 UUID）| 文件夹归属 |
| `focal_point_x` / `focal_point_y` | 元数据 2 | ✅ 已有（PATCH 端点：`/api/admin/files/:uuid/focal`）| 图片焦点 |
| `archived`（归档标志）| 元数据 2 | ❌ 未实现 | 9C-2 新增——**不在 directus_files 内**，存于独立 Collection/数据表（决策 #10 已确认）|
| `archived_at` | 元数据 2 | ❌ 未实现 | 同上（独立 Collection/数据表）|
| `hash_sha256` | 元数据 2 | ❌ 未实现 | 9C-2 上传时计算，仅用于重复提示，不强制阻止（决策 #12 已确认）|
| `tags` | 元数据 2 | ❌ 未实现 | Product Dossier 阶段评估（待决策 #4）|
| `source_url` | 元数据 2 | ❌ 未实现 | Product Dossier 阶段 |
| `copyright_notice` | 元数据 2 | ❌ 未实现 | Product Dossier 阶段 |
| `expires_at` | 元数据 2 | ❌ 未实现 | Product Dossier 阶段（待决策 #6）|

### 2.3 产品/内容引用关系（不复制文件，只存 UUID 引用）

| 引用方 | 引用字段 | 引用类型 | 实现状态 |
|--------|---------|---------|---------|
| `products_files`（M2M junction）| `directus_files_id`（文件 UUID）| 直接引用 | ✅ 已有 |
| `product_sections`（页面模块）| `media_id`（`products_files.id` 整型，不是文件 UUID）| 间接引用（须经 junction JOIN）| ✅ 已有 |
| `site_content`（首页 Hero 等）| 待 Content Center 设计时确定 | - | ❌ 未实现 |
| `site_settings`（品牌资产）| 待 Settings 扩展时确定 | - | ❌ 未实现 |

> **重要：** `product_sections.media_id` 是 `products_files` junction 表的行 ID（整型），不是 `directus_files` 的 UUID。引用查询时须 JOIN：`products_files.id = product_sections.media_id`，再通过 `products_files.directus_files_id` 关联到文件 UUID。

**核心原则：** 任何页面/组件只保存 UUID 或 junction ID 引用；永不将文件二进制内容、绝对磁盘路径或本地路径写入代码或数据库。

---

## 三、全局引用与删除保护

### 3.1 引用查询机制（必须在开放归档/删除操作之前实现）

**引用查询 API 规格（9C-2 实现时设计，已确认决策 #11）：**

```
GET /api/admin/media/:uuid/references     ← 管理员 API，公开 API 不暴露任何引用信息
响应（管理员专属）：
{
  product_count: N,        // 直接引用该 UUID 的 products_files 行数（去重 product 数）
  section_count: N,        // product_sections 中间接引用的行数（via products_files join）
  other_count: N,          // 未来 site_content / site_settings 等引用数
  total: N,                // 上述合计
  can_archive: boolean,    // total === 0
  references: [            // 各引用实体详情（决策 #11 已确认：管理员 API 必须返回）
    {
      product_id: N,       // products.id
      product_name: "...", // products.name（让管理员直观判断是否可归档）
      file_role: "..."     // products_files.file_role（FileRole 11 值之一）
    }
    // section 引用、未来 site_content 引用等亦列出
  ]
}
```

查询逻辑（须覆盖所有引用来源）：

```sql
-- 直接引用：products_files
SELECT COUNT(*) FROM products_files WHERE directus_files_id = :uuid

-- 间接引用：product_sections → products_files
SELECT COUNT(ps.id)
FROM product_sections ps
JOIN products_files pf ON pf.id = ps.media_id
WHERE pf.directus_files_id = :uuid

-- 未来扩展：site_content, site_settings（Content Center 接入后补充）
```

> 返回格式已由决策 #11 确认：管理员 API 返回数量 + 实体名称/ID/角色；公开 API 不暴露引用信息。

### 3.2 文件生命周期（五阶段保护流程）

```
活跃使用 → 引用检查 → 软归档（独立归档表标记）→ 可恢复期(30天) → 物理删除(超管专用)
                ↑
           有引用 → 拒绝归档，显示引用数量 + 产品名/ID/角色（决策 #11 已确认）
```

| 阶段 | 操作 | 权限 | 审计 |
|------|------|------|------|
| 活跃使用 | 正常展示，可被引用 | 所有管理员 | Directus 自动 |
| 引用检查 | 归档前自动调用 references API | 系统自动触发 | 记录检查时间与 total |
| 软归档 | 独立归档状态表写入记录；不可新引用，已有引用不断开 | 管理员（引用>0 时系统拒绝）| Admin Activity Log + 操作者/时间 |
| 可恢复期 | `archived_at` 起 30 天内，管理员可恢复 | 管理员 | Directus Activity |
| 物理删除 | 从 Directus 和磁盘彻底清除 | **仅超级管理员** + 二次确认 | Directus Activity + 额外操作日志 |

**两条不可违反的硬规则：**

1. **已引用文件绝对不允许直接物理删除**（`total > 0` → 归档端点和删除端点均返回 409 Conflict，不论用户身份）
2. **物理删除属于二期功能，9C-2 仅实现软归档 + 恢复**

### 3.3 孤儿文件管理

- **定义：** `directus_files` 中存在但 `references.total = 0` 的文件
- **处理：** Admin UI 提供"孤儿文件视图"（`?orphan=true` 筛选条件）；孤儿文件仍需走五阶段流程，不自动删除
- **实现时机：** 9C-2 一期或二期（见开放决策 #10）

---

## 四、Media Library 各阶段功能范围

### 4.1 当前已实现（Phase 9C-1，commit `7e9d41c`）

| 功能 | 实现文件 | 状态 |
|------|---------|------|
| 文件列表（最多 200 条，分页）| `server/api/admin/media/files.get.ts` | ✅ |
| 文件夹树侧边栏 | `server/api/admin/media/folders.get.ts` | ✅ |
| 文件夹 / 类型 / 文本搜索筛选 | 同上（GET 参数）| ✅ |
| 文件上传（JPG/PNG/WebP/PDF，50MB，批量）| `server/api/admin/media/upload.post.ts` | ✅ |
| 文件详情面板 | `server/api/admin/media/[id].get.ts` | ✅ |
| 标题 / 描述 / 文件夹编辑 | `server/api/admin/media/[id]/meta.patch.ts` | ✅ |
| 焦点设置 | `server/api/admin/files/[uuid]/focal.patch.ts` | ✅（API 已有）|
| 文件元数据读取（meta.get）| `server/api/admin/files/[uuid]/meta.get.ts` | ✅ |
| 从媒体库为产品选择文件 | `pages/admin/media/index.vue`（模态选择器）| ✅ |
| 产品重复引用防护 | `existingFileIds.value.has(file.id)` | ✅ |
| Admin 导航（Media Library 链接）| `layouts/admin.vue` | ✅ |

### 4.2 Media Library 基础版（9C-2 已完成 + 9C-2R 已收口）

**核心目标：** 让媒体库可管理、可组织，不触及产品参数、AI 或 Content Center。

**实施状态（9C-2 commit `2f0bac4` + 9C-2R Folder Registry 收口 commit）：**

| 功能 | 实现文件 | 状态 |
|------|---------|------|
| 批量文件多选（checkbox）| `pages/admin/media/index.vue` | ✅ 已完成（9C-2）|
| 批量移动文件夹 | `server/api/admin/media/batch-move.post.ts` | ✅ 已完成（9C-2R，服务端策略预验证）|
| 软归档 / 恢复 | `server/utils/mediaLifecycle.ts` + 归档 API | ✅ 已完成（9C-2）|
| 全局引用查询 | `server/api/admin/media/[uuid]/references.get.ts` | ✅ 已完成（9C-2）|
| 文件夹目录策略（Folder Registry）| `server/utils/folderRegistry.ts` | ✅ 已完成（9C-2R）|
| Upload / meta.patch / batch-move 路由 folder guard | 3 个 API handler | ✅ 已完成（9C-2R）|
| 侧边栏 Conflict — read only tier | `pages/admin/media/index.vue` | ✅ 已完成（9C-2R 收口）|
| 44 个 Folder Registry 单元测试 + route-level mock | `tests/folderRegistry.test.ts` | ✅ 已完成（9C-2R 收口）|

**一期明确不做（避免扩展至其他模块）：**

| 不做的功能 | 原因 |
|-----------|------|
| 文件夹创建 / 重命名 | 须遵守命名规范（§2.1），须 Directus 会话，延至独立授权 |

**旧计划（已替换）：**

| 功能 | 实现方向 | 依赖决策 |
|------|---------|---------|
| 批量文件多选（checkbox）| Admin UI `pages/admin/media/index.vue` | 无 |
| 批量移动文件夹 | PATCH `folder` 多条 → 新建批量 API 或逐条 PATCH | 无 |
| 文件夹创建 / 重命名 | Admin UI + Directus `/folders` POST/PATCH | 须遵守命名规范（§2.1）|
| 全局引用查询（references API）| `GET /api/admin/media/:uuid/references` | ✅ 决策 #11 已确认 |
| 软归档 / 恢复 | 独立归档状态表（Collection 或数据表关联 file_id，不修改 directus_files）| ✅ 决策 #10 已确认 |
| 引用详情显示 | 文件详情面板：数量 + 各引用产品名/ID/角色 | ✅ 决策 #11 已确认 |
| 归档视图（已归档文件列表）| 常规列表默认排除已归档；专用筛选显示归档文件 | ✅ 决策 #10 已确认 |
| 上传去重提示 | SHA-256 计算 → 仅提示已有相同内容文件 UUID；管理员可确认继续上传 | ✅ 决策 #12 已确认 |

**一期明确不做（避免扩展至其他模块）：**

| 不做的功能 | 原因 |
|-----------|------|
| 物理删除（硬删除）| 超管专用，需引用检查 + 二次确认；延至二期 |
| 标签（Tags）系统 | Product Dossier 阶段设计 |
| 来源 / 版权 / 到期日字段 | Product Dossier 阶段 |
| AI 辅助分类 / 标注 | Phase 9B 边界，9C-2 绝不出现 AI |
| Content Center 媒体引用 | Content Center 尚未授权 |
| 视频文件支持 | 格式白名单当前不含视频 |
| 批量删除 | 不在 9C-2 范围 |
| 孤儿文件自动清理 | 须先实现引用查询，且物理删除在二期 |
| 多文件夹归属 | Directus 单父模型，不扩展 |

### 4.3 Media Library 二期（Product Dossier 阶段，待授权）

| 功能 | 说明 |
|------|------|
| 物理删除（超管专用）| 引用检查通过 + 已归档 + 二次确认 |
| 孤儿文件检测与批量归档 | 依赖引用查询 API 完善 |
| 标签（Tags）系统 | Directus schema 扩展 |
| 来源 URL / 版权 / 到期日字段 | schema 扩展 |
| SHA-256 去重强制阻止 | 决策 #12 已确认为"仅提示"；二期若需强制阻止须重新授权 |
| 证书到期预警 | 依赖 `expires_at` 字段（决策 #6）|
| 文件级多语言 ALT（`directus_files` 层）| 区别于 junction 层 `alt_en/es/pt` |

### 4.4 验收标准（9C-2 实施时适用）

| 维度 | 验收条件 |
|------|---------|
| 桌面端 1440px | `scrollWidth ≤ innerWidth`，无横向溢出；批量选择、文件夹树、详情面板均正常显示 |
| 手机端 375px | 文件夹侧边栏收起或变抽屉；网格自适应；批量操作可见且可点击；无横向溢出 |
| 批量移动 | 选中 ≥2 个文件 → 选目标文件夹 → 操作成功 → 文件夹筛选后文件出现在新文件夹 |
| 引用查询 | 有引用的文件点击归档 → 系统拒绝并显示引用数量；无引用 → 归档成功 |
| 软归档 | 已归档文件不出现在常规列表；在归档视图可见 |
| 归档恢复 | 已归档文件恢复后出现在常规列表；引用关系未断开 |
| typecheck | `npm run typecheck` 0 errors |
| lint | `npm run lint` 0 errors |
| build | `npx nuxt build` BUILD COMPLETE |
| diff --check | `git diff --check` exit:0 |

---

## 五、权限、审计与存储策略

### 5.1 当前角色（已实现）

| 角色 | Media Library 权限 | 实现方式 |
|------|-------------------|---------|
| Administrator | 上传、查看、编辑元数据、移动文件夹、关联产品、软归档（9C-2 后）| httpOnly Cookie + admin-auth 中间件 |
| `nuxt-server`（只读静态 Token）| 通过 `/api/cms/*` 读取已发布产品引用的媒体 UUID；不直接访问 `directus_files` | 静态 Token，nuxt-server 角色最小权限 |
| 匿名前台用户 | 通过 Directus Assets 端点获取公开引用的文件（`/assets/:id?width=&format=webp`）| Directus 原生 |

### 5.2 未来角色建议（待决策 #9 确认后才实施）

| 角色 | 建议权限 | 说明 |
|------|---------|------|
| 编辑者（Editor）| 上传 + 编辑元数据 + 关联产品；不可归档/删除 | 内容录入人员 |
| 审核者（Reviewer）| 只读 + 标注 `review_status`；不可上传 | 内容审核人员（AI 阶段更重要）|
| 超级管理员 | Administrator + 物理删除权限 | 需单独授权，仅 1 人 |

> **当前阶段：** 只有 Administrator，不新增角色，等待决策 #9。

### 5.3 审计日志

Directus 内置 Activity Log（`directus_activity`）已覆盖以下操作：

| 操作 | 审计状态 |
|------|---------|
| 文件上传 | ✅ Directus 自动（`CREATE /files`）|
| 元数据编辑（title/description/folder）| ✅ Directus 自动（`UPDATE /files/:id`）|
| 产品媒体关联（create junction）| ✅ Directus 自动（`CREATE /items/products_files`）|
| 产品媒体解除（delete junction）| ✅ Directus 自动（`DELETE /items/products_files/:id`）|
| 软归档（`archived=true`）| 需实现后 Directus 自动 + 额外 Admin 操作日志 |
| 归档恢复 | 同上 |
| 物理删除（二期）| Directus 自动 + **额外日志**（操作者、UUID、filename、引用检查结果快照）|

**物理删除（二期）的额外审计要求：**

- 操作者 Directus 用户 ID
- 文件 UUID + filename_download
- 操作前的 `references.total`（须为 0）
- 时间戳
- 确认方式（UI 二次确认按钮，不可通过 API 直接跳过）

### 5.4 文件类型安全分层

| 层次 | 当前状态 | 说明 |
|------|---------|------|
| 客户端 `<input accept>` | ✅ | 仅 UX 提示，可绕过 |
| 服务端 MIME 类型校验 | ✅（`ALLOWED_TYPES` Set）| 强制拒绝 |
| 服务端扩展名校验 | ✅（`ALLOWED_EXTS` 正则）| 双重防护 |
| 文件大小限制 | ✅（50 MB）| 强制拒绝 |
| 病毒扫描 | ❌ 未实现 | 分阶段策略（见下）|

**病毒扫描分阶段策略：**

- **Phase 1（当前～M8）：** 格式白名单仅含图片+PDF，攻击面极小；暂不接入扫描服务
- **Phase 2（Content Center/AI 原始资料导入区）：** 若引入第三方文件，须在独立导入区加入 ClamAV 或等效扫描，不在公开媒体库上传入口部署
- **M8 上线前：** 评估 ClamAV 容器集成，并在 Nginx 层加文件类型白名单作为额外防线

### 5.5 存储容量与迁移边界

| 项目 | 当前值 | 规划 |
|------|--------|------|
| 当前媒体文件数 | ~13 个（测试阶段）| - |
| 单文件上限 | 50 MB | 保持不变 |
| 存储位置 | Directus bind mount（`DIRECTUS_UPLOADS_DIR`，由 `.env` 指定）| 本地磁盘 |
| 腾讯云 COS 迁移 | ❌ 不在当前阶段 | 上线后视实际容量决定（见决策 #13）|

**COS 迁移当前阶段禁止事项：**

- 不接入腾讯云 COS SDK
- 不修改 Docker 存储卷配置
- 不在 `.env` 中添加 COS Key/Secret
- 不更改 Directus 文件存储驱动配置

### 5.6 Directus Collection 配额规划

Directus Community Edition 上限 25 个 collection，**当前已用 15 个**，剩余 10 个须统筹。

| Collection | 状态 |
|-----------|------|
| `product_categories` | ✅ 已有 |
| `products` | ✅ 已有 |
| `products_files`（M2M）| ✅ 已有 |
| `site_content` | ✅ 已有 |
| `posts` | ✅ 已有 |
| `inquiries` | ✅ 已有 |
| `product_page_presets` | ✅ 已有 |
| `product_sections` | ✅ 已有 |
| `product_section_items` | ✅ 已有 |
| `product_spec_groups` | ✅ 已有 |
| `product_spec_items` | ✅ 已有 |
| `product_faqs` | ✅ 已有 |
| `product_source_records` | ✅ 已有 |
| `site_settings` | ✅ 已有 |
| `site_social_links` | ✅ 已有 |
| **当前已用** | **15 个** | |
| 归档状态表（9C-2，若用 Directus Collection）| 预留 1 个（决策 #10：使用独立 Collection 时消耗；使用 Postgres 表时不消耗）|
| `product_import_jobs`（Phase 9B）| 预留 1 个 | |
| 其他 9B/Content Center 待定 | 预留 8–9 个 | |

> 归档状态的实现选 Directus Collection 时剩余配额为 8 个；选独立 Postgres 表时为 9 个。9C-2 授权前须按决策 #10 确定实现方式，以更新此表。

---

## 六、Phase 9B 接口与安全边界（9C-2 视角）

> **范围说明：** 本章从 9C-2 的视角，定义与未来 Phase 9B（AI 产品资料导入与人工审核）之间的接口约束和安全边界。Phase 9B 须在 9C-2 完成后单独授权；本章内容在 9B 授权前不触发任何代码或 API 设计。

### 6.1 AI 可访问范围（Phase 9B，须单独授权后方可实施）

| 层次 | AI 可读 | AI 可写 | 说明 |
|------|---------|---------|------|
| 私有原始资料导入区（另行设计）| ✅（Phase 9B 授权后）| ❌ | AI 只读源文件 |
| `product_source_records` | ✅ | ✅（只能写 `needs_review`）| AI 写入来源记录；不可写 `confirmed` |
| `directus_files` 元数据 | ✅（已授权文件只读）| ❌ | AI 不上传、不移动、不修改媒体 |
| `products`（Draft 状态）| ✅（只读参考）| ❌ | AI 不直接修改产品主表 |
| `product_spec_groups` / `product_spec_items` | ✅（只读参考）| ❌ | AI 不直接写参数 |
| `product_faqs` | ✅（只读参考）| ❌ | AI 不直接写 FAQ |
| **Published 状态的任何产品数据** | ❌ | ❌ | AI 完全不可访问 Published 内容 |
| SEO 字段（`seo_title`、`seo_description`）| ❌ | ❌ | - |
| `seo_noindex` / sitemap 配置 | ❌ | ❌ | - |
| `products_files`（产品媒体引用）| ❌ | ❌ | AI 不创建或修改媒体引用 |

### 6.2 AI 写入的唯一合法路径

```
私有原始资料导入区（PDF / Word）
  ↓ AI 读取 + 文字提取
product_source_records（review_status = 'needs_review'）
  ├─ source_file_id    : 原始文件 UUID（必须有，否则拒绝创建）
  ├─ source_locator    : 文件内位置（页码、段落标识）
  ├─ raw_excerpt       : 原文摘录（≤2000 字符，UTF-8）
  ├─ fact_key          : 目标产品字段键名（如 "spec.detection_sensitivity"）
  ├─ review_status     : 'needs_review'（AI 只能设此值）
  └─ note              : AI 置信度描述或冲突说明
  ↓ 人工审核（逐条，不允许批量确认全部）
  review_status = 'confirmed'（仅人工操作，AI 不可改 review_status）
  ↓ 人工手动将 confirmed 来源值填入产品字段
products / product_spec_items（人工填写）
```

### 6.3 AI 永不允许的操作（硬边界，不可在任何情况下放宽）

1. AI 不直接写 `products`、`product_spec_items`、`product_faqs` 或任何正式产品表
2. AI 不将任何记录的 `review_status` 设为 `confirmed`（只能设 `needs_review`）
3. AI 不修改 `status = 'published'` 的任何产品数据
4. AI 不写入 `seo_title`、`seo_description`、`seo_noindex` 或 sitemap 相关字段
5. AI 不上传、移动、归档或删除 `directus_files` 中的任何文件
6. AI 生成内容不自动进入前台可见范围（无论是 Review 还是 Published）
7. AI Key 只存 `.env`，不进 Git，不进任何文档或注释
8. **本规划阶段（9C-2 开发前）绝不配置 AI Key、调用模型或产生任何 AI 相关费用**

### 6.4 来源追溯要求（Phase 9B 实现时强制）

每条 AI 生成的 `product_source_record` 必须包含以下字段，缺一不可：

| 字段 | 要求 |
|------|------|
| `source_file_id` | 原始文件 UUID（必须有，为 null 则拒绝创建）|
| `source_locator` | 文件内位置（页码、段落 ID 等）|
| `raw_excerpt` | 原文摘录（≤2000 字符，UTF-8）|
| `fact_key` | 对应产品字段键名（格式待 9B 设计时确认）|
| `review_status` | 必须为 `'needs_review'`（不接受其他值）|
| `note` | AI 置信度描述（不可为空字符串）|

没有 `source_file_id` 的 AI 建议记录一律视为无效，API 层须返回 422 拒绝。

### 6.5 人工审核 UI 要求（Phase 9B 设计时确认）

- 管理员逐条查看 `product_source_records`：左侧 `raw_excerpt`，右侧对应当前产品字段值
- 管理员点击"确认"才可将 `review_status` 改为 `confirmed`（服务端校验，不接受 API 直接 PATCH）
- 管理员可标记 `conflict`（与现有参数冲突）或 `missing`（无法提取有效值）
- 系统以颜色标注置信度低、冲突或缺失的记录
- **禁止"批量确认全部"按钮**（防止批量无审核）
- 每次确认操作写入审计日志（操作者、source_record ID、时间戳）

---

## 七、实施模块拆分与依赖顺序

### 7.1 依赖图（严格顺序，每步须独立授权）

```
[当前已完成]
  ✅ 9A-2 核心闭环（发布/撤回/预览）
  ✅ 9C-1 Media Library 基础版（上传/列表/文件夹/关联）
  ✅ M4-Next-3 Settings 最小版
  ✅ B0-0 媒体治理规范 v0.1
  ✅ 9A-2C 本地发布/撤回验收

[待授权，严格顺序]
  9C-2：Media Library 批量选择/归类 + 引用查询 + 软归档
      ↓（独立授权）
  真实 Draft 产品试点（第一款真实产品手工录入）
      ↓（独立授权）
  Phase 9B：AI 产品导入助手（须 AI Provider Key 单独授权）
      ↓（独立授权）
  Content Center（博文/资源/页面综合管理）
      ↓（独立授权）
  M8 正式上线（push + DNS + 生产部署）
```

### 7.2 各模块规格

#### 9C-2 — Media Library 批量选择/归类（预留编号，待授权）

| 项目 | 内容 |
|------|------|
| 目标 | Admin UI 多选批量移动文件夹；全局引用查询 API；软归档基础 |
| 允许改动 | `pages/admin/media/index.vue`；新建 Admin API（references、archive）；Directus schema 扩展（`archived` 字段，取决于决策 #10）|
| 禁止事项 | 不改产品/规格/FAQ 数据；不接 AI 或任何外部服务；不扩展格式白名单；不实现物理删除 |
| 测试数据 | 现有 ~13 个 `test-only` 文件夹媒体文件；不修改真实产品（目前无真实产品）|
| 验收条件 | 见 §4.4；typecheck 0 / lint 0 / build SUCCESS / diff --check exit:0 |
| 停止条件 | 发现 Directus Community Edition 不支持 schema 扩展方式 → 停止并报告，等待决策 #10 重新确认 |

#### 真实 Draft 产品试点（待授权）

| 项目 | 内容 |
|------|------|
| 目标 | 手工录入第一款真实产品（不改代码）；验证前台渲染、noindex、SEO |
| 允许改动 | 只创建新 Directus 数据（新 Draft 产品，ID≠3）；不改代码 |
| 禁止事项 | 不在 ID=3 上录入真实数据；不发布；不改代码或 schema |
| 进入条件 | 用户提供真实产品资料（≥1 款）；9C-2 已完成或用户明确决定跳过 |
| 验收条件 | Draft 产品在 Admin 可编辑；前台 noindex 正确；SEO 预览正确；管理员预览可见；ID=3 仍为 TEST ONLY draft |
| 停止条件 | Admin UI 或前台发现影响真实产品录入的缺陷 → 停止，记录缺陷，等待授权修复 |

#### Phase 9B — AI 产品导入（待授权，须单独 AI Key 授权）

| 项目 | 内容 |
|------|------|
| 目标 | Provider Adapter（OpenAI/DeepSeek/Mock）；原始资料读取 → `product_source_records`（needs_review）；Admin 审核 UI |
| 允许改动 | 新建 `product_import_jobs` collection；激活 `product_source_records` 使用流程；AI Admin UI；`.env` 配置 |
| 禁止事项 | AI 不写 `products`/`product_spec_items`/`product_faqs`；AI 不改 Published 产品；未经授权不配置真实 AI Key |
| 进入条件 | ≥1 款真实 Draft 产品试点通过；`product_source_records` 人工使用流程已验证；用户单独授权 AI Key（见决策 #8）|
| 验收条件 | Mock Provider 完整测试通过；source_record → 人工审核 → confirmed → 产品发布全流程闭环 |
| 停止条件 | AI 生成内容绕过审核直接出现在前台或 Published 产品 → 立即停止，不上线，不 push |

#### Content Center（待授权）

| 项目 | 内容 |
|------|------|
| 目标 | 博文、资源、页面等内容综合管理；Media Library 媒体引用集成 |
| 进入条件 | M4 阶段核心功能全部完成（含 9C-2 + 真实产品试点）；用户确认所需管理的内容类型；用户单独授权 |
| 备注 | Admin 导航中 Content Center 目前为 `<span>（disabled）`；Content Center 开放后改为 `<NuxtLink>` |

---

## 八、开放决策记录（分组）

以下决策涉及业务规则、架构选择或资源投入，**不可由开发方代为决定**。
已确认的决策标注日期；未确认决策须在对应阶段**开始前**获得用户明确授权。

### 已确认决策

| # | 内容 | 确认日期 |
|---|------|---------|
| #1 | 测试产品 ID=3 保留为 TEST ONLY，真实产品必须新建 | 2026-09-04 |
| #2 | 文件夹命名规范与 8 个推荐文件夹（详见 §2.1）| 2026-09-04 |
| #3 | Word/Excel 原始资料不进 Media Library | 2026-09-04 |
| #10 | 软归档状态使用**独立 Directus Collection 或独立 Postgres 数据表**关联 file_id；**不修改 directus_files 表结构** | 2026-09-04 |
| #11 | 管理员引用 API 返回数量 + 引用实体名称/ID/file_role；**公开 API 不暴露任何引用信息** | 2026-09-04 |
| #12 | SHA-256 仅提示重复（UI 显示已有相同内容文件的 UUID）；管理员可确认后继续上传；**不自动合并、不强制阻止** | 2026-09-04 |

---

### 第一组：9C-2（M4-Next-2）开发前必须确认

> 决策 #10、#11、#12 已于 2026-09-04 确认，**第一组全部清除**。
> 9C-2 开发所需的全部阻塞决策已就绪，可以授权开始开发。

（无待确认项）

---

### 第二组：可延后至真实产品录入 / Product Dossier / Phase 9B / 上线前确认

> **以下决策不阻塞 9C-2 开发。可在 9C-2 完成并验收后，在对应阶段开始前再确认。**

---

#### ⏳ 决策 #5 — `version_label` 格式规范【不阻塞 9C-2，真实产品录入前确认】

`products_files.version_label`（产品媒体引用的版本标签）当前为自由文本，是否强制格式？
- **选项 A：自由文本**（操作灵活，但查询/排序困难）
- **选项 B：强制格式**（如 `"2024-CE"`、`"v2024-01"`）— 需确认格式规则，并在 Admin UI 加校验

9C-2 不涉及此字段的格式校验，可在首款真实产品录入前确认。
**最晚确认时机：** 真实 Draft 产品试点授权前

---

#### ⏳ 决策 #4 — ProductFamily 层级（Product Dossier 阶段前）

当前以 `product_categories` 作为顶层分类，是否需要在其之上建立"产品族"层（如"X 射线系列"跨越多个 category）？
**最晚确认时机：** Product Dossier schema 设计授权前

---

#### ⏳ 决策 #6 — 证书到期管理（Product Dossier 阶段前）

证书 PDF 是否需要记录 `expires_at` 字段并在 Admin UI 显示到期预警？
**最晚确认时机：** Product Dossier schema 设计授权前

---

#### ⏳ 决策 #7 — 媒体备份磁盘路径（B0-4 独立运维任务，随时可提供）

**B0-4**（Directus uploads 媒体备份至外部磁盘）和 B0-5（`private-product-source/` 备份）均为独立运维任务，不阻塞任何开发阶段。用户提供外部磁盘路径或网络存储路径后即可执行。
**最晚确认时机：** 任何时候均可提供，越早越好

---

#### ⏳ 决策 #8 — AI Provider 选择（Phase 9B 授权时）

Phase 9B 使用 OpenAI 还是 DeepSeek？月度预算上限是多少？
**最晚确认时机：** 用户授权开始 Phase 9B 时（须同时提供 API Key 写入 `.env`）

---

#### ⏳ 决策 #9 — 未来管理员角色扩展（Product Dossier / Phase 9B 前）

是否在 Administrator 之外增加 Editor（编辑者）和 Reviewer（审核者）角色？若是，触发 Directus 角色/权限变更。
当前仅 Administrator，不新增角色。
**最晚确认时机：** Product Dossier 开始前或 Phase 9B 授权时（AI 审核流程对 Reviewer 角色有较强需求）

---

#### ⏳ 决策 #13 — 腾讯云 COS 迁移触发条件（M8 上线前）

媒体文件数 > 500 或磁盘使用 > 5 GB 时触发 COS 迁移评估，该阈值是否合理？是否有其他触发条件（成本、带宽、灾备）？
**最晚确认时机：** M8 正式上线准备阶段

---

## 九、本文件更新规则

1. 每完成一个阶段，在对应节中标注 ✅ 和完成日期。
2. 开放决策被用户确认后，在该决策项下标注确认内容和日期，不删除原决策。
3. 如确认结论与本文件其他节内容有矛盾，同步更新相应节，并标注"已更新"。
4. 不在本文件中记录任何 Token、密码、数据库连接字符串、真实产品参数值或个人信息。
5. 不在本文件中创建虚构型号或技术指标。
6. 与 `MEDIA-AND-PRODUCT-DATA-GOVERNANCE.md` 产生矛盾时，以本文件最新版本为准——除 v0.1 已确认的决策 #1/#2/#3 外，那三条决策不可由本文件推翻。

---

*最后更新：2026-09-04，文件重命名为 `PHASE-9C-2-MEDIA-LIBRARY-FOUNDATION-SPEC.md`；决策 #10/#11/#12 已确认；#5 移入延后组。*
