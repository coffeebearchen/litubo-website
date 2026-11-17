# V2-07 视觉与合同验收 —— 实现截图与设计图对照

Plan ID：`BACKEND-DSH-V2-0e6e98d`
验收日期：2026-11-17
分支：`work/c-refined-v1`

## 0. 方法与证据来源

- **实现截图**：本目录 `04-verification/*.png`，由 headless Chrome + CDP `Emulation.setDeviceMetricsOverride` 真实改变布局视口后截取（`captureBeyondViewport: false`，视口高度见下表）。
- **不是设计图**：本目录所有 `UI-0x-*.png` 都是本地 dev server 渲染出来的实际页面，设计图仍在 `../02-ui/`，两套文件分开存放，不会混淆。
- **同滚动位置**：统一停在页面顶部。
- **登录态**：使用本机 Directus 管理员会话 cookie；UI-05 用的是**合成询盘**（`test-only@example.invalid`，正文标注 TEST-ONLY），截图后即删除，库里没有真实客户数据进入截图。
- **没有改真实数据**：本轮截图只读取页面，未保存任何表单。

复现命令（需先起 dev server 与 headless Chrome）：

```powershell
# 起 Chrome 调试端口
Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
  -ArgumentList '--headless=new','--remote-debugging-port=9222',"--user-data-dir=$env:TEMP\v2-07",'about:blank'
# 截图脚本（本次使用的脚本是临时文件，逻辑见下方「测量」一节；也可直接用仓库自带的窄视口脚本）
node scripts/screenshot-viewport.mjs http://localhost:3000/admin/page-content 1440 1100 out.png
```

## 1. 视口与横向溢出测量（机器判定，不靠肉眼）

| 截图 | 路由 | 视口 | `documentWidth` | 横向溢出 | 文档高度 |
|---|---|---|---|---|---|
| `UI-01-page-content-1440.png` | `/admin/page-content` | 1440 | 1440 | 否 | 1100 |
| `UI-01-page-content-390.png` | `/admin/page-content` | 390 | 390 | 否 | 900 |
| `UI-02-hero-editor-1440.png` | `/admin/page-content?page=company.about` | 1440 | 1425 | 否 | 1336 |
| `UI-02-hero-editor-390.png` | 同上 | 390 | 390 | 否 | 2280 |
| `UI-03-product-editor-1440.png` | `/admin/products/47` | 1440 | 1425 | 否 | 1714 |
| `UI-04-blog-faq-1440.png` | `/admin/posts` | 1440 | 1425 | 否 | 1927 |
| `UI-04-blog-faq-editor-1440.png` | `/admin/posts`（选中一条） | 1440 | 1425 | 否 | — |
| `UI-05-inquiry-ai-1440.png` | `/admin/inquiries/{合成id}` | 1440 | 1440 | 否 | 1200 |
| `UI-05-inquiry-ai-390.png` | 同上 | 390 | 390 | 否 | 2255 |

> `documentWidth = 1425` 的四项来自 15px 滚动条，不是溢出；判定用的是 `documentWidth > viewport`。
> 全部 8 个页面 **0 条 console error**。

## 2. 逐屏差异

判定口径：**一致** = 结构/入口/语义与设计一致；**有意偏离** = 与设计不同但有明确理由；**待修** = 本轮修掉；**待决定** = 需要业主拍板，本轮不动。

### UI-01 页面内容清单（`/admin/page-content`）

| 设计点 | 实现 | 判定 |
|---|---|---|
| 面包屑 → 标题 → 副标题 → 来源说明 | `Content / Page Content` → `Page Content` → 副标题 → `Source: site_content — one row per page` | 一致 |
| 三个 tab：All page heroes / Home blocks / Product categories | 五个 tab：Home / Company / Support / Resources / Product categories | **有意偏离**：`01-specs/08-UI-SPECS-V2.md` 第 15 行写的是「Home/Company/Support/Resources tab」，以文字规格为准；分类 tab 单独标为原集合 |
| 表格列 Page / Editing scope / State / Action | 同四列；`Edit hero →` 为 44px 以上点击区 | 一致 |
| 默认状态不用红色，三种状态都有文字 | `Published override` / `Draft` / `Using default` 文字 + 浅底色，无红色 | 一致 |
| 设计图底部「One place for page introductions」说明卡 | 未实现 | **有意偏离**：该卡是设计交付物里的说明区，不在 UI 规格的表格范围内 |
| 行高 72px、表头 48px | 行高约 86px（内容两行时更高） | 轻微偏离，未修（不影响可用性与 390 布局） |

