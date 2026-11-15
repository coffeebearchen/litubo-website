# 移交报告：LITUBO 独立站 — DSH 阶段成果与后续设计诉求

> 给：Codex
> 来自：DSH
> 日期：2026-11-15
> 仓库：`git@github.com:coffeebearchen/litubo-website.git`，分支 `work/litubo-dsh-local`（**已推送，2026-11-15，241 个提交**）
> 本地路径：`D:\LITUBO-website`

---

## 0. 一句话结论

**网站已从"占位骨架"推进到"结构完整、内容真实、可给客户看"的状态**，但视觉质感仍偏"工程化"，缺少你要的那种"人性化 / 生动 / 有温度"的感受。**这次移交的核心诉求，就是请你在设计层面给方向和整改建议。**

---

## 1. 方向决策（与最初计划有出入，请先看这段）

决策者是业主。以下方向是**业主明确拍板**的，不是 DSH 自作主张。请以这些为前提给建议，不要回到最初 Codex 计划里的旧假设。

| 决策 | 内容 | 影响 |
|---|---|---|
| **D1. 设计方向** | **起步参照 `anyivalves.com`；现以决策者方向为准**——更智能、更有生机、有结构感与设计感、更容易获客 | 详情页早期按 ANYI 改为"白底 + 标题居中 + 图左文右 + 画廊 + 规格斑马纹 + Configurator + Catalogue + Related"；后续深化不再受 ANYI 约束 |
| **D2. 品牌色** | 以 `litubo.com` 现行 Wix 站为准：**金黄 `#D99200` + 叶绿 `#2F6B3A / #1B4224`**（不是原先的蓝绿 + 红橙） | 全站色彩 token 已替换；48 个文件内的硬编码旧色已清理 |
| **D3. 图片策略** | "要换图，不要跟着原来的资料走"；**不得用无关产品图顶替**；缺图用**品牌化占位** | 11 个产品无实拍图 → 使用品牌渐变占位；8 个工业/便携 X 光产品经核实 **Wix 源头即无图** |
| **D4. 字体** | 全站字号 **原始 +38%**（业主先提 +50%，后修正为 +38%） | `tokens.css` 全部 `--text-*` 已改 |
| **D5. 列表简介** | 不超过 5 行；**后端同步简化** | 17 个产品 `summary_en` 压到 ≤150 字符；卡片 `-webkit-line-clamp: 5` |
| **D6. 详情图** | 主图不缩放；**下方缩略图放大 80%**（72px → 130px） | `ProductGallery` 已实现 |
| **D7. 列表图** | 曾经要求放大 40% → 导致紧凑产品照被裁 → **改为"不缩放 + 加宽卡片"**（3 列） | `MediaCard` 移除 `scale()`，网格 `minmax(320px)` |
| **D8. 颜色配比** | 绿色偏多、暖橙偏少 → 增加暖色 | 新增暖橙占位变体；博客封面重做为暖橙 |
| **D9. 后台** | 必须同步，不能只做前台 | 见"后端"章节 |
| **D10. 上线** | **未授权**。Wix 保持在线；未 push、未部署、未切换域名 | 本报告不涉及上线动作 |

**与最初 Codex 计划的主要偏差：**
- 原计划"产品数仍是 0" → 实际 **37 条已发布**
- 原计划允许"用图库第一张当主图" → 业主改为**不允许**，缺图用占位
- 原计划未涉及"访客追踪" → 业主新增需求，已自建
- 原计划未涉及"企业微信通知" → 业主指定用群机器人（免费方案），**替代 WhatsApp（成本高）**

---

## 2. 已完成（按主题）

### 2.1 数据入库（Directus）

| 项 | 数量 |
|---|---|
| 产品（published / archived） | **37 / 4** |
| 有主图 / 无主图 | **30 / 11** |
| 产品分类 | 5 |
| 产品内容段落 | 373 |
| 规格项 | 672（52 个规格组） |
| 产品级 FAQ | 9 |
| 文章 posts | **33**（insight 12 / faq 18 / case_study 1 / news 1 / technical_guide 1） |
| 媒体文件 | 109（公开 50 / 图片 53） |
| 询盘 | 22 |

### 2.2 前台页面

