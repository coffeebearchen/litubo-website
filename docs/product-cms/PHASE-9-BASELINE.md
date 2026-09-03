# Phase 9 基线规范（9A-1 / 9A-2 / 9B）

> 本文件固化 Phase 9 的三层架构、数据模型、操作守则。任何与本文件冲突的实施决策必须先修订本文件并获得用户确认，再动代码。

---

## 一、三层架构（不可改变）

```
Directus 11（内网 :8055）
    ↓  管理员 JWT（httpOnly Cookie）
LITUBO Admin（/admin/* 内部 Nuxt 页面）
    ↓  只读 nuxt-server 静态 Token
公开 Nuxt 前台（/products/... 及其他公开路由）
```

### 层间安全边界

| 访问方向 | 规则 |
|---------|------|
| 公开前台 → Directus | 禁止直接调用；只能经 Nuxt server API 层 |
| Admin → Directus | 用管理员 JWT；JWT 存 httpOnly Cookie；不返回到浏览器 JS |
| `nuxt-server` 静态 Token | 只读，只读已发布内容；绝不用于写操作 |
| `product_source_records` | 只有管理员 JWT 可读写；`nuxt-server` 无任何权限 |
| Directus | 不对公网开放；仅 `127.0.0.1:8055` |

---

## 二、产品数据模型（已固化字段）

### 2.1 `products` collection 核心字段

既有字段（不删改）：id、status、slug、category_id、name_en/es/pt、summary_en/es/pt、hero_image、highlights（json Repeater）、specifications（json JSONB）、related_product_slugs、application_slugs、seo_title/description/image/noindex、sort、date_created、date_updated

9A-1 新增：model_or_series、page_preset_id（→ product_page_presets M2O）、published_at、review_notes

status 枚举：draft / review / published / archived（9A-1 限制：只允许 draft ↔ review 转换）

**不允许新增**：`body_en`、`body_es`、`body_pt`（正文一律通过 `product_sections` 管理）

### 2.2 `product_page_presets` collection（9A-1 新建）

| 字段 | 类型 |
|------|------|
| id | integer PK |
| code | varchar unique |
| name_en | varchar |
| category_hint | varchar nullable |
| default_module_order | json nullable |
| active | boolean |

权限：`nuxt-server` READ（filter: active=true）

### 2.3 `product_sections` + `product_section_items`（9A-2 新建）

`product_sections`：id、product_id、type（枚举见下）、title_en/es/pt、eyebrow_en/es/pt、**body_en/es/pt（rich text）**、**media_id（→ products_files，nullable）**、**external_url（varchar 2048，nullable）**、layout_variant、sort、enabled

section type 枚举：overview / image_text / benefits / quick_facts / applications / detection_targets / working_principle / configuration_options / line_integration / **video** / **case_studies** / **quotation_reminder**

- `video` 类型使用 `external_url`（YouTube/Vimeo https:// 链接）；为空时不渲染
- `case_studies`、`quotation_reminder`：结构预留，无内容时不渲染；不创建假内容
- `media_id` 只能指向同一产品的 `products_files` 记录，不能直接指向 `directus_files`

`product_section_items`：id、section_id、label_en/es/pt、value_en/es/pt、body_en/es/pt、icon、image_id（→ directus_files）、sort、enabled、source_status

### 2.4 `products_files`（9A-2 扩展，不建新 collection）

`file_role` 枚举（11 种）：hero / gallery / datasheet / manual / certificate / overview / application / detail / video_poster / brochure / drawing

新增字段：alt_text_en/es/pt、caption_en、enabled、language、version、published_date

### 2.5 `product_spec_groups` + `product_spec_items`（9A-2 新建）

`product_spec_groups`：id、product_id、title_en/es/pt、sort、enabled

`product_spec_items`：id、group_id、label_en/es/pt、value_en/es/pt、unit、note_en、sort、source_status

### 2.6 `product_faqs`（9A-2 新建）

id、product_id、question_en/es/pt、answer_en/es/pt、sort、enabled、source_status

### 2.7 `product_source_records`（9A-2 新建）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer PK | |
| product_id | integer → products | |
| source_file_id | uuid → directus_files | nullable，M2O |
| source_locator | varchar | 页码/表格位置/图片名 |
| raw_excerpt | text | 原文摘录 |
| fact_key | varchar | 如 spec_items.detection_width |
| status | varchar | confirmed / needs_review / missing / conflict |
| note | text | nullable |
| created_at | timestamp | |

