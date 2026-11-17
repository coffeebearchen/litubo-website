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
| **V2-01** 字段闭环 | ✅ 完成（除 A05） | 见提交 | 保存 payload 补 3 字段；新建接口补白名单+枚举校验；邮件通知守卫；后台未读徽标 | 5/5 通过（false/null 区别、改系列、置空、还原） | 移除 3 行 payload + 2 处白名单回旧值 | — |
| **V2-02** 导航 + 统一入口 | ✅ 完成 | 见提交 | 五色分区导航（文字+图标）；4 个重复路径改跳转，旧文件保留；3 个独有工具保留 | 导航渲染、跳转目标、typecheck 0 | 恢复旧 nav 块 + 4 个文件旧内容 | — |
| **V2-03** posts 管理 | ✅ 完成 | 见提交 | `/admin/posts`（Blog/FAQ 同页，读 posts）+ GET/PATCH 接口 | 路由可达、typecheck 0 | 隐藏导航入口，数据未迁 | — |
| **V2-04** Hero | ✅ 完成（13/13 页已接） | 见提交 | 13 页注册表 + `/admin/page-content` + 单行 PATCH（publish/withdraw）；13 页前台全部读覆盖；CTA 标签与路径按「成对」合并 | 8 页真实覆盖往返（建行→读 HTML→删行→恢复默认）；首页走 `/api/cms/home` 同源验证；CTA 半对用例；typecheck 0 | 关闭覆盖读取（前台回默认文案） | — |
| **V2-05** cover_fit | ✅ 完成（含「Product categories」tab） | 见提交 | `posts.cover_fit` nullable string；按已核实清单迁移 10 篇；接口输出 coverFit；页面优先读它，null 回退旧清单；`/admin/page-content` 五 tab（Home/Company/Support/Resources + Product categories），分类 tab 直接读写 `product_categories` | 接口 coverFit=contain/cover 正确；分类读写往返 + 4 个拒绝用例；浏览器点选与深链实测 | 关新读路径、保留列不 DROP；分类 tab 不建副本、不改 slug/status | — |
| **V2-06** 内部询盘 AI | ✅ 完成（摘要/意图/缺项 + 人工确认） | 见提交 | 新 target `inquiry-summary`；`ai-proposal` 只出候选不写库；`ai-confirm` 校验绑定/一次性/原文指纹后写 4 列；询盘详情加 AI 面板；询盘读取增加 5 个 ai 列 | 合成询盘全链路（生成不写库→确认写 4 列→重放/伪 ref/未选/原文变动全部拒绝）；浏览器点击实测；CSRF 与未登录拦截；typecheck 0、lint 0 | 关闭 AI 入口（面板消失，普通状态/备注流程不受影响），已写列保留 | 见下方「待业主确认 #2」 |
| **V2-07** 视觉与合同验收 | ✅ 完成（8+1 张实现截图 + 差异表） | 见提交 | 只改两处实现缺陷（见下），其余是证据；差异表在 `reviews/.../04-verification/VISUAL-DIFF.md` | CDP 真实视口实测：8 页 0 横向溢出、0 console error；与 UI-01/02/05 设计图逐项对照 | 删除 `04-verification/` 即可，不影响代码 | 4 项待决定，见下方「V2-07 视觉验收结论」 |

---

## Schema 差异（V2 只允许新增一列）

| 表 | 现状 | V2 要求 | 差异 |
|---|---|---|---|
| `site_content` | 24 列，Hero 所需全有 | 复用现有 | **无差异** |
| `products` | 含称重 3 列 | 复用现有 | **无差异** |
| `inquiries` | 含 7 个 AI 列 | 复用现有 | **无差异** |
| `product_categories` | 名称/简介/图片 | 复用现有 | **无差异** |
| `posts` | **已加 `cover_fit`** | nullable string | ✅ 已建并迁移 10 篇 |
| `site_settings` | 联系方式 | 复用现有 | **无差异** |

### `posts.cover_fit` 迁移结果（V2-05，已完成）

**已完成。** 备份：`backup/2026-11-16/cover_fit-migration-backup.json`（33 条旧值）。