- 首页：图标分类条 → Hero（真实车间照 + 渐变）→ About → 产品分类网格 → **应用行业网格（8）** → Latest（带 All/Insights/Guides/Case Studies 标签）→ FAQ teaser → CTA 带 → **Connect with an Expert 表单**
- 产品：总览 / 5 个分类页 / 详情页
- 详情页结构：面包屑 + 居中标题 + 图左（画廊：主图 + 缩略图 130px + 点击放大）+ 文右（简介 + 2 按钮 + **Print/Save PDF**）+ 规格表（斑马纹 + **技术线图占位**）+ **Product Configurator** + **Company catalogue** + FAQ + 文档 + Related Products
- 应用：列表 + **8 个行业详情页**（含 5 个设备推荐）
- 资源：6 个入口 + Latest 列表 + 文章详情页
- FAQ：**搜索框 + 左侧分类栏** + 分组折叠（已修复折叠不严的 bug）
- 公司：About / Quality / Global Service / Become a Partner
- 支持：Support / FAQ / Spare Parts / Product Test
- 表单：Contact / Expert / Technical Matching / Distributor

### 2.3 导航与页脚

- 顶部：Logo + 主导航 + **5 类图标分类条**（全站）
- 大菜单（Mega Menu）：**修复了两个真实 bug**
  - 面板背景透明（淡入过渡未完成）→ 改为**瞬时、纯白**
  - 鼠标移入面板即关闭 → 加 **220ms hover-intent 宽限**
- 页脚重设计：
  - 品牌区独立成行（左品牌 + 右联系方式）
  - 链接区 **5 栏，APPLICATIONS 拆双栏**（解决 9 项把页脚拉到 1108px 的失衡）
  - 移除与 CTA 带重复的 "Contact" 按钮，改为 **Follow LITUBO 社交图标行**
- 应用菜单/页脚：**修正 7 个指向列表页的错链**，并补上漏掉的第 8 个行业（Pharma）

### 2.4 SEO / 重定向

- 37 条 **Wix 旧产品 URL → 新 URL 的 301** 已启用（`scripts/build-redirects.mjs` 生成 + `server/middleware/legacy-redirects.ts` 生效，支持 `%C2%B7` 等编码路径）
- sitemap / canonical / robots 已存在
- ES/PT 通过中间件返回 404（不索引）

### 2.5 后端功能

- 表单 → Directus `inquiries`（已通）
- **企业微信询盘通知**（代码就绪，等 `WECOM_WEBHOOK_URL`）
- **访客追踪**（自建，见 §2.6）
- AI 助手：代码存在，`VISITOR_AI_ENABLED` 未开启
- HubSpot：代码存在，无 token

### 2.6 访客追踪（新增，业主指定）

- 表：`visitor_events`（path / referrer / source / country / duration_ms / session_id / created_at）
- 无 IP、无 cookie、不采集身份；`/admin` 不记录
- 看板 `/admin/visitors`：在线人数、24h 浏览量、Top 页面、国家、来源、明细
- 推送：每次浏览推一条企业微信（可配置）
- 文档：`docs/project/VISITOR-TRACKING.md`（含 Directus policy 配置，避免上线漏配）

---

## 3. 未完成 / 待决策

| # | 项 | 状态 | 需要谁 |
|---|---|---|---|
| 1 | 8 个产品缺主图 | 已接受占位，等实拍 | 业主 |
| 2 | 25 条迁移复核项 | **已全部关闭为"接受现状"**（均为"刻意不编造"的记录，无需改数据） | — |
| 3 | 旧产品 37 条是否导入 | **建议不导**（会带来 9 组重复冲突，且客户看不到增量价值） | 业主 |
| 4 | 企业微信 Webhook | 等网址 | 业主 |
| 5 | SMTP 邮件通知 | 等授权码 | 业主 |
| 6 | AI 助手开启 | 等确认 | 业主 |
| 7 | HubSpot | 等 token | 业主 |
| 8 | Google Search Console + 统计 | 未做 | 业主 |
| 9 | 部署与域名切换 | **未授权，未开始** | 业主 |
| 10 | **视觉人性化** | **← 本次移交的核心诉求** | **Codex** |

---

## 4. 请 Codex 给建议的问题（重点）

### 4.1 视觉"没有温度"

业主原话："**网站没有生气**"、"**要美感**"、"**更加人性化一些，生动一些，有人性的感受**"。

目前站点的问题（DSH 自评）：
1. **B 端工业感过强**：大量直角卡片、等距网格、无衬线正文，缺少节奏变化
2. **图片是最大短板**：产品照是"白底抠图 + 大留白"，缺场景照、缺人物、缺细节特写
3. **缺叙事**：页面基本是"标题 + 段落 + 卡片"的三段式，没有故事线、没有场景代入
4. **动效几乎为零**：只有 hover 微交互，滚动无节奏
5. **区块之间缺呼吸**：section 之间只有背景色变化，缺过渡设计
6. **数字与信任元素缺失**：没有"20 年制造经验""服务 X 个国家"这类可感知的信任块（注意：**不能编造**，需业主提供真实数字）