### UI-02 单行 Hero 编辑（`/admin/page-content?page=company.about`）

| 设计点 | 实现 | 判定 |
|---|---|---|
| 标题 `About LITUBO — Hero` + 状态 | 同，状态为真实值 `Using default`（设计图为示例 `Published override · example`） | 一致 |
| 浅黄提示「Changes stay in this browser until you publish.」 | 同（合并为一行，含「Refresh discards unpublished edits.」） | 一致 |
| 左侧表单：Eyebrow / Title / Introduction / Hero image / Button label + Link | 完全同序同字段 | 一致 |
| 右侧预览 + `Local preview — not live` | 同；无 Desktop/Mobile 切换 | 轻微偏离，未修 |
| 按钮 `Preview changes` + `Publish changes` | 只有 `Publish changes`（预览常驻右侧） | **有意偏离**：预览已常显，再加一个切换按钮是重复操作 |
| `Withdraw override` 文字动作 + 说明 | 同（在按钮下方分隔线下） | 一致 |
| Hero image 可选媒体 | **只能显示状态，没有选媒体入口** | **待决定 / 待补**：后端 PATCH 已支持 `heroImage`，前端缺媒体选择器。属于 P1 可用性缺口，未在本轮扩大范围 |
| 面包屑含页面名 `Content / Page Content / About LITUBO` | 只有 `Content / Page Content` | 轻微偏离，未修 |
| `Preview does not save…` 独立第二行 | 与第一句合并 | 轻微偏离 |
| 一进页面就显示 `Unpublished changes` | **本轮修复**：`watch(form, …, { flush: 'sync' })`，`fillFrom()` 清掉 `dirty` 之后不再被异步 watcher 翻回 true | **待修 → 已修** |

### UI-03 产品统一编辑（`/admin/products/47`）

| 设计点 | 实现 | 判定 |
|---|---|---|
| 头部产品标题 + code + 状态 | 标题 `Pipeline Metal Detector – 200 mm`；右侧「发布状态 Published」「ID 47」「创建/更新时间」；Product Code 锁定显示 `LT-HS200` | 一致 |
| 七个 tab：Basics / Content / Specifications / Media / FAQ / SEO / Preview | **六个 tab，且是中文**：基础信息 / 页面模块 / 技术参数 / 图片与资料 / 产品 FAQ / SEO；**没有 Preview** | **待决定**：这是更早模块（PW-01…）的产物，不在 V2-06/V2-07 改动范围。改文案语言与补 Preview 会影响既有测试与导航，需业主确认后再动 |
| 警示区展示 Draft-only 限制 | `This product is published. Product details are read-only — return it to Draft to edit.` | 一致（且比设计更具体） |
| 产品工具三个显式链接 | 本截图未覆盖（在页面更下方） | 未验证，见 §3 |

### UI-04 Blog 与 FAQ（`/admin/posts`）

| 设计点 | 实现 | 判定 |
|---|---|---|
| 来源 badge 写明 `posts` | `Source: posts` | 一致 |
| Blog / FAQ 两个标签 | 同 | 一致 |
| 左侧记录列表、右侧编辑 | 左列表约 40%、右编辑约 60%（设计约 30/70） | 轻微偏离，未修 |
| 编辑区含封面、title、excerpt、body、status、SEO | 选中记录后为 `Article editor`：Title / Summary / Article body / Status / `Image fit` | 一致（字段顺序按真实列） |
| `cover_fit` 是唯一新增选项；默认 `Existing default` | 下拉为 `Existing default / Contain — show the entire machine / Cover — fill the frame`，且注明「The only added field: posts.cover_fit (nullable).」 | 一致 |
| 底部 Structured Content 说明链接 | 本截图未覆盖 | 未验证，见 §3 |
| 列表里出现 `DRAFT: This should not appear in public API [TEST]` | 后台能看到草稿是正确行为；但这是**库里的测试残留**（slug `test-draft-post-do-not-publish`，草稿状态） | **待业主决定**：是否清掉这条测试数据 |

