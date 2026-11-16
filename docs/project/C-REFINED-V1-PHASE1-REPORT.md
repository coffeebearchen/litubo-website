# 方案C深化V1 · 第一阶段实施报告

日期：2026-11-16
执行：DSH
分支：`work/c-refined-v1`（从 `work/litubo-dsh-local` @ `cbaab43` 起，隔离实施）
设计依据：`2026-11-16_方案C深化V1_第一阶段_DSH交接` 交付包（01–07 文档 + home.html / product.html）

状态标记：**IMPLEMENTED**（已实现） / **VERIFIED**（已实测） / **OPEN**（未完成或需决策）

---

## 1. 接续与范围

| 项 | 结果 |
|---|---|
| 起点检查 | `git status` 干净；HEAD `cbaab43`；与 origin 同步 |
| 隔离分支 | `work/c-refined-v1` |
| 顶部菜单 | **未改动**（SiteHeader / MegaMenu / MobileNav / CategoryStrip 原样） |
| 方案回退 | 未回退 A/B 或 ANYI |

---

## 2. 已完成清单

### 2.1 首页（`pages/index.vue`）

顺序：原菜单/分类条 → 暖色 Hero → 五类图文卡 → 产线横幅 → 八行业图标入口 → 三步沟通过程 → Blog & Insights → FAQ → 咨询表单 → 页脚

| 区块 | 状态 |
|---|---|
| Hero：暖色面 `#F4E5C8` + 左文右图（XR-200D 真实产品图，contain 不缩放） | IMPLEMENTED / VERIFIED |
| 五类图文卡：图片↔说明切换，标题与 Explore 始终可见 | IMPLEMENTED / VERIFIED |
| 产线横幅：深色图带 + 金黄 eyebrow | IMPLEMENTED / VERIFIED |
| 八行业：44px 浅暖圆底 + 30px 线性图标 | IMPLEMENTED / VERIFIED |
| 三步沟通过程 | IMPLEMENTED / VERIFIED |
| Blog & Insights：3 篇**真实已发布**文章 + 真实封面 | IMPLEMENTED / VERIFIED |
| FAQ teaser | 保留原逻辑 |
| 咨询表单 | 保留 `ExpertContactForm` |

### 2.2 新增组件

| 文件 | 作用 |
|---|---|
| `components/ui/FamilyRevealCard.vue` | 分类卡：hover 预览 → 移开恢复；点击/Enter/Space 固定；Escape 关闭；触屏仅需点按；无 scale / 无旋转 / 无 3D；`prefers-reduced-motion` 下无位移；无 JS 时标题+说明+链接仍可读 |
| `components/ui/ApplicationIcon.vue` | 八个 slug → 本地 SVG 白名单；不接受 CMS 任意 SVG；`aria-hidden`，名称照常显示 |

### 2.3 商品详情（`pages/products/[category]/[slug].vue`）

| 项 | 状态 |
|---|---|
| 已选 C 版布局 | 保留（未重做） |
| 主图 contain 不缩放、缩略图 130px | 保留 |
| **Related reading（新增）** | IMPLEMENTED / VERIFIED |
| FAQ / Documents / Related Products | 保留 |

Related reading 规则：
- **只**显示 `posts.related_product_slugs` 明确包含当前产品 slug 的文章
- 服务端过滤（`related_product_slug` 参数），不在客户端猜
- 无关联 → 整段不渲染，不用"最新文章"填充
- 路由按类型映射：insight → `/resources/insights/`，technical_guide → `/resources/technical-guides/`，case_study → `/resources/case-studies/`，news → `/resources/news/`

### 2.4 后台对应

| 项 | 状态 | 说明 |
|---|---|---|
| 首页固定块入 `site_content` | IMPLEMENTED / VERIFIED | 9 条记录（hero + 8 块），全部 `published` |
| `/api/cms/home` 返回 blocks | IMPLEMENTED / VERIFIED | hero + 8 blocks |
| 前台读取 + 回退 | IMPLEMENTED / VERIFIED | 后台空/草稿时回退到已批准文案，不空段 |
| 后台编辑 API | IMPLEMENTED | `GET/PATCH /api/admin/home-content` |
| 后台编辑入口 | IMPLEMENTED / **OPEN（未登录实测）** | `/admin/settings` 新增 "Home page content" 卡片 |
| 文章→产品关联 | IMPLEMENTED / VERIFIED | 5 篇文章建立诚实关联 |
| posts 服务端过滤 | IMPLEMENTED / VERIFIED | 新增 `related_product_slug` 参数 |

### 2.5 色彩统一（T5）