### 4.2 请 Codex 回答

1. **人性化怎么落**：在不编造内容、不加无关素材的前提下，如何让工业 B 端站点"有温度"？请给**具体到区块级**的方案（不是"多用圆角"这种空话）。
2. **图片策略**：缺实拍图的产品，除了渐变占位，还有哪些**不欺骗**的表达方式？（例如：线稿、图标化、场景化背景？）
3. **首页节奏**：现在 8 个区块一字排开，如何重排能形成"起承转合"？
4. **详情页**：当前是"产品手册式"结构（这是决策者已确认的版本，**不要建议回退**）。在这个基础上还能加什么，让它"更像人写的、更能推动客户留资"？
5. **微交互**：哪些滚动/悬停效果值得加，哪些是噪音？
6. **配色**：金黄 + 叶绿已定，但在大面积使用上如何避免"企业官网感"？

### 4.3 约束（务必遵守）

- **不得编造**：参数、认证、案例、价格、交期、客户名、统计数字——一律不许造
- **不得用无关产品图顶替**
- 英文优先；ES/PT 不索引
- 决策以业主为准，DSH 只执行

---

## 5. 如何读到代码

### 现状
- 本地：`D:\LITUBO-website`（分支 `work/litubo-dsh-local`）
- 远程：`git@github.com:coffeebearchen/litubo-website.git`
- **本分支尚未 push**（业主未授权）

### 三种交付方式（任选，需业主批准）

| 方式 | 步骤 | 优点 |
|---|---|---|
| **A. push 分支**（推荐） | `git push -u origin work/litubo-dsh-local` | Codex 可直接 clone / diff |
| **B. git bundle** | `git bundle create litubo-dsh.bundle work/litubo-dsh-local` | 单文件，可离线传 |
| **C. 打 zip** | 排除 `node_modules/.nuxt/.env/private-product-source` | 最简单，但无提交历史 |

### 关键文件索引

```
pages/index.vue                          首页
pages/products/[category]/index.vue      产品列表（3 列网格）
pages/products/[category]/[slug].vue     产品详情（含画廊/规格/Configurator/Catalogue）
pages/applications/[slug].vue            行业详情
pages/resources/index.vue                资源页（6 入口 + Latest）
pages/support/faq.vue                    FAQ（搜索 + 侧栏）
pages/admin/visitors.vue                 实时访客看板
components/global/SiteHeader.vue         顶栏 + 大菜单
components/global/MegaMenu.vue           大菜单面板
components/global/SiteFooter.vue         页脚（5 栏 + 社交）
components/global/CategoryStrip.vue      图标分类条
components/global/ExpertContactForm.vue  首页联系表单
components/ui/MediaCard.vue              产品卡
components/ui/ProductGallery.vue         详情页画廊
components/ui/Accordion.vue              折叠（FAQ）
assets/css/tokens.css                    品牌色 + 字号 + 间距
assets/css/base.css                      占位样式 + 打印样式
server/middleware/legacy-redirects.ts    301 重定向
server/api/track.post.ts                 访客埋点
server/api/admin/visitors.get.ts         访客看板 API
server/utils/wecomNotify.ts              企业微信推送
docs/project/VISITOR-TRACKING.md         访客系统部署说明
```

---

## 6. DSH 的自评（坦白）

**做得好的：**
- 结构与内容完整度：14 个主要页面全部 200，无断链
- 后端同步：数据、权限、重定向、追踪都落到了后端，不只是画皮
- 修的真实 bug：大菜单透明/误关、缩略图被裁、页脚失衡、`min-height` 顶飞页脚、FAQ 折叠不严、图片缩放裁切、媒体缓存 immutable

**做得不好的：**
- **视觉判断多次出错**（放大图导致裁切、页脚第一版失衡、颜色一开始用错）——都是靠业主截图纠正的
- **审美层面没有主动权**：前期只会照搬参考结构，做不出"有温度"的东西
- 这正是需要 Codex 介入的地方

---

## 7. 建议的下一步顺序

1. **Codex 给设计整改方案**（本报告 §4）
2. 业主确认方案
3. DSH 执行视觉改造
4. 业主提供：企业微信 Webhook / SMTP / 8 张实拍图 / 真实信任数字
5. 接通通知与 AI
6. GSC + 统计
7. 部署预览站 → 验收 → 域名切换
