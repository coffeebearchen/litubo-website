# 方案C深化V1 · T1 字段核对表与缺料清单

日期：2026-11-16
环境：本地 Directus 12.3.1（`127.0.0.1:8055`）+ PostgreSQL 16
分支：`work/c-refined-v1`
方法：读取运行中数据库的真实 `fields` 定义与记录数，**不**以仓库 schema 快照为准。

---

## 1. 结论摘要

| 项 | 结果 |
|---|---|
| 新增数据表 | **0** |
| 新增字段 | **0** |
| 新增记录 | **9 条** `site_content`（首页固定块） |
| 修改记录 | 5 篇 `posts.related_product_slugs` |
| 删除记录 | 0 |
| 不可逆操作 | 无 |

本次**没有任何 schema 变更**，只写入内容记录，可逐条回退。

---

## 2. 前台需求 → 后台字段核对

### 2.1 首页

| 前台功能 | 实际使用的表/字段 | 状态 |
|---|---|---|
| Hero 标题/副标题/按钮 | `site_content`（`content_key='home.hero'`）的 `eyebrow_*`、`title_*`、`body_*`、`cta_primary_label_*`、`cta_primary_path`、`cta_secondary_*` | ✅ 已有，直接复用 |
| Hero 展示图（XR-200D） | `products.hero_image`（按 `slug LIKE 'xr-200d%'` 取） | ✅ 已有 |
| 五类卡标题/顺序/说明 | `product_categories.name_*`、`intro_*`、`sort`、`status` | ✅ 已有 |
| 五类卡图片 | **`product_categories.hero_image` 全为空** → 改用代表产品 `products.hero_image` | ⚠️ 见 §4.1 |
| 五类卡"代表型号" | 无对应字段 → 代码内 `FAMILY_SOURCE` 固定映射 | ⚠️ 见 §3.2 |
| 产线横幅 | 新增 `site_content` 记录 `home.production` | ✅ 本次新增 |
| 八行业图标 | 本地 SVG 白名单（`components/ui/ApplicationIcon.vue`） | ✅ 代码内，无表 |
| 三步沟通过程 | `site_content` `home.process` + `home.process.step1/2/3` | ✅ 本次新增 |
| Blog & Insights | `posts`（`status=published`，排除 `faq`） | ✅ 已有 |
| FAQ 摘要 | `posts`（`content_type='faq'`） | ✅ 已有 |
| 咨询表单 | `POST /api/inquiries` | ✅ 已有 |

### 2.2 商品详情

| 前台功能 | 实际使用的表/字段 | 状态 |
|---|---|---|
| 标题/型号 | `products.name_*`、`products.model_or_series` | ✅ 已有 |
| 简介 | `products.summary_*` | ✅ 已有 |
| 图库 | `products_files`（`file_role`、`sort`、`enabled`、`alt_*`） | ✅ 已有 |
| 内容段落 | `product_sections`（`type`、`title_*`、`body_*`、`layout_variant`、`sort`、`enabled`） | ✅ 已有 |
| 技术规格 | `product_spec_groups` + 规格项 | ✅ 已有 |
| Configurator | 现有询盘流程，无独立表 | ✅ 无新增 |
| 公司目录 | 无已批准文件 → 诚实空态 | ✅ 无新增 |
| **Related reading** | `posts.related_product_slugs`（JSON 数组） | ✅ 字段已有，**本次补数据** |
| FAQ | `posts`（`content_type='faq'`） | ✅ 已有 |
| 文档下载 | `products_files` | ✅ 已有 |
| 相关产品 | `products.related_product_slugs` | ✅ 已有 |

### 2.3 询盘字段（对应 03 文件）

| 原型/前端含义 | 实际接受字段 | 状态 |
|---|---|---|
| 产品兴趣 | `tm_product_interest` | ✅ 已有 |
| 具体产品 | `related_product_slug` | ✅ 已有 |
| 行业 | `related_application_slug` | ✅ 已有 |
| 型号 | `model_number` | ✅ 已有 |
| 客户问题 | `message` | ✅ 已有 |
| 产品形态 | `tm_product_format` | ✅ 已有 |
| 线速 | `tm_line_speed` | ✅ 已有 |
| 尺寸 | `tm_package_dimensions` | ✅ 已有 |
| 检测目标 | `tm_contaminant_concern` | ✅ 已有 |
| 来源 | `source_url`（服务端派生）、`utm_*` | ✅ 已有 |

**结论：询盘侧零变更。**

---

## 3. 最小 schema 增量

### 3.1 数据增量（无 schema 变更）

新增 `site_content` 记录 9 条：

| id | content_key | 用途 |
|---|---|---|
| 1 | `home.hero` | （原有，未改） |
| 2 | `home.families` | 五类卡区块标题 |
| 3 | `home.production` | 产线横幅 |
| 4 | `home.applications` | 八行业区块标题 |
| 5 | `home.process` | 三步区块标题 |
| 6 | `home.process.step1` | 步骤 1 |
| 7 | `home.process.step2` | 步骤 2 |
| 8 | `home.process.step3` | 步骤 3 |
| 9 | `home.blog` | Blog 区块标题 |