1. ✅ 已导出受影响记录旧值与 schema
2. ✅ 已建列：nullable string，dropdown 界面；**公开读权限白名单同步加列**（否则接口 503）
3. ✅ 按已核实清单迁移 10 篇（5 contain + 5 cover），其余 23 篇保持 null
4. ✅ 前端优先读 `coverFit`，null 时仍用 `CONTAIN_SLUGS`
5. 回退：关新读路径，**保留列不 DROP**

---

## V2-01 实测记录

### 字段闭环（本地已测，5/5）

用 `LT-150L`（id=29）验证：

| 用例 | 结果 |
|---|---|
| `checkweigher_l_series = false` 写入后重读 | ✅ 仍是 `false`（不是 `null`） |
| `checkweigher_l_series = null` 写入后重读 | ✅ 仍是 `null`（不是 `false`） |
| `checkweigher_series = 'standard'` | ✅ 保存成功 |
| `checkweigher_series = null`（未归类） | ✅ 允许保存 |
| 恢复原值 | ✅ `compact / online / true` |

### 修掉的真实缺陷

| # | 缺陷 | 影响 |
|---|---|---|
| 1 | 保存 payload 漏发 3 个称重字段 | 后台填了分类，保存后丢失 |
| 2 | 新建产品接口白名单缺 3 字段 | 新建时带的系列在下次保存丢失 |
| 3 | `SMTP_HOST=...` 占位符 | 每条询盘都报错，真正的失败被淹没 |

### 通知现状（方案 C —— 业主已选择）

| 渠道 | 状态 |
|---|---|
| SMTP | 未配置（占位符已删除，代码现在正确识别并只提示一次） |
| 企业微信 | 未配置 |
| **后台未读徽标** | ✅ 已加：侧栏「Customer Inquiries」显示待处理数量（当前 21） |

询盘始终写入数据库；徽标让新询盘不再像空收件箱。

## V2-07 视觉验收结论（本地已测）

完整差异表：`docs/project/reviews/2026-11-17-BACKEND-DSH-V2-0e6e98d/04-verification/VISUAL-DIFF.md`
实现截图 9 张在同一目录（`UI-01/02/03/04/05-*.png`），设计图仍在 `02-ui/`，两套文件分开。

### 机器判定（不靠肉眼）

| 项 | 结果 |
|---|---|
| 8 个页面在 1440 / 390 的 `documentWidth > viewport` | 全部 **false**（无横向溢出） |
| console error | **0** |
| 截图方式 | CDP `Emulation.setDeviceMetricsOverride`，真实布局视口，非裁切 |

### 本轮修掉的两处实现缺陷（由截图对照发现，不是凭空加的）

| # | 缺陷 | 修法 |
|---|---|---|
| 1 | `/admin/page-content` 一进入编辑页就显示「Unpublished changes」——`fillFrom()` 把 `dirty` 清成 false 后，默认异步的 `watch(form, deep)` 又把它翻回 true | `watch(form, …, { flush: 'sync' })`：填值期间同步触发，`fillFrom()` 结束时 `dirty` 保持 false；用户真正输入时仍会置 true |
| 2 | 询盘 AI 面板空闲态没有设计要求的 AI 标识 | 空闲态补紫色 `AI` 徽标（生成后为 `Unreviewed proposal`，确认后为 `Confirmed`） |

### 与设计图不一致但**有意保留**的地方

- 页面内容清单的 tab 用文字规格的 Home/Company/Support/Resources，而不是设计图的 All page heroes / Home blocks。
- Hero 编辑器不设 `Preview changes` 按钮：预览常驻右侧，再加一个切换是重复操作。
- 询盘详情沿用既有 1.6:1 布局，本轮只加 AI 面板，没有重排整页。
- 提案态不提供 `Regenerate` 链接：`Generate again` 就是同一件事。

### 需要业主决定的四项（本轮不动）