**不含**：`source_file varchar`（已删除）、`import_job_id`（推迟到 9B）

权限：`nuxt-server` 无任何权限

---

## 三、LITUBO Admin 内部管理界面规范

### 3.1 导航结构

| 入口 | 9A-1 状态 | 9A-2 状态 |
|------|---------|---------|
| Product Center | ✅ 可用 | ✅ 可用（扩展 Sections/Specs/Media/FAQ/SEO 子页） |
| Content Center | 灰色不可点 | 灰色不可点 |
| Media Library | 灰色不可点 | 灰色不可点 |
| Settings | 灰色不可点 | 灰色不可点 |

**任何阶段均不出现 AI 相关按钮或入口，除非 9B 真实 AI 完成并经用户确认后。**

### 3.2 Admin 路由结构

```
/admin/login                      — 登录页（无 layout）
/admin/products                   — 产品列表
/admin/products/new               — 新建产品
/admin/products/[id]              — 基础信息编辑（9A-1）
/admin/products/[id]/content      — 内容模块（9A-2）
/admin/products/[id]/specs        — 参数组（9A-2）
/admin/products/[id]/media        — 媒体管理（9A-2）
/admin/products/[id]/faq          — FAQ（9A-2）
/admin/products/[id]/seo          — SEO（9A-2）
```

### 3.3 Admin 安全规则（9A-1 实施，永久有效）

- JWT 只存 httpOnly Cookie（`admin_at`、`admin_rt`）
- 生产环境：`Secure=true`、`SameSite=Strict`
- Token 绝不出现在响应 JSON 或 JavaScript 可访问的 cookie 中
- 所有 `/api/admin/*`（auth 路径除外）调用 Directus `/users/me` 验证，且 `role.name === 'Administrator'`
- 非 Administrator 角色返回 403
- 登录失败 5 次 → IP 锁定 15 分钟 → 429 + Retry-After
- POST/PATCH/DELETE 检查 `Origin === Host`
- 写操作通过管理员 JWT 调用 Directus，Directus 自动记录 `date_updated` 和 Activity Log
- 不手写 `directus_activity`，不新增重复的 `updated_by / updated_at` 字段

---

## 四、发布状态管控（不可违反）

| 里程碑 | 允许状态 | 禁止状态 |
|--------|---------|---------|
| 9A-1 | draft, review | published, archived |
| 9A-2 | draft, review, published（经用户确认后）| archived（另行授权） |
| 9B+ | 全部（含 AI 生成 Draft 后人工审核发布） | AI 自动发布 |

**永不自动发布。** AI 只能生成 Draft 并标记 `source_status=needs_review`，人工在 LITUBO Admin 确认后才能改为 Published。

---

## 五、无假产品原则（贯穿全期）

- 任何阶段禁止创建名称含"测试"、"test"、"demo"、"placeholder"、"假"的产品
- 唯一允许用于本地验收的真实产品：**LT-180C Series**（来源：`docs/product-cms/07-LT-180C-SAMPLE-INTAKE.md`）
- LT-180C 在 9A-1 阶段不录入（留给 9A-2）
- 验收期间临时 Published 状态，截图提交用户确认后才决定是否保持

---

## 六、AI 导入（Phase 9B 专属）

| 项目 | 规则 |
|------|------|
| 环境变量 | `OPENAI_API_KEY`、`DEEPSEEK_API_KEY`、`AI_DEFAULT_PROVIDER`、`AI_DEFAULT_MODEL`、`AI_MONTHLY_BUDGET_USD` |
| Key 存储 | 只存服务器 `.env`；不进 Git；不进 Directus DB；不传前端 |
| Settings 页面 | 只显示连接状态、模型、测试、预算、审计；**绝不显示完整密钥** |
| AI 输出 | 只生成结构化 Draft；标注来源；冲突标记 conflict；不确定标记 needs_review |
| 发布 | AI 不可触发发布；只有管理员在 LITUBO Admin 审核后才可发布 |
| 9A 阶段 | 不存在任何 AI 相关 UI；9B 完成后亮绿色入口才显示 |

---

*最后更新：2026-09-03，Phase 9A-1 施工开始时写入。*
