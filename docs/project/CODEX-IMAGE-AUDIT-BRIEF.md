# Codex 任务：应用页配图查重与补图

仓库：`git@github.com:coffeebearchen/litubo-website.git`
分支：`work/c-refined-v1`
基线 HEAD：`ab85450`

---

## 背景

LITUBO 外贸独立站（Nuxt 3 + Directus 12）。八个应用详情页已完成：

```
/applications/packaged-food
/applications/bottled-canned-products
/applications/meat-seafood
/applications/frozen-food
/applications/bakery-snacks
/applications/nuts-seeds-dried-food
/applications/powder-granules
/applications/pharmaceutical-daily-chemical
```

共用一个模板 `pages/applications/[slug].vue`，内容在 `content/industry-guides.ts`。

---

## 你看到的三组图片

### 1️⃣ 行业场景图（16 张，已交付，**已确认无重复**）

```
public/images/applications/{slug}-product.webp      1200×900
public/images/applications/{slug}-production.webp   1200×900
```

我用 SHA256 逐一比对过，**16 张全部唯一**，没有互相挪用。

### 2️⃣ 设备家族图（3 张，**在八页上完全重复**）

```
public/images/devices/xray-real.webp     真实 X 光机
public/images/devices/metal-real.webp    真实金检探头
public/images/devices/weigher-real.webp  真实称重机
```

**「Inspection approaches to discuss」这一区在八个行业页上长得一模一样。**

这是目前最明显的"重复感"来源。

### 3️⃣ 文章封面（6 张，用在 10 篇文章上）

```
xray-real / metal-real / weigher-real / packaging-line / powder-materials / loose-material
```

部分文章共用同一张。

---

## 你要做的

### A. 先核实现状（只读）

打开这八个页面，逐个确认：

1. 每页的两张场景图是否与该行业主题一致
2 有没有图片被用到不相关的行业上
3. 「设备家族」三张图在八页上重复，是否可接受

### B. 处理重复

**建议方向（你自己判断哪个更好，给出理由）：**

| 方案 | 做法 |
|---|---|
| **B1** | 保留三张设备图不换 —— 理由是它们确实是三个真实设备家族，重复是合理的；只需在文案上避免"这是为您行业准备的"暗示 |
| **B2** | 为每个行业生成一张"该行业 + 该设备"的合成图（8×3 = 24 张，成本高） |
| **B3** | 只替换最不协调的几处（例如肉类页配 X 光机图，改成肉类语境） |

**我倾向 B1 或 B3**——设备图重复本身不是问题，问题是有没有文案让人误以为是"本行业专用"。

### C. 需要补的图

如果发现有行业场景图不贴切，或某页缺图，按以下要求生成：

| 要求 | 值 |
|---|---|
| 尺寸 | 1200×900（4:3） |
| 格式 | WebP，80–150KB |
| 文件命名 | `{slug}-product.webp` / `{slug}-production.webp` |
| 存放 | `public/images/applications/` |
| 风格 | 写实商业摄影，冷中性光，不锈钢银灰，真实食品/包装颜色，少量灰绿环境 |
| 禁止 | 橙黄暖光滤镜、插画/3D/卡通、文字水印、认证标识、检测数值、仪表读数 |
| 禁止 | 把 AI 生成的机器当成真实产品；真实设备只能用既有产品照片 |

**不要**在图片里写"AI generated"字样，也不要加任何水印或文字。

---

## 输出

产出一份 CSV 或表格，告诉 DSH 怎么换：

| 页面 slug | 图片位置 | 现文件名 | 新文件名 | 更换原因 | 是否必须换 |
|---|---|---|---|---|---|

以及：

1. 你判断的重复问题结论（B1/B2/B3 哪个，为什么）
2. 生成了哪些新图、放在哪个路径
3. 哪些图**不建议**更换，为什么

---

## 边界

- **不要改前端代码**，只出图 + 清单
- **不要动 `content/industry-guides.ts`** 的文案
- 生成的图不能标为 LITUBO 工厂、客户现场或真实安装案例
- 真实设备照片只能用现有产品照，不能 AI 重画"看起来像"的机器
- 不确定的写"需业主确认"

---

## 给 DSH 的交付格式

完成后，把结果写成 `docs/project/codex-image-audit.md` 提交到同一分支，内容包括上面的表和结论。DSH 会按这张表替换文件。