1. **产品编辑器 tab**：实现是 6 个中文 tab（基础信息/页面模块/技术参数/图片与资料/产品 FAQ/SEO），设计是 7 个英文 tab（Basics/Content/Specifications/Media/FAQ/SEO/**Preview**）。属更早模块的产物，改文案语言会影响既有测试与导航。
2. **Hero 图片入口**：后端 PATCH 已支持 `heroImage`，编辑页只有状态显示、没有选媒体入口。
3. **库里的测试草稿** `DRAFT: This should not appear in public API [TEST]`（slug `test-draft-post-do-not-publish`）是否清掉。
4. **页面内容清单 tab** 最终以文字规格还是设计图为准。

### 明确没验证的

- UI-03 的「产品工具三链接」、UI-04 的「Structured Content 说明」在首屏以下，未逐一点击。
- 设计图里的示例状态（`Published override · example` 等）在真实数据上无法重现，实现截图显示的是真实状态。
- 390px 只覆盖 UI-01 / UI-02 / UI-05；设计集本身也只给了 UI-02 的手机稿。

---

## V2-06 询盘 AI 实测（本地已测）

**做了什么**

| 文件 | 作用 |
|---|---|
| `server/utils/aiTargets/inquirySummaryTarget.ts` | 新 target `inquiry-summary`：输出只有 `summary` / `intent` / `missing` 三个字段；`intent` 用**项目已有的 6 个询盘类型**作词表，不另造分类 |
| `server/utils/inquiryAi.ts` | subject key（`inquiry:<id>`）、原文指纹（sha256）、给模型的输入（**不含姓名/邮箱/电话/公司**） |
| `server/api/admin/inquiries/[id]/ai-proposal.post.ts` | 只生成候选，**不写 inquiries**；provider 未配置时返回 `{ok:false, unavailable:true}`，人工流程照常 |
| `server/api/admin/inquiries/[id]/ai-confirm.post.ts` | 校验后写 `ai_summary` / `ai_intent` / `ai_processed_at` / `ai_reviewed` |
| `pages/admin/inquiries/[id].vue` | AI 面板：Generate / Confirm selected / Discard proposal，缺项红框标 Needs human review |
| `server/utils/adminInquiries.ts` + `types/inquiries.ts` | 询盘读取新增 5 个 ai 列（`ai_recommended_products`、`ai_draft_reply` 刻意不读，因为不写） |

**复用而不是新建**：provider 注册表、DeepSeek 适配器、`claimGenerateSlot` 限速、`rememberAnalysis` / `claimApply` / `readProposal` 提案机制全部沿用现有实现；没有新表、没有 Redis、没有队列、没有新依赖。

**Confirm 的校验链（按执行顺序）**

```
1 该 ref 属于这个管理员 + 这个询盘      → 否则 409
2 未过期                              → 否则 409
3 未被确认过（claimApply 一次性）      → 否则 409「已确认」
4 原文指纹与生成时一致（sha256 比对）   → 否则 409「询盘已改动，请重新生成」
5 至少接受一项                        → 否则 400
```

写入内容来自**服务端保存的候选**，不来自请求体——客户端自己发一段 "summary" 没有东西可写。

**实测结果（合成询盘 id=38/41，用完即删，库回到 22 行）**

| 用例 | 结果 |
|---|---|
| 未登录调用两个接口 | `401` |
| 无 `Origin` / 错 `Origin` / 正确 `Origin`（node fetch 精确控制） | `403` / `403` / `200` |
| 空 message 生成 | `{ok:false, error:'This inquiry has no message to summarize.'}` |
| 生成候选 | `ok:true`，返回摘要+意图+4–5 条缺项；**数据库 ai_summary 仍为 null、ai_reviewed 仍为 false** |
| Confirm（摘要+意图） | 写入 4 列；`ai_recommended_products`、`ai_draft_reply` 仍为 null；`ai_confidence` 仍为 null |
| 重复 Confirm | `409`，消息「This proposal has already been confirmed.」 |
| 一项都不选 | `400`「Choose at least one recommendation to save.」 |
| 伪造 ref | `409`「This proposal is no longer available. Generate a new one.」 |
| 生成后改动原文再 Confirm | `409`「The inquiry changed since this proposal was generated. Generate a new one.」 |
| 浏览器点击（真实 Chrome + CDP） | 初始只有 Generate；生成后徽标 `Unreviewed proposal`、缺项列表、Confirm/Discard；确认后徽标 `Confirmed`、显示 intent 与 `confidence: Not assessed`、按钮变 Generate again；**0 console error** |

**关于 DeepSeek**：为了验证链路真实可通，本轮用**合成文本**（`test-only@example.invalid`，正文明确写 TEST-ONLY）调用 provider 3 次。**没有把任何真实客户询盘内容发给 provider**，「是否允许用真实客户数据」仍是待业主确认项。

**不写什么（硬约束，已按代码实现并用实测证明）**

- 不写 `ai_recommended_products`、`ai_draft_reply`（一期保留不用）
- 不写 `ai_confidence`（没有校准依据，UI 显示 `Not assessed`）
- 不写 `status`、`inquiry_type`、`note`、`first_handled_at` 或任何联系方式字段
- 不发送任何客户回复；Discard 只清浏览器里的候选

**已知限制（如实记录）**

- 候选存在**进程内存**里（沿用现有提案机制）：重启或换进程后 ref 失效，重新生成即可；多实例部署时各实例互不可见。这与现有产品 AI 的限制一致，不是新引入的。
- `ai_reviewed` 只是「有人确认过」的开关，**不是审核历史**；没有 `ai_review_meta` 之类的表。
- 摘要由模型生成，可能读错语义；界面把原文放在同一页，确认前不落库——但这不是内容正确性的保证。

---

## V2-05 分类小 tab 实测（本地已测）

`/admin/page-content` 现在是五个 tab：`Home` / `Company` / `Support` / `Resources` / `Product categories`。
前四个按注册表的 `zone` 过滤页面列表；第五个直接读写现有 `product_categories`，**不复制进 `site_content`**。

| 用例 | 结果 |
|---|---|
| 未登录访问 `/admin/page-content` | 302 → `/admin/login`（守卫仍在） |
| 默认 tab = Home，只列 Home 一行 | ✅（浏览器实测，`rows: ["Home/"]`） |
| 点 Product categories | ✅ 列出真实 5 条（X-Ray / Metal / Checkweighers / Combination / Conveyors） |
| 点「Edit category」 | ✅ 标题 `X-Ray Inspection — Category content`，字段 Name / Introduction / Category image，媒体选择器存在 |
| 深链 `?page=company.global-service` | ✅ tab 自动切到 Company，标题 `Global Service Capability — Hero` |
| 浏览器 console error | 0 |

### 分类写接口的被拒用例（全部按预期拒绝）

| 用例 | 结果 |
|---|---|
| 不带 `Origin` 的 PATCH | `403`（CSRF 守卫，正常行为） |
| 不存在的 id（99999 / 12345） | `404` ← **本轮修掉的缺陷**：原来返回 `200 OK`，因为 Directus 对不存在的 id 执行 PATCH 不报错 |
| 空名称 | `400` |
| 图片不是文件 id | `400` |
| 分类行在拒绝后是否被改动 | 否 |

### 往返测试（含图片）

把 `X-Ray Inspection` 的名称、简介、`hero_image` 改成临时值 → 读回确认三项都落库 → 改回原值 → 读回确认完全一致；公开页 `/products/x-ray-inspection` 返回 200、无临时文案残留、原简介仍在。

### 接口边界的刻意选择

- 只写 `name_en` / `intro_en` / `hero_image`；**不写 slug**（公开 URL 依赖它）、**不写 status**（发布是另一道有闸门的决定）、不建行不删行。
- 图片必须是合法 uuid 且来自媒体库；空值表示移除图片。
- 写成功但返回行 id 不匹配时抛 `409`，不谎报"已保存"。

---

## V2-04 前台接线实测（13/13 页）

测试方法：用 Directus 管理员凭据**临时建一个已发布行**（标题/正文写 `OVERRIDE-*` 标记），读页面 HTML 确认字段真的渲染，然后**删除该行**，再读一次确认恢复默认。不是"看代码觉得对"。

| 页面 | page_key | 覆盖渲染 | 清理后残留 |
|---|---|---|---|
| `/company/about` | `company.about` | ✅ 眉标/标题/正文 + 主次按钮 | 无 |
| `/company/quality-manufacturing` | `company.quality-manufacturing` | ✅（上一批已接，本轮回归 200） | 无 |
| `/company/global-service` | `company.global-service` | ✅ 眉标/标题/正文 + 主次按钮 | 无 |
| `/company/become-a-partner` | `company.become-a-partner` | ✅ 眉标/标题/正文（此页无按钮） | 无 |
| `/resources` | `resources.overview` | ✅ 标题/正文（此页无眉标、无按钮） | 无 |
| `/support/technical-support` | `support.technical-support` | ✅ 标题/正文（此页无眉标） | 无 |
| `/support/manual-request` | `support.manual-request` | ✅ 标题/正文（此页无眉标） | 无 |
| `/support/service-training` | `support.service-training` | ✅ 眉标/标题/正文（组件内渲染） | 无 |
| `/support/request-spare-parts` | `support.request-spare-parts` | ✅ 眉标/标题/正文 | 无 |
| `/support/send-product-test` | `support.send-product-test` | ✅ 眉标/标题/正文 | 无 |
| `/resources/downloads` | `resources.downloads` | ✅（上一批已接，本轮回归 200） | 无 |
| `/resources/videos` | `resources.videos` | ✅（上一批已接，本轮回归 200） | 无 |
| `/` | `home` | ✅ 走 `/api/cms/home`：库内 `home.hero`（id=1，published）的 `title_en` 与首页 `<h1>` 完全一致 | 未动其 8 个原有块 |

**首页不需要第二个读取器**：`/api/cms/home` 本来就读 `site_content` 的 `home.hero`（含 es/pt），而 `/admin/page-content` 写的也正是 `content_key='home.hero'` 这一行。再叠一层 `usePageHero` 只会造成两个读取器抢同一行。

### 顺手修掉的两个真实缺陷

| # | 缺陷 | 修法 |
|---|---|---|
| 1 | CTA 的「成对」保护实际不生效：`label` 与 `path` 各自回落，于是"只填标签"会配上**默认页面的旧地址**，按钮指向错地方 | `usePageHero` 改为整对合并：标签和路径都来自覆盖，或都保留默认 |
| 2 | `ResolvedHero` 的 CTA 字段是可选的，模板里 `localePath(hero.ctaPrimaryPath)` 拿不到确定字符串 | 返回值统一成 `string`（`fromDefaults` 归一化），模板不再需要判空 |

### 其他证据

| 项 | 结果 |
|---|---|
| `npm run typecheck` | 0 错误（默认堆会 OOM，需 `NODE_OPTIONS=--max-old-space-size=6144`） |
| `npx eslint`（9 个改动文件） | 0 错误，6 条既有未使用变量警告 |
| 浏览器水合（CDP，`/company/about`、`/support/service-training`） | `__vue_app__` 存在，0 条 console error，0 个失败请求 |
| 测试行清理 | 建了 8 行、删了 8 行；`site_content` 回到 9 行（1 hero + 8 个首页块），`OVERRIDE-` 残留为 false |
| **生产构建 `nuxt build`** | **本轮未验证**：两次尝试都把机器内存打满（15.5 GB 总量），Windows 杀掉 DSH 渲染进程。详见交接文件「坑 6」 |

### 已知限制（记录，不隐藏）

- `/resources`、两个支持表单页的 hero 设计里**没有眉标**，`/company/become-a-partner` **没有按钮**。这几个页面上对应的后台字段可以编辑但不会显示。
- 覆盖只写 `_en` 列；`/api/cms/home` 支持 es/pt，`usePageHero` 只读英文。当前仅英文对外，不影响。

---

## 待业主确认 / 待资料

| # | 项 | 说明 |
|---|---|---|
| 1 | 邮件通知 | 业主已选方案 C：暂不配 SMTP/企微，改用后台未读徽标。日后要邮件需提供 SMTP_HOST/USER/PASS |
| 2 | AI provider | ✅ 已核实配置：`AI_DEFAULT_PROVIDER=deepseek`、`DEEPSEEK_MODEL=deepseek-v4-flash`、`DEEPSEEK_API_KEY` 存在。**仍需业主确认的两点**：(a) 是否允许把**真实客户询盘内容**发给 DeepSeek（目前只用合成文本验证过）；(b) 预算口径。功能本身已可用，未确认前不要在真实客户询盘上点 Generate |
| 3 | Hero 13 页的 page_key | 除 `home` 外均为建议命名；本地已验证首次发布会在 `site_content` 建对应行，无冲突。若业主希望改名，只需改 `server/utils/heroRegistry.ts` 的 `contentKey` |

---

## 未做（本轮不授权）

```
不发布、不合并到生产
不改 DNS / 不碰 Wix
不对客户外发
不自动启用生产 AI
```