### UI-05 询盘 AI（`/admin/inquiries/{id}`）

| 设计点 | 实现 | 判定 |
|---|---|---|
| 左原文只读 + 右按需 AI | 左侧 Contact / Customer message / Source and CRM；右侧 `AI assistance` + `Follow-up` | 一致（布局沿用既有询盘详情） |
| 左右约 1:1 | 现有布局约 1.6 : 1 | **有意偏离**：询盘详情是既有页面，本轮只加 AI 面板，未重排整页 |
| 标题紫色标 AI assistance、未确认标 Unreviewed proposal | `AI assistance` + 紫色 `AI` 徽标；生成后变 `Unreviewed proposal`；确认后变 `Confirmed` | 一致（徽标本轮补齐） |
| 展示摘要、意图、缺项；缺项红框 + Needs human review + 文字 | 摘要（可勾选）、意图（可勾选）、缺项红框 `Needs human review — the message does not say:` + 列表 | 一致 |
| 无校准分数，confidence 显示 `Not assessed` | 显示 `Confidence: Not assessed` | 一致 |
| `Confirm selected` / `Discard proposal` | 同两个按钮 | 一致（主按钮用后台绿色而非设计紫色） |
| 固定文案 `No customer reply is sent.` | `No customer reply is sent. Discard only clears this proposal.` | 一致 |
| 提案失效时给 `Regenerate` | 提案态没有 Regenerate；Discard 或确认后才出现 `Generate again` | **有意偏离**：失效时后端会返回明确原因，重新生成走同一个按钮，避免两个入口 |
| 生成前不显示候选，也不显示任何已确认结果 | 生成前只显示说明与按钮；确认后才显示已保存结果 | 一致 |

## 3. 本轮**不能**验证的部分（明说）

1. **UI-03 的产品工具三链接、UI-04 的 Structured Content 说明**：都在首屏以下，截图未覆盖，也未逐一点击。
2. **设计的「示例状态」**（`Published override · example`、`Draft`）在真实数据上无法重现；本目录的实现截图显示的是真实的 `Using default` / `Published`。
3. **390px 下的 UI-03 / UI-04**：本轮只截了 UI-01 / UI-02 / UI-05 的 390。设计集本身也只给了 UI-02 的手机稿，其余屏的手机稿属于后续。
4. **字体渲染**：设计图与实现都用系统字体，字形有细微差别，按 `08-UI-SPECS-V2.md` 第 47 行属于容许范围。

## 4. 本轮的结论

- 八个实现页面**全部无横向溢出**，无 console error，入口与主要语义与设计一致。
- 修掉两处实现缺陷：编辑页一打开就显示「有未发布改动」；AI 面板空闲态缺少 AI 标识。
- **业主已指定并完成的两项**（2026-11-17 后续批次）：
  - Hero 编辑页补上了 Media Library 选择器（同一场次验证：选图→预览→发布→库中 `hero_image` 一致→公开接口可取图；非法 id 返回 400）。
  - 清掉了测试草稿 `DRAFT: This should not appear in public API [TEST]`（id=5，备份在 `backup/2026-11-17/`）。
- **仍需注意**：`hero_image` 会被保存并由 `/api/cms/page-hero` 返回，但**目前没有任何前台页面渲染 `hero.imageUrl`**（各页 hero 布局用的是自己的图片位）。要让图片真正出现在页面上，需要按页面逐个接布局。
- **仍需业主决定的两项**：
  1. 产品编辑器 tab 是否改成 7 个英文 tab（含 Preview）；
  2. 页面内容清单的 tab 结构以文字规格（Home/Company/Support/Resources）为准，还是改成设计图的（All page heroes / Home blocks / Product categories）。
