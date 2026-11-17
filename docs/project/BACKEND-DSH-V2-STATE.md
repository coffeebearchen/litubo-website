# BACKEND-DSH-V2-STATE —— 施工账本

Plan ID：`BACKEND-DSH-V2-0e6e98d`
基线：`0e6e98dc3c0676137e6b8531aca524aa5d962b9b`
建立：2026-11-17（DSH）
本文件随施工更新。状态列含义见文末。

---

## 0. 基线核对

| 项 | 值 |
|---|---|
| 设计基线 | `0e6e98d` |
| 施工时 HEAD | 见 `git log -1` |
| 分支 | `work/c-refined-v1` |
| 旧方案 | **不采用**（`c963115` 版），本账本不含其 UI/API 建议 |

### 状态定义

| 标记 | 含义 |
|---|---|
| **源码有** | 代码里存在，未经运行验证 |
| **本地已测** | 在本机 dev + 真实 Directus 上跑通并看过结果 |
| **真实联调** | 与真实外部服务（邮件、AI provider、通知）确认连通 |
| **待确认** | 缺资料或依赖真实业务决定 |

---

## V2-00 能力清单

### 1. 后台规模（源码有）

| 项 | 数量 |
|---|---|
| `pages/admin/**` | 36 个页面 |
| `server/api/admin/**` | 100 个接口文件 |
| 区块 | ai / asset / auth / content-center / files / inquiries / media / products / settings |

### 2. 产品编辑：7 个日常页（源码有）

`pages/admin/products/[id]/` —— 与 V2 规格逐一对应：

```
index.vue      ← Basics
content.vue    ← Content
specs.vue      ← Specifications
media.vue      ← Media
faq.vue        ← FAQ
seo.vue        ← SEO
preview.vue    ← Preview
```

### 3. Workspace：7 个工具页（源码有）

`pages/admin/product-workspace/[id]/`

| 页面 | V2 处理 |
|---|---|
| `overview.vue` | **改为跳转** → `products/[id]` (Basics) |
| `page-content.vue` | **改为跳转** → `content` |
| `specifications.vue` | **改为跳转** → `specs` |
| `media-resources.vue` | **改为跳转** → `media` |
| `sources-evidence.vue` | **保留**（原 URL） |
| `ai-source-intake.vue` | **保留**（原 URL） |
| `ai-proposal-review.vue` | **保留**（原 URL） |

### 4. Blog 数据源（本地已测）

| 项 | 事实 |
|---|---|
| 前台博客 | `server/api/cms/posts/[slug].get.ts` 读 **`items/posts`** ✅ |
| 文章条数 | 33 条，25 已发布 |
| 高级内容 | `content_items` 在 12 个后端文件中被引用（`aiContentApply` / `aiContentIntake` / `aiProposalEngine` / `aiSourceRef` / `contentDraft` 等） |

**结论：Blog 与 Content Center 是两个独立数据源。本轮不为它们做双源兼容读取。**

### 5. Hero 所需列：已全部存在（本地已测）

`site_content` 实际 24 列，**V2 需要的都在，不需要新增列**：

```
id  content_key  page_key  section_key  status  hero_image
eyebrow_en/es/pt   title_en/es/pt   body_en/es/pt
cta_primary_label_en/es/pt   cta_primary_path
cta_secondary_label_en/es/pt cta_secondary_path
updated_at
```

**因此 V2-04 不新建任何 Hero 列。**

### 6. 称重三字段（本地已测，已完成）

| 项 | 状态 |
|---|---|
| `checkweigher_series` / `_configuration` / `_l_series` 数据库列 | ✅ 已建，nullable |
| 12 个已发布型号归类 | ✅ 12/12（业主确认 LT-300L→medium-range，LT-400→extra-large） |
| 后台 GET 返回 | ✅ |
| 后台 PATCH 白名单 | ✅ |
| 公开只读白名单 | ✅ |
| 后台编辑界面 | ✅ 仅称重分类显示 |

**V2-01 中「修 payload 漏发」这一项：源码层面已完成，需实测验证。**

### 7. 询盘 7 个 AI 列（源码有）

```
ai_summary  ai_intent  ai_recommended_products  ai_draft_reply
ai_confidence  ai_processed_at  ai_reviewed
```

全部 nullable（`ai_reviewed` non-null boolean）。
**需核实：`server/api/admin/ai/*` 是否已有读写这些列的代码。**

### 8. 消息通知（待确认 —— 有真实故障）

dev 日志实测出现两次：

```
ERROR [inquiry] email notification failed { id: 34 }
ERROR [inquiry] email notification failed { id: 35 }
```

**询盘能写库，但邮件通知失败。** 不在 V2 包内，但属真实业务缺陷，单独记录。

---

## 任务账本

| 任务 | 状态 | 提交 | 实际改动 | 验证 | 回退 | 需业主确认 |
|---|---|---|---|---|---|---|
| **V2-00** 基线清单 | ✅ 完成 | 见提交 | 本文件 | 核对 7 日常页 / 7 工具页 / posts 源 / site_content 24 列 / 称重 3 列 | 无写入 | — |
| V2-01 字段闭环 | 待做 | — | — | — | — | — |
| V2-02 导航 + 统一产品编辑器 | 待做 | — | — | — | — | — |
| V2-03 posts 管理 | 待做 | — | — | — | — | — |
| V2-04 Hero（2 页 → 13 页） | 待做 | — | — | — | — | — |
| V2-05 cover_fit + 分类小 tab | 待做 | — | — | — | — | — |
| V2-06 内部询盘 AI | 待做 | — | — | — | — | — |
| V2-07 视觉与合同验收 | 待做 | — | — | — | — | — |

---

## Schema 差异（V2 只允许新增一列）

| 表 | 现状 | V2 要求 | 差异 |
|---|---|---|---|
| `site_content` | 24 列，Hero 所需全有 | 复用现有 | **无差异** |
| `products` | 含称重 3 列 | 复用现有 | **无差异** |
| `inquiries` | 含 7 个 AI 列 | 复用现有 | **无差异** |
| `product_categories` | 名称/简介/图片 | 复用现有 | **无差异** |
| `posts` | 无 `cover_fit` | **新增 nullable string** | **待建** |
| `site_settings` | 联系方式 | 复用现有 | **无差异** |

### `posts.cover_fit` 迁移计划（V2-05）

1. 先导出受影响记录旧值与 schema
2. Directus 建列：nullable string，允许 `null` / `contain` / `cover`
3. 只按**已核实清单**迁移（当前 10 篇 Insights 的 contain/cover 归属已在 `pages/resources/insights/[slug].vue` 的 `CONTAIN_SLUGS` 中）
4. 前端保留 `CONTAIN_SLUGS` 作为 null 兼容
5. 回退：关闭新读写，**保留列不 DROP**

---

## 待业主确认 / 待资料

| # | 项 | 说明 |
|---|---|---|
| 1 | 邮件通知失败 | 需确认 SMTP / 通知渠道配置 |
| 2 | AI provider | 需确认 DeepSeek 预算与是否允许处理真实客户数据 |
| 3 | Hero 13 页的 page_key | 除 `home` 外均为建议命名，需确认是否与既有行冲突 |

---

## 未做（本轮不授权）

```
不发布、不合并到生产
不改 DNS / 不碰 Wix
不对客户外发
不自动启用生产 AI
```