修改 `posts.related_product_slugs` 5 篇（见 §4.3）。

### 3.2 已知的设计缺口（未加字段，改用代码常量）

`product_categories` 没有"代表型号"字段。当前在 `pages/index.vue` 的 `FAMILY_SOURCE` 常量里固定映射：

```
x-ray-inspection         → xr-200d-compact-food-x-ray-inspection-system  (XR-200D)
metal-detection          → lt-m-digital-all-metal-detector-series        (LT-M Series)
checkweighers            → lt-150-compact-online-checkweigher            (LT-150)
combination-inspection   → lt-js220-metal-detector-checkweigher-combo    (LT-JS220)
conveyors-reject-systems → 无（该分类 0 个已发布产品）
```

**为什么不加字段**：加一列 `representative_product` 只为 5 条记录服务，收益低于维护成本。若业主将来要求后台可改代表型号，再加可空 FK 即可（一步迁移、旧数据默认兼容）。

---

## 4. 缺料标记

### 4.1 类别主图（5/5 缺失）

| slug | `hero_image` |
|---|---|
| x-ray-inspection | ❌ 空 |
| metal-detection | ❌ 空 |
| checkweighers | ❌ 空 |
| combination-inspection | ❌ 空 |
| conveyors-reject-systems | ❌ 空 |

**当前处理**：卡片改用代表产品的 `products.hero_image`（4 类有图），输送/剔除用品牌占位。
**若要按类别配图**：在后台为这 5 条记录选图即可，前台已优先读产品图，需要切换逻辑另议。

### 4.2 产品主图（29/37 有图，8 缺）

缺图的 8 个（均为工业/便携 X 光）：

1. Industrial X-Ray Inspection System for Shoes, Bags, Toys and Components
2. Industrial X-Ray Screening System for Quality and Safety Inspection
3. Large Industrial X-Ray Inspection System for Foreign Object Screening
4. Compact Portable X-Ray Fluoroscopy Instrument
5. Portable X-Ray Fluoroscopy Instrument
6. Rechargeable Portable X-Ray Fluoroscopy Instrument
7. Portable X-Ray Fluoroscopy System for Special Imaging Applications
8. Handheld Backscatter X-Ray Inspection System

**已核实**：这 8 个在 Wix 源头即无产品图，**不得用无关图顶替**，保持品牌占位。

### 4.3 文章数据（25 篇已发布）

| 项 | 数量 |
|---|---|
| insight | 10 |
| faq | 15 |
| 有封面图 | 10 |
| 缺封面图 | 15（前端用品牌化排版封面） |
| 有产品关联 | **5**（本次设定） |

本次建立关联的 5 篇：

| 文章 | 关联产品 slug |
|---|---|
| How X-ray inspection works in food production | `xr-200d-compact-food-x-ray-inspection-system` |
| X-ray or metal detection: which system fits your product? | 上述 + `lt-m-digital-all-metal-detector-series` |
| How metal detection works and when to use it | `lt-m-digital-all-metal-detector-series` |
| Checkweighing basics: keeping fill weights compliant | `lt-150-compact-online-checkweigher` |
| Combination inspection: three technologies on one line | `lt-js220-metal-detector-checkweigher-combo` |

其余 5 篇 insight 为通用主题（选型沟通、样品送检、灵敏度理解等），**不强行关联具体型号**。

### 4.4 输送/剔除分类

`conveyors-reject-systems`：**0 个已发布产品**。因此：
- 五类卡：无代表图、无代表型号 → 品牌占位
- 产品分类页：会显示空列表

**需业主决策**：是否补一个输送/剔除产品（哪怕是系列页），或该分类暂不对外。

---

## 5. 备份与回退

### 5.1 备份

本次所有变更均可用 SQL 还原。关键记录：

```sql
-- 回退首页固定块（删除本次新增的 8 条，hero 保留）
DELETE FROM site_content WHERE content_key IN (
  'home.families','home.production','home.applications','home.process',
  'home.process.step1','home.process.step2','home.process.step3','home.blog'
);

-- 回退文章关联
UPDATE posts SET related_product_slugs = NULL
WHERE slug IN (
  'how-x-ray-inspection-works','how-metal-detection-works',
  'x-ray-or-metal-detection-which-system-fits-your-product',
  'checkweighing-basics-keeping-fill-weights-compliant',
  'combination-inspection-three-technologies-on-one-line'
);
```

### 5.2 代码回退

```bash
git checkout work/litubo-dsh-local      # 回到起点 cbaab43
# 或
git revert a4cf306 49808b8 883eeb5
```

### 5.3 影响面

- 删掉 `site_content` 的 8 条记录后，前台自动回退到代码内已批准文案（不空段）
- 清空 `related_product_slugs` 后，Related reading 整段不渲染（不报错）
- 代码回退不影响数据库里的产品/文章/询盘

---

## 6. 未做（明确记录）

| 项 | 原因 |
|---|---|
| 登录实测后台编辑 | 需要管理员会话，本轮只验证到 API 层 |
| ES/PT 文案 | 本阶段只输出英文 |
| 类别主图字段填充 | 等业主选图 |
| 输送分类产品 | 源头无数据 |
| 第二阶段 AI | 按 06 文件排除 |
