# LITUBO — Media Governance & Product Dossier Blueprint

> 本文件是媒体资产治理与产品事实模型的长期规范。它描述当前已实现的事实边界，并为未来各阶段（9C-2 批量归类、产品事实试点、AI 导入、Content Center）建立可扩展但不推翻现有实现的治理原则。
>
> **本文件只是规范和计划，不触发任何代码、schema 或数据变更。**

---

## 一、当前已实现事实与已知限制

### 1.1 文件存储模型（已实现）

| 事实 | 说明 |
|------|------|
| 每个文件一个 Directus UUID | `directus_files.id`，全局唯一，贯穿所有引用关系 |
| 每个文件只属于一个文件夹 | `directus_files.folder` 为单父 UUID 或 null（根目录），无多文件夹归类 |
| 当前支持格式 | `image/jpeg`、`image/png`、`image/webp`、`application/pdf`，禁止 GIF/BMP/SVG/Word/Excel/ZIP |
| 上传大小上限 | 50 MB / 单文件 |
| 文件数量上限 | API 单次返回 200 条（`MAX_LIMIT`） |
| 存储位置 | Directus bind mount，由 `.env` 中 `DIRECTUS_UPLOADS_DIR` 指定，不在代码仓库中 |

### 1.2 当前文件元数据可编辑字段（已实现）

Admin API `PATCH /api/admin/media/:id/meta` 白名单：

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string ≤255 | 人类可读文件标题（语言不敏感，全局共用） |
| `description` | string ≤1000 | 内部描述备注 |
| `folder` | UUID \| null | 单父文件夹归属 |

**尚未实现（当前 meta PATCH 拒绝的字段）：** `alt`（多语言）、tags、copyright、source_url、is_public、版本标签、状态。

### 1.3 当前搜索与筛选（已实现）

