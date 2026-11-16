# 审查修复证据 —— b169d97 报告

证据日期：2026-11-17
基线：work/c-refined-v1 @ b169d97（实际施工时 HEAD 已推进到 e33dea9）

## A01 —— Insights 详情：503 不再被改成 404

**修法**：改用既有 `publicPageStatus(error, hasData)`。

**故障注入验证**（停掉 Directus 容器制造上游故障）：

| 场景 | 修复前 | 修复后 | 期望 |
|---|---|---|---|
| Directus 停止 | 404 | **503** | 503 ✅ |
| 不存在的 slug | 404 | 404 | 404 ✅ |
| 正常 | 200 | 200 | 200 ✅ |

## A02 —— 称重分类：API 故障不再返回 200 + 0 型号

**修法**：取出 `error`，SSR 用 `publicPageStatus` 抛 503；客户端显示故障卡 + Try again，保留筛选条件。

| 场景 | 修复前 | 修复后 | 期望 |
|---|---|---|---|
| Directus 停止 | 200「All series 0 models」 | **503** | 503 ✅ |
| Directus 停止 + series 参数 | 200 + 0 型号 | **503** | 503 ✅ |
| 不存在的产品 slug | 404 | 404 | 404 ✅ |
| 正常 | 200 | 200 | 200 ✅ |

**复现命令**

```powershell
docker stop litubo-cms-directus-1
Invoke-WebRequest 'http://localhost:3000/products/checkweighers'   # → 503
Invoke-WebRequest 'http://localhost:3000/resources/insights/how-x-ray-inspection-works'  # → 503
docker start litubo-cms-directus-1
```

## 待办

其余问题（A03–A15、Blog 封面映射）见 `01-report/01-ISSUES.csv`。

## A03 —— 邮箱在清洗后校验

**修法**：先 sanitize 全部字段，再校验**将被入库的那个值**。

| 输入 | 修复前 | 修复后 |
|---|---|---|
| `<b></b>@example.invalid` | 200，入库 `@example.invalid` | **400 Invalid email format.** ✅ |
| `not-an-email` | 400 | 400 ✅ |
| 正常邮箱 | 200 | 200 ✅ |

## A04 —— 按业务类型校验必填

**修法**：`REQUIRED_BY_TYPE` 最小必填表，与现有各表单对齐；**`spare_parts` 不要求姓名**。

| 场景 | 结果 |
|---|---|
| `send_product_test` 缺姓名/产品 | ✅ 400 |
| `spare_parts` 缺 model_number/message | ✅ 400 `model_number is required for this request type.` |
| `spare_parts` 合法（**无姓名**） | ✅ 写入成功 |

**缺字段零写入**（400 在写入前抛出）。合法表单仍写入一次。

**测试数据已全部清理**，询盘回到 22 条。

## Blog 封面映射（03-BLOG-COVER-MAP.csv）

**保留**（未改动）：12 / 14 / 15 / 17 / 19
**替换**：13 / 16 / 18 / 20 / 21

### 复用现有真实照片（先核实 UUID 存在且 is_public）

| 文章 | 旧 | 新（复用） | 核实 |
|---|---|---|---|
| 13 `x-ray-or-metal-detection` | `d3eb45ab` | `8667aa78-3555-475f-9ace-bfcae53e37bf` | ✅ 存在，`is_public=true`，真实 X-ray 照片 |
| 16 `combination-inspection` | `a7702883` | `77add968-6cc5-4982-a37c-2cad080b1757` | ✅ 存在，`is_public=true`，金属检测+称重组合 |

### 上传 3 张新图（1600×900 WebP，`is_public=true`）

| 文章 | 新文件 ID |
|---|---|
| 18 `preparing-a-product-sample` | `2757dcfa-49fe-44da-a94d-95e05870ff34` |
| 20 `fitting-inspection-into-a-line` | `ee164aee-527c-4663-8bf4-6a07de851f96` |
| 21 `what-to-prepare-for-a-quotation` | `48abc396-4545-436f-9e43-93cc7a212b99` |

三张图的 description 均标注 **"AI editorial illustration ... Not an installation or test result."**

### 结果

**10 篇封面全部唯一，重复归零。**

```
48abc396 ×1 ✅   ee164aee ×1 ✅   dfc39fd9 ×1 ✅   2757dcfa ×1 ✅   a7702883 ×1 ✅
77add968 ×1 ✅   a6d701d1 ×1 ✅   f4899fc4 ×1 ✅   8667aa78 ×1 ✅   d3eb45ab ×1 ✅
```

**未关闭任何现有共享文件的公开资格**（按要求）。

### 接口验证

10 篇 `GET /api/cms/posts/<slug>` 的**顶层 `coverImageUrl`** 全部非空且指向新文件；列表页 200 且渲染 10 张图。

---

## A08 —— 封面 contain/cover 与 alt

**修法**：`CONTAIN_SLUGS` 受控清单（仅这 10 篇）；设备图 `contain`，场景图 `cover`；`alt` 取文章真实标题（原先 `alt=""`）。

| 验证 | 结果 |
|---|---|
| 设备图文章（13） | ✅ 带 `post-cover__img--contain` |
| 场景图文章（21） | ✅ 不带该 class（cover） |
| 封面 alt | ✅ `X-ray or metal detection...` |

---

## A11 —— 绝对说法改为条件表述

| 项 | 修复前 | 修复后 |
|---|---|---|
| post16 标题 | Combination inspection: **three technologies** on one line | **Combining inspection technologies on your line** |
| post16 正文 | A single reject station **removes any pack that fails any check** | ...removes a pack that fails a check, **depending on the configuration** |
| post13 正文 | it **can also find** stone, glass, bone and some plastics | it **may also find** ...; **what is detectable depends on the product and the test** |

`slug` 未改。

---

## A12 —— 金色 CTA 对比度

| 组合 | 对比度 |
|---|---|
| `#FFFFFF` on `#D99200`（修复前） | **2.60:1** ❌ 低于大字 3:1 |
| `#18332B` on `#D99200`（修复后） | **5.21:1** ✅ |

**品牌金黄未改**，只改前景色。
