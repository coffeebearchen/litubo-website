# 内容与结构备份 / Content and schema backup

日期：2026-11-16（**修订 3** —— 封面替换、文章措辞修正之后）
仓库是**公开**的，所以这里只放**不含个人信息和凭据**的内容与结构。

> 修订 1：加称重字段之前
> 修订 2：加称重字段之后
> 修订 3（本版）：Blog 封面替换 + post16/post13 措辞修正之后 —— **与当前数据库一致**

---

## 备份内容

### 内容数据

| 文件 | 条数 | 说明 |
|---|---|---|
| `products.json` | 41 | 产品，含 `checkweigher_series` / `checkweigher_configuration` / `checkweigher_l_series` |
| `product_categories.json` | 5 | 分类 |
| `product_sections.json` | 373 | 产品详情分段 |
| `product_spec_groups.json` | 52 | 规格组 |
| `products_files.json` | 67 | 产品-媒体关联（仅 ID） |
| `posts.json` | 33 | 文章（**已含新封面 ID 与新标题**） |
| `site_content.json` | 9 | 首页固定块 |
| `site_settings.json` | 8 | 站点设置 |
| `site_social_links.json` | 2 | 社交链接 |

### 表结构（供后端审查）

```
_schema-products.json           34 字段
_schema-inquiries.json          46 字段  ← 含 7 个 AI 字段
_schema-posts.json              29 字段
_schema-product_categories.json 21 字段
_schema-site_content.json       24 字段
_schema-site_settings.json       8 字段
```

**这些文件只含字段名/类型/是否可空/界面类型，不含任何真实数据。** 已核查：`@` 符号 0 处，无默认值泄漏。

---

## 当前数据库状态（本版对应）

| 项 | 值 |
|---|---|
| 称重系列字段 | ✅ 3 个 |
| 已归类称重型号 | ✅ 12 / 12 |
| 10 篇 Insights 封面 | ✅ 10 张，**零重复** |
| post16 标题 | `Combining inspection technologies on your line` |

### 10 篇文章的封面归属

| slug | 封面文件 ID |
|---|---|
| how-x-ray-inspection-works | `d3eb45ab…` |
| x-ray-or-metal-detection | `8667aa78…` （复用真实 X-ray 照片） |
| how-metal-detection-works | `f4899fc4…` |
| checkweighing-basics | `a6d701d1…` |
| combination-inspection | `77add968…` （复用真实组合照片） |
| conveyors-and-reject-systems | `a7702883…` |
| preparing-a-product-sample | `2757dcfa…` （新图，AI editorial） |
| inspection-sensitivity-and-product-effect | `dfc39fd9…` |
| fitting-inspection-into-a-line | `ee164aee…` （新图，AI editorial） |
| what-to-prepare-for-a-quotation | `48abc396…` （新图，AI editorial） |

---

## 这里**故意没有**什么

| 排除项 | 原因 |
|---|---|
| `inquiries.json`（22 条） | **真实客户姓名、邮箱、电话、留言** |
| `visitor_events.json` | 访客追踪，含 IP 派生信息 |
| `litubo_cms.sql` | 含 `directus_users` 密码哈希、sessions |
| `uploads/`（276 个文件） | 媒体可重新上传；体积过大 |
| `directus_users` / `roles` / `policies` | 身份与权限结构 |

**需要这些时用本机 `D:\LITUBO-backup-20261116r2.zip`，不要入库。**

---

## 恢复

```bash
curl -X POST http://127.0.0.1:8055/items/posts \\
  -H "Authorization: Bearer <ADMIN_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d @posts.json
```

**注意**：恢复内容后媒体文件需单独上传，否则 `cover_image` 引用会断。
```