| 功能 | 支持 | 说明 |
|------|------|------|
| 文件夹筛选 | ✅ | 按单个 folder UUID 或 root 筛选 |
| 类型筛选 | ✅ | image/* 或 application/pdf |
| 文本搜索 | ✅ | Directus 原生 `?search=`，匹配 filename/title |
| 标签搜索 | ❌ | 无标签系统 |
| 来源/版本筛选 | ❌ | 无此字段 |

### 1.4 当前产品媒体引用关系（已实现）

`products_files` M2M junction 已有字段：

| 字段 | 意义 |
|------|------|
| `directus_files_id` | 指向 `directus_files.id`（文件只存一份，引用关系存 junction） |
| `file_role` | 当前 11 值：`hero / overview / application / detail / gallery / video_poster / brochure / datasheet / drawing / manual / certificate` |
| `alt_en/es/pt` | 多语言 ALT 文字（产品上下文专属） |
| `caption_en/es/pt` | 多语言图注 |
| `enabled` | 是否在前台显示 |
| `language` | 文件适用语言：`all / en / es / pt / null` |
| `version_label` | 版本标签（自由文本，无强制格式） |
| `sort` | 手动排序 |
| `file_date` | 文件日期（可选） |

**已实现保护：** 同一文件不可在同一产品内重复关联（前端 `existingFileIds` 防重）。

### 1.5 当前未实现的功能（已知限制）

| 功能 | 状态 | 计划阶段 |
|------|------|---------|
| 文件级重复检测（hash/名称去重） | ❌ 未实现 | 9C-2 或手动管理 |
| 标签（Tags）系统 | ❌ 未实现 | Product Dossier 阶段 |
| 批量归类（多选→移动文件夹）| ❌ 未实现 | 9C-2 |
| 批量删除 / 回收站 | ❌ 未实现 | 待定 |
| 文件版本历史 / Diff | ❌ 未实现 | 待定 |
| 全局多语言 ALT（文件级，非 junction 级）| ❌ 未实现 | Product Dossier |
| 文件来源、版权、到期日 | ❌ 未实现 | Product Dossier |
| PDF 文字提取 / OCR | ❌ 未实现 | AI 阶段 |
| Word/Excel 原始资料纳入 Directus | ❌ 未实现，当前被拒绝 | 另行设计 |

---

## 二、长期分层治理原则

媒体资产治理分为五层，从下至上：

```
┌─────────────────────────────────────────────────────┐
│  层 5：AI 建议与人工审核                              │
│  (产品事实草稿 + 来源引用，永远需要人工审核后发布)    │
├─────────────────────────────────────────────────────┤
│  层 4：Product Dossier 产品事实                       │
│  (型号、技术参数、规格、单位、语言、版本、审核状态)   │
├─────────────────────────────────────────────────────┤
│  层 3：产品 / 内容引用关系                            │
│  (products_files junction：角色、ALT、caption、排序)  │
├─────────────────────────────────────────────────────┤
│  层 2：媒体元数据                                     │
│  (title、description、folder、来源、版权、状态)       │
├─────────────────────────────────────────────────────┤
│  层 1：原始资产                                       │
│  (Directus UUID、二进制文件、MIME、尺寸、哈希)        │
└─────────────────────────────────────────────────────┘
```

### 核心原则

1. **型号、技术参数、语言、版本不以文件夹名或文件名为唯一真实来源。**  
   文件夹和文件名是人类可读的组织工具，真实参数存于 Product Dossier（层 4）的结构化字段中。文件夹/文件名变更不应破坏产品参数的正确性。

2. **文件只存一份，引用关系存 junction。**  
   同一张图片可被多个产品、多个角色（Hero、Gallery、Brochure……）引用，junction 记录角色和上下文。删除 junction 行不删除文件本体；删除文件本体需先确认无任何 junction 引用。

3. **原始文件不转成图片作为唯一资料。**  
   Word/Excel 原始资料保留原始格式，PDF 可生成预览图，但预览图与原始文件独立存储，两者都不替代对方。

4. **文字提取只产生待审核建议，永不自动写入 Published 产品。**  
   PDF 文字提取（AI 阶段）的输出落入 `product_source_records`，`review_status = needs_review`，人工确认后才可升级到 Approved/Published。

5. **同一资产在不同页面的 Hero/Gallery/Manual 角色属于引用关系，不属于文件本体属性。**  
   `file_role` 是 junction 字段，不是 `directus_files` 字段；同一文件在产品 A 是 Hero，在产品 B 是 Gallery，这两条引用关系独立存在。

---

## 三、各字段分层归属与实现阶段

### 3.1 文件级元数据

| 字段 | 现在必须有 | 放到 9C-2 | 放到 Product Dossier | 放到 AI 阶段 | 说明 |
|------|-----------|---------|---------------------|------------|------|
| `title`（全局） | ✅ 已有 | — | — | — | 人类可读，语言不敏感 |
| `description`（内部备注）| ✅ 已有 | — | — | — | 内部管理用 |
| `folder` | ✅ 已有 | — | — | — | 单父归属 |
| `tags` | ❌ | 评估 | ✅ | — | 多值标签，需 schema 扩展 |
| `source_url`（来源链接）| ❌ | ❌ | ✅ | — | 图片/文件原始来源 URL |
| `copyright_notice` | ❌ | ❌ | ✅ | — | 版权声明，仅供内部 |
| `expires_at` | ❌ | ❌ | ✅ | — | 版权或授权到期日 |
| `hash_sha256` | ❌ | 评估 | ✅ | — | 去重/完整性校验 |
| `is_public` | ❌（已有字段，Admin 不暴露）| ❌ | 评估 | — | 不向 `nuxt-server` 暴露 |
| `ocr_text`（提取文本）| ❌ | ❌ | ❌ | ✅ | AI 提取，仅存 source_records |

### 3.2 产品 / 内容引用字段（products_files junction）

| 字段 | 现在必须有 | 下一步 | 说明 |
|------|-----------|--------|------|
| `file_role`（11 值）| ✅ 已有 | — | 可按需扩展 enum |
| `alt_en/es/pt` | ✅ 已有 | — | 产品上下文 ALT，多语言 |
| `caption_en/es/pt` | ✅ 已有 | — | 产品上下文图注 |
| `enabled` | ✅ 已有 | — | 显示开关 |
| `language` | ✅ 已有 | — | all/en/es/pt |
| `version_label` | ✅ 已有 | — | 自由文本，暂无强制格式 |
| `sort` | ✅ 已有 | — | 手动排序 |
| `file_date` | ✅ 已有 | — | 文件日期 |

### 3.3 Product Dossier 字段（待 schema 扩展，非当前阶段）

| 字段组 | 说明 |
|--------|------|
| 产品族 / 型号 / 变体 | `family`、`model`、`variant_code`（结构化，不以文件名为准） |
| 技术参数 | `product_spec_groups` + `product_spec_items`（已有基础，扩展） |
| 单位制 | `unit_system`（SI/Imperial），`unit`（各参数单独存） |
| 来源文件引用 | `product_source_records.source_file_id`（Directus UUID 已有） |
| 语言版本 | `product_source_records.language`（资料原始语言） |
| 审核状态 | `review_status`：`confirmed / needs_review / missing / conflict`（已有） |
| draft→review→published 状态机 | 见第五节 5.3 |

---

## 四、各类文件的正确处理规则

### 4.1 图片（PNG / JPG / WebP）

- **上传**：进 Directus `directus_files`，自动生成 UUID，无重命名。
- **展示**：通过 Directus Assets 端点（`/assets/:id`）加 `?width=&format=webp` 参数按需转换。
- **文件夹**：按已确认命名规范归类（见第七节决策 #2）；文件夹名仅为组织用，不是型号/语言的权威来源，不以页面用途或营销活动命名。
- **ALT**：在 `products_files.alt_en/es/pt` 填写，而不是在 `directus_files.title` 里编码语言信息。
- **重复上传**：当前无自动去重；人工管理，9C-2 评估 hash 去重方案。

### 4.2 PDF（说明书、数据表、证书）

- **上传**：进 `directus_files`，`type = application/pdf`，`file_role = manual / datasheet / certificate / brochure` 等。
- **前台展示**：提供下载链接，不强制内嵌 viewer（移动端兼容性差）。
- **文字提取**：AI 阶段实现，提取结果只写入 `product_source_records`，`review_status = needs_review`。**PDF 文字提取不直接更新产品规格或正文。**
- **原始 PDF 不被图片替代**：将 PDF 扫描成图片不等同于保留 PDF；两者独立存储。

### 4.3 Word / Excel 原始资料（已确认规则，v0.1）

- **当前状态**：当前上传 API 拒绝 `.docx`/`.xlsx`（格式白名单只含 JPG/PNG/WebP/PDF），此限制保持不变。
- **存放位置**：原始 Word、Excel 及未审核源文件保留在私有原始资料库（`private-product-source/`），不进 Directus Media Library，不进 Git，不对外公开。
- **公开版本处理**：经审核可供下载的说明书使用 **PDF 格式**进入 Media Library；不以 Word/Excel 原始文件替代 PDF 作为公开资料。
- **AI 阶段隔离**：后续 AI 阶段如需处理 Word/Excel，须设计独立的受保护原始资料导入区，不得直接复用公开媒体库的上传流程，不得扩展现有白名单至 `.docx`/`.xlsx`。
- **不转图片原则**：原始 Word/Excel 不转成图片作为唯一资料；PDF 与原始文档独立存储，互不替代。

### 4.4 证书类文件

- 以 PDF 上传，`file_role = certificate`。
- 在 junction 中填写 `language`（证书原始语言）和 `version_label`（认证批次/年份，如 `"2024-CE"`）。
- 证书到期日在 Product Dossier `expires_at` 字段管理（当前未实现），不依赖文件名。

---

## 五、Product Dossier 候选实体、字段分组与状态规则

### 5.1 候选实体层级

```
产品族 (ProductFamily)
  └── 产品 / 型号 (Product / AdminProduct) ← 已有
        ├── 变体 (ProductVariant)            ← Product Dossier 新增（待授权）
        ├── 规格组 (ProductSpecGroup)        ← 已有
        │     └── 规格行 (ProductSpecItem)  ← 已有
        ├── 媒体引用 (products_files)        ← 已有
        ├── 来源记录 (product_source_records)← 已有（待 AI 阶段激活）
        └── FAQ (product_faqs)              ← 已有
```

> **ProductFamily** 尚未建立，当前以 `product_categories` 代替。是否需要独立的"产品族"层（如"X 射线系列"跨越多个 category），需用户确认（开放决策 #4）。

### 5.2 核心字段分组

| 分组 | 字段 | 已实现 |
|------|------|--------|
| 身份与状态 | `id`、`slug`、`status`、`published_at` | ✅ |
| 型号 | `model_or_series`（当前自由文本） | ✅（粗粒度）|
| 多语言名称与摘要 | `name_en/es/pt`、`summary_en/es/pt` | ✅ |
| 结构化规格 | `product_spec_groups` + `product_spec_items`（含 note_en/es/pt）| ✅ |
| 媒体引用 | `products_files`（11 种 file_role）| ✅ |
| SEO | `seo_title_en`、`seo_description_en`、`seo_noindex` | ✅ |
| 来源溯源 | `product_source_records`（source_file_id、fact_key、review_status）| ✅（待激活） |
| 变体 / 配置 | — | ❌ 待设计 |
| 单位制 | — | ❌ 待设计 |
| 认证 / 合规 | — | ❌ 待设计（与证书 PDF 关联） |
| 版本历史 | — | ❌ 待设计 |

### 5.3 产品状态机与边界（draft / review / published / archived）

当前状态机（已实现，全小写与代码一致）：

```
draft ↔ review → published → draft（撤回）
                           → archived
```

Product Dossier 引入"来源审核"后的扩展方向（概念，AI 阶段另行设计）：

```
来源记录（source_records）：needs_review → confirmed / conflict / missing
规格行与产品的发布约束：source_record.review_status 为 confirmed
                        → 产品可进入 review → published 流程

注：规格行本身不新增独立状态字段；约束通过 review_status 与产品 status
的组合规则实现，具体方案在 AI 阶段设计时确定。
```

**约束（永久有效）：**
- `review_status = needs_review` 的 source_record 不得成为 Published 产品的唯一规格来源。
- AI 只能写入 `product_source_records`，永不直接写入 `products`、`product_spec_items` 或 `product_faqs`。

### 5.4 不可虚构原则

任何阶段均不得：
- 在 source_records 中创建无原始来源的"参数"条目；
- 将 AI 生成的参数标记为 `review_status = confirmed`；
- 将无实物依据的型号、规格值、认证编号写入任何已 Published 产品。

---

## 六、各阶段准确进入条件与顺序

### 阶段 9C-2：Media Library 批量选择 / 归类

**准入条件（全部满足才可开始）：**
1. M4-Next-3 Settings 最小版业务验收通过（✅ 已完成，2026-09-04）
2. 用户明确授权 9C-2 开始

**范围：**
- Admin UI：多选文件 → 批量移动到文件夹
- 文件搜索增强（可按标签、来源等扩展，需用户确认范围）
- 可选：文件 hash 去重提示（上传时检测 SHA-256 是否已存在）

**禁止：**
- 不建新 Directus collection
- 不修改已有产品、规格、FAQ 数据
- 不接 AI 或外部服务

---

### 真实 Draft 产品试点（产品事实录入先导）

**准入条件（全部满足才可开始）：**
1. 9C-2 完成或用户决定跳过 9C-2 直接进入
2. 至少一款真实产品的资料已完整准备（原始 PDF 或 Word 可读取）
3. 用户明确授权开始真实数据录入
4. 测试产品 ID=3 处置规则已确认（见第七节决策 #1）：保留为 TEST ONLY 模板，真实资料**必须新建独立 Draft 产品**，不得在 ID=3 上录入真实数据

**范围：**
- 在现有 Admin UI 中手工录入第一款真实产品（slug、规格组、FAQ、媒体关联）
- 录入完成后验证前台渲染正确、SEO noindex 设置正确
- 不发布；保持 Draft 状态直到全量审核通过

---

### Phase 9B — AI 产品导入与审核

**准入条件（全部满足才可开始）：**
1. 真实 Draft 产品试点验收通过（至少 1 款）
2. `product_source_records` 溯源字段使用流程已人工验证
3. 用户在 9B 开始时单独授权接入 AI Provider（OpenAI 或 DeepSeek）
4. `.env` 中配置 `AI_DEFAULT_PROVIDER`、`AI_DEFAULT_MODEL`、`AI_MONTHLY_BUDGET_USD`
5. AI Key 只写 `.env`，不进 Git，不进任何文档

**不变约束：**
- AI 只写 `product_source_records`（层 2），不直接写 `products` 或 `product_spec_items`
- AI 写入的 source_records 初始 `review_status = needs_review`
- 管理员逐条审核后才可标记 `confirmed`
- 任何 AI 建议只有在产品 status = draft 时才可关联；绝不在 Published 产品上直接 AI 写入

---

### Content Center

**准入条件：**
1. M4 阶段核心功能全部完成（含 9C-2 + 真实产品试点）
2. 用户确认 Content Center 所需管理的内容类型（博文、资源、页面……）
3. 用户单独授权

---

### 正式上线前提（M8 进入条件，完整版见 MASTER-ROADMAP.md）

- 所有真实产品数据完整录入并人工审核通过
- ES/PT 内容译文审核通过（M6）
- HubSpot Token 配置完成（M7）
- 认证并发安全在独立测试环境完整验收（含多实例场景）
- 代码 push 到 GitHub，CI 通过（B0-1 ✅ 已完成）

---

## 七、开放决策记录

以下决策涉及业务命名、数据保留、真实产品事实或平台规则，**不可由开发方代为决定**。已确认的决策标注确认日期；未确认的决策必须在相应阶段开始前获得用户明确授权。

---

### ✅ 决策 #1 — 测试产品 ID=3 的处置（已确认，2026-09-04）

**确认规则（v0.1）：**
- ID=3（`TEST ONLY — NOT FOR PUBLICATION`，status=draft）**保留**为功能测试模板，不转为真实产品，不删除，不发布。
- 真实产品资料录入时**必须新建独立 Draft 产品**，不得在 ID=3 上录入或修改任何真实参数。
- 后续如需清理 ID=3，须进入单独的数据清理 / 归档流程，并在当时单独授权。

---

### ✅ 决策 #2 — 文件夹命名与归类规范（已确认，2026-09-04）

**确认规则（v0.1）：**
- 文件夹名使用**英文、小写、kebab-case**（如 `products/xray`，不是 `X射线` 或 `XRay`）。
- 文件夹只表达**稳定业务大类**，不以型号、语言、Hero/Gallery、营销活动或具体页面用途作为文件夹层级。
- 型号信息进入 Product Dossier 结构化字段；语言、版本、用途、排序和页面 ALT 属于元数据或 junction 引用关系，不在文件夹名中体现。
- **v0.1 推荐文件夹结构：**

  | 文件夹路径 | 用途 |
  |-----------|------|
  | `products/xray` | X 射线检测设备图片与 PDF |
  | `products/metal-detection` | 金属检测设备图片与 PDF |
  | `resources/manuals` | 可公开的操作说明书（PDF） |
  | `resources/certificates` | 认证证书（PDF） |
  | `home` | 首页用图 |
  | `applications` | 应用场景图 |
  | `brand` | 品牌标识、Logo |
  | `test-only` | 测试专用媒体（不对外） |

- 新文件夹名须在此文件中记录后方可创建，保持目录结构可追溯。

---

### ✅ 决策 #3 — Word / Excel 原始资料处理（已确认，2026-09-04）

**确认规则（v0.1）：**
- 原始 Word、Excel、未审核源文件**不进入** Directus Media Library，也不进 Git，不公开。
- 此类文件保留在私有原始资料库（`private-product-source/` 或同等受控目录），不扩展现有上传白名单。
- 审核后可公开 / 下载的说明书**以 PDF 格式**进入 Media Library（`resources/manuals` 文件夹）。
- 后续 AI 阶段如需读取 Word/Excel，须另行设计**独立的受保护原始资料导入区**，不复用公开媒体库上传流程，须单独授权后实施。

---

### ⏳ 决策 #4 — ProductFamily 层级是否需要（待确认）

当前以 `product_categories` 作为顶层分类是否足够，还是需要在 category 之上建立"产品族"（如"X 射线系列"）以支持跨类型产品关联？

**影响阶段：** Product Dossier 设计阶段

---

### ⏳ 决策 #5 — `version_label` 格式规范（待确认）

`products_files.version_label` 当前为自由文本。是否需要强制格式（如 `"v2024-01"`）？还是允许自由填写？

**影响阶段：** 9C-2 或手动产品录入前

---

### ⏳ 决策 #6 — 证书到期管理（待确认）

证书 PDF 是否需要记录"到期日"并在 Admin UI 中提醒到期？还是仅作为静态文件引用？

**影响阶段：** Product Dossier 设计阶段

---

### ⏳ 决策 #7 — 媒体备份磁盘路径（待确认）

B0 媒体备份计划（B0-4）需要用户提供外部磁盘或网络路径，方可执行备份。

**影响阶段：** B0 执行阶段

---

### ⏳ 决策 #8 — AI Provider 选择（待确认）

9B 阶段使用 OpenAI 还是 DeepSeek？月度预算上限是多少？

**影响阶段：** Phase 9B 授权时

---

## 八、本文件更新规则

- 每完成一个阶段，在对应节中标注 ✅ 和完成日期。
- 开放决策被用户回答后，在表格中标注回答内容，不删除原决策项。
- 不在本文件中记录任何 Token、密码、数据库连接字符串或真实产品参数值。
- 不在本文件中创建虚构型号或技术指标。

---

*最后更新：2026-09-04，B0-0 只读规划写入；决策 #1/#2/#3 用户确认为 v0.1 正式治理规则。*