- `assets/css/tokens.css` 新增语义 token：`--color-surface-warm`、`--color-link-on-light`、`--reveal-duration`、`--reveal-easing`
- `assets/css/base.css` 的共享 `.page-hero` 由深绿大块改为**暖色渐变 + 深色文字**（19 个页面自动受益）
- **未**做全仓字符串替换；未改外部平台标识与状态色；未重建管理端

---

## 3. 证据

### 3.1 前台

| 截图 | 文件 |
|---|---|
| 首页 Hero + 五类卡 | `docs/project/screenshots/c1-home-hero-families.png` |
| 首页 应用 / 三步 / Blog | `docs/project/screenshots/c1-home-apps-steps-blog.png` |
| 详情页头部（标题/画廊/按钮） | `docs/project/screenshots/c1-product-detail-top.png` |
| 详情页 Related reading | `docs/project/screenshots/c1-product-related-reading.png` |
| 列表页暖色页头 | `docs/project/screenshots/c1-list-warm-hero.png` |

### 3.2 后台

`site_content`（全部 published）：

```
id=1  home.hero              Built for safer production.
id=2  home.families          Find your starting point.
id=3  home.production        Every inspection decision starts with the product and the pack.
id=4  home.applications      Your product. Your inspection questions.
id=5  home.process           Three steps to a useful answer.
id=6  home.process.step1     Describe the product and pack
id=7  home.process.step2     Review the inspection task
id=8  home.process.step3     Agree the configuration
id=9  home.blog              Practical ideas. A clearer conversation.
```

文章 → 产品关联（`related_product_slugs`）：

```
How X-ray inspection works in food production          -> xr-200d-compact-food-x-ray-inspection-system
How metal detection works and when to use it           -> lt-m-digital-all-metal-detector-series
X-ray or metal detection: which system fits your product? -> 上述两个
Checkweighing basics: keeping fill weights compliant   -> lt-150-compact-online-checkweigher
Combination inspection: three technologies on one line -> lt-js220-metal-detector-checkweigher-combo
```

公开 API 实测：

```
/api/cms/home            hero=Built for safer production.   blocks=8
related_product_slug=XR-200D   → 2 篇
related_product_slug=LT-M      → 2 篇
related_product_slug=LT-150    → 1 篇
related_product_slug=LT-JS220  → 1 篇
```

### 3.3 检查

- `npm run typecheck`：**我改动的文件 0 错误**
- 全仓剩余 3 个类型错误均为**既有**问题，未在我改动范围内：
  - `pages/support/faq.vue` ×2（`f` 隐式 any）
  - `server/api/cms/products/[category]/[slug].get.ts` ×1（`alt` 类型）

---

## 4. 未完成 / 需决策（OPEN）

| # | 项 | 原因 | 建议 |
|---|---|---|---|
| 1 | 输送/剔除类别没有代表图 | 该分类下**没有任何已发布产品** | 继续占位；业主提供实拍图后替换 |
| 2 | 后台首页编辑入口未做**登录实测** | 需要管理员会话；已实现 API + UI，未跑通一次"改→存→前台变" | 业主登录 `/admin/settings` 点一次 Save 即可确认 |
| 3 | 类别主图 `product_categories.hero_image` 为空 | 后台类别记录没有配图 | 已改用代表产品图，不依赖该字段；如要按类别配图可后补 |
| 4 | ES/PT 文案 | 本阶段只输出英文 | 后台编辑仅开放 EN；ES/PT 仍在 Directus 维护 |
| 5 | 三张分类卡的代表型号是固定映射 | 类别表没有"代表型号"字段 | 若业主想换代表型号，改 `FAMILY_SOURCE` 一处即可 |
| 6 | 第二阶段 AI | 按 06 文件排除 | 未启用、未产生费用 |

---

## 5. 集中需业主确认

1. **四张分类卡的代表图/型号**是否认可：XR-200D / LT-M Series / LT-150 / LT-JS220
2. **输送与剔除**是否继续品牌占位（当前无产品、无图）
3. **Blog 五篇关联**是否认可这种"按主题关联"的方式
4. **后台首页编辑**：请登录 `/admin/settings` → "Home page content" → 改一句 → Save → 看前台是否变化
5. 其余前台页的暖色页头是否接受（本次统一了 19 个页面的页头底色）

---

## 6. 边界声明

- 未部署、未切域名、未修改线上 Wix、未向真实客户外发
- 未启用 AI、未产生新付费服务
- 未编造任何产品事实；缺素材处保持占位并记录
- `READY_FOR_REVIEW` ≠ `READY_FOR_LAUNCH`
