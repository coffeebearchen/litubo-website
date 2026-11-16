# LITUBO 英语站审查报告

基线：`coffeebearchen/litubo-website` / `work/c-refined-v1` / `b169d978647a86c803fbd4f71f87352a80fb6cd8`。日期：2026-11-16。角色：独立审查与策划；DSH负责后续实现。

## 摘要

未发现已验证的 P0；这不等于完成生产安全认证。
最先修：Insights 的503→404、称重分类的故障→零型号、询盘规范化与业务必填校验。
SEO收尾包括缺失的5个分类与11个Blog URL，以及29个已发布产品的noindex发布决定。
Blog交付10篇逐项映射、3张新生成封面、2份可复用真实产品图；不直接改CMS。
AI先做人工可审的询盘信息整理，再小范围使用现有受限助手，不另建无约束聊天机器人。

## 审查依据与边界

- 已完整阅读 `docs/project/CODEX-REVIEW-BRIEF-2026-11-16.md`。其旧HEAD `1642b68` 被本次用户指定的 `b169d97` 覆盖。
- 66个Vue页面文件、191个server文件已建立完整清单并静态扫描；重点人工读取公共页面、CMS、媒体、询盘、搜索、认证、追踪、SEO与AI边界。**不宣称191个文件均逐行人工审完，或36个管理页面均登录操作完成。** 清单见 `evidence/source-coverage.csv`。
- 使用目标提交独立导出快照；Node22.22.2，Nuxt3.21.11/Vue3.5.42/Nitro2.13.4。没有切换/修改原工作分支，没有修改业务代码、提交、PR、CMS、Wix、DNS或部署。
- 内容来自库内2026-11-16快照。为核对页面，启动只读本地快照适配器；**所有媒体公开状态是模拟的**，部分产品图为测试替身。页面状态、模板与故障处理可验证，真实115文件的内容/公开资格、数据库权限、线上集成不可由此证明。截图不用于证明正式CMS素材完整。
- 浏览器访问76个地址：74个正常页面200；任务书误列的 `/terms` 和专设未知路径404。另测真实条款地址 `/terms-of-use` 为200。因此实际正常页面覆盖75个地址（含动态产品/文章）。`/terms` 不是当前页脚死链，页脚正确指向 `/terms-of-use`。
- 320/390/768/1024/1440各抽查首页、称重、肉类应用、Blog列表、备件，共25组合；没有整页横溢。500px称重补查为500/500，无横溢，见 interactions.json。这不是每个页面、每个宽度的全覆盖证明。
- 没有读取现有 `.env` 密钥、客户询盘或访客明细；没有调用真实邮件、WeCom、HubSpot或模型服务。

### 数据口径纠正

| 项 | 快照事实 |
|---|---|
| products | 41条：29 published、8 draft、4 archived |
| categories | 5个已发布，均seo_noindex=false；输送/剔除分类暂无已发布产品 |
| posts | 33条：25 published（10 insight、15 faq），8 draft；“已发布10”仅适用于Insights |
| 产品SEO | 29个published全部seo_noindex=true；这是当前字段事实，不能擅自清空 |
| directus_files、roles/policies | 快照未提供；115文件总量和实际授权本次无法独立核实 |
| specs完整性 | 快照有groups，没有spec_items等全部子表；不能根据备份缺子表判定网站没有参数 |

## A. 全站审查

### P0

本轮无已证实P0。匿名 `/api/admin/inquiries` 为401；匿名管理页面最终转到登录（HTTP客户端可能跟随重定向看到200，不能据此认定未鉴权）。现有Admin写接口受全局认证和Origin检查；完整生产policy仍需DSH在原环境验证。

### P1 / P2 / P3 清单

下表为真实代码问题或已重现分支。工时为DSH熟悉现有代码情况下的估计，不是承诺；同一文件任务可合并，不能机械相加。

| ID/等级 | 位置 | 问题及复现 | 修法/影响 | 估计h |
|---|---|---|---|---|
| A01 P1 | `pages/resources/insights/[slug].vue:16` | CMS 503 被页面改成 404。断开 posts 读请求；API=503，文章页面=404。见 fault-probes.json。 | 复用 publicPageStatus；仅真实不存在/类型不符为404；上游故障保持503。 影响：10篇 Insights，错误收录与客户体验 | 1–2 |
| A02 P1 | `pages/products/checkweighers.vue:20` | 称重分类页吞掉 API 故障，返回200与零型号。产品接口503时页面200，products回退[]，显示无匹配型号。 | 取出 error；SSR 使用统一503状态；客户端显示故障和重试，保留筛选条件。 影响：称重分类入口 | 1–2 |
| A03 P2 | `server/utils/publicInquiry.ts:198` | 邮箱先验证后去标签，实际入库邮箱可能无效。隔离HTTP探针：<b></b>@example.invalid 得到200，写入 @example.invalid。没有连接真实CMS。 | 邮箱只 trim/长度限制并严格验证，拒绝HTML；在最终规范化值上校验；无效值不得入库。 影响：全部公共询盘 | 1–2 |
| A04 P2 | `server/utils/publicInquiry.ts:202` | 后端未校验各类业务必填字段。仅 type=send_product_test、email、consent 即200，姓名/产品/正文均空；见 review-probes.log。 | 小型按 inquiry_type/subtype 的必填表，跟当前各表单对齐；保留 spare_parts 不要求姓名的既有契约；不擅自增加前台必填。 影响：所有表单的数据完整性 | 2–3 |
| A05 P2 | `pages/support/[requestType].vue:21` | document 查询上下文被读取后丢弃。访问 /support/manual-request?document=drawing，实际 textarea 为空；计算的 form/issue 未传入 SupportRequestForm。 | 将白名单 document 映射传为 messagePrefix/defaultMessage；确认最终入库 message 带资料类型；删除未使用的父级 form。 影响：旧资料深链、人工跟进 | 0.5–1 |
| A06 P2 | `components/global/SiteSearch.vue:113` | 搜索对话框未管理 Tab 焦点范围。打开搜索，输入框 Shift+Tab 后焦点回到遮罩后面的 Find a distributor；search-focus.json 已记录。 | 限制焦点在对话框内、背景 inert、关闭恢复触发按钮；Escape保留。 影响：全站键盘搜索 | 1–2 |
| A07 P2 | `components/forms/SupportRequestForm.vue:46` | 支持表单禁用原生校验后只检查非空；错误不定位。novalidate；email=not-an-email 能通过本地 validate，最终只能收到泛化发送失败；FormField 未关联 aria-invalid/aria-describedby。 | 补邮箱格式提示；失败保持值和重试；提交时聚焦首个错误；错误p添加id并关联控件；不重建表单框架。 影响：支持与资料申请表单 | 1–2 |
| A08 P2 | `pages/resources/insights/[slug].vue:105` | 封面全部 cover；注释承诺的设备 contain 并未生效。img没有 --contain class；竖幅机器图在820px宽/460px高约束下会裁掉主体；定义的modifier未绑定。 | 为设备封面使用 contain，或本期所有文章封面均 contain；场景图可 cover；用当前真实设备照片对照，不能只改注释。 影响：文章设备封面 | 0.5–1 |
| A09 P2 | `server/api/track.post.ts:69` | 来源网址原文含query/fragment被保存，与“只存域名”说明不符。referrer 仅 slice(0,512)；带 ?email= 或 #fragment 的输入原样进入 payload。插件发送 document.referrer。 | 服务端解析并只保留 origin/hostname，来源归类仍可保留；无效URL置空；不采集原始URL中的个人信息。 影响：访客统计数据最小化 | 0.5–1 |
| A10 P2 | `server/api/admin/content-center/index.get.ts:3` | Nuxt 内容中心与当前 Blog 是两个数据源。当前10篇文章读 /items/posts；Content Center 使用 content_items/content_item_locales。不能把修改技术文章草稿等同修改这10篇。 | 首期明确以 Directus 原生 posts 编辑并做一篇改文/改封面的往返验证；如必须在 Nuxt Admin 内操作，再补最小 legacy Insights 编辑入口；本轮不大迁表。 影响：Blog日常维护与前后台一致 | 1–2（验证交接）；独立编辑入口另估 |
| A11 P2 | `backup/2026-11-16/content/posts.json:1` | 部分文章把可选配置写成普遍结论。post16标题为 three technologies，正文说单一剔除站移除任何检查失败包装，而列出的组合也有两技术；post13对骨/塑料及包装适用性的概括缺条件。 | 16改为 Combining inspection technologies on your line，single reject改为depending on configuration；13用may/depends on product and test，技术人员确认后保存；slug不改。 影响：技术可信度 | 1–2 |
| A12 P2 | `components/ui/CTABanner.vue:93` | 金黄CTA白字对比度低。白色/#D99200 计算约2.60:1，低于大字3:1；首页已经用深字，公共CTA仍白字。 | 保留已确认品牌金黄；把该按钮前景改为 #18332B，约5.21:1；同时核对BaseButton accent实际使用处。 影响：公共CTA可读性 | 0.5–1 |
| A13 P3 | `components/global/MegaMenu.vue:134` | 菜单图片区仍是CSS空色块，补分类图不会自动填这里。Products photo-area、Resources featured-photo、Company promo对应的是div/背景，非图片字段；源码可直接复现。 | 保持菜单结构，绑定已有产品照片/已批准机器插画；Resources使用实际已发布文章封面；无记录时隐藏推荐位，不能假造文章。 影响：桌面菜单完整性 | 1–2 |
| A15 P2 | `components/global/SiteSearch.vue:70` | 短查询不能作废仍在途的旧搜索。浏览器延迟weigher响应，输入改成x；结果仍出现OLD_QUERY_RESULT，interactions.json已记录。 | 每次输入变化/清空/关闭都立即更新请求代号或AbortController；判定短查询前也要作废旧请求。 影响：搜索结果可信度 | 0.5–1 |
| A14 P2 | `tests/contentPublicDelivery.test.ts:1` | 现有回归测试仍锁定旧Blog架构和旧封面URL。复测：contentPublicDelivery 3失败；publicRouteCorrectness 4失败，其中3条仅?v=2契约、1条首页故障回退预期变化。 | 先确认posts为本期事实来源；更新测试的真实业务断言，允许合法版本参数；保留私有/归档/不存在/权限故障的负向断言，不靠删测试变绿。 影响：后续改动可信度 | 1–2 |

### 已知项单独跟踪，不当新发现重复报

| 已知项 | 本轮结论 |
|---|---|
| 手机横向溢出 | 25个代表性组合未复现；不能断言所有页已修复。保留原待办，DSH按原复现地址再核对 |
| technical-matching忽略series | 仍在代码中；按既有待办修复，验证五系列尤其Pharmaceutical上下文，不重开分类决定 |
| 五张分类图缺失 | 快照分类hero_image为空；已有品牌占位不算破图，首期可接受明确占位。不能用不相干产品冒充 |
| 隐私政策未定稿 | 仍为上线前业务确认项；条款 `/terms-of-use` 同样明确pending legal review，需一并补齐 |
| 其他语言 | 本轮不审、不报缺陷、不安排扩语言；英文既有URL保持不变 |

### 验证结果与限制

原有5个相关测试文件共150条：初跑142通过、8失败，其中1条因审查导出时未含`.env.example`造成，恢复该公开模板后对应文件复跑58通过/4失败；合并同版本有效结果为143通过、7失败。7条的根因已分为旧架构预期3条、封面`?v=2`预期3条、首页媒体失败时保留文字的旧预期1条。**这些失败不证明私有媒体泄漏。** 不应回退现有正确设计来满足旧测试。

另有2条隔离HTTP审查探针通过，分别证明A03/A04可复现。这里“通过”表示成功复现问题，不表示修复通过；探针只写内存，不写Directus。日志在 `evidence/review-probes.log`。

本次无代码修改，所以未重复完整build/typecheck，也未把DSH过去的“0类型错误”当作本次新验证结果。

## B. AI 功能建议

### 排序结论

1. **询盘摘要与缺项整理，先供人工查看**：减少销售重新读长文本的时间。
2. **沿用现有受限助手，做家族引导和信息补问**：先引到正确表单，不代替工程选型。
3. **内部询盘分类与待办提示**：有明确规则再用AI处理歧义。
4. **型号/别名检索**：现阶段规则搜索比新增大模型检索更合算。
5. **带出处的技术文档问答**：真实资料和版本齐备后再做。
6. **附件信息提取辅助**：后期给销售使用，不自动写产品事实。

### 详细方案

| 功能 | 客户/销售真实痛点与排序依据 | 数据是否够 | 风险与限制 | 工作量 | 现在做? |
|---|---|---|---|---|---|
| 询盘结构化摘要 | “我描述了一大段，你们到底还缺什么？”；直接改善交接，最少产品知识依赖 | 现有表单、原始message足够起步；量程等未提供就为null | 保存原文；摘要标AI草稿；每个提取值引用原句；缺值不猜；销售确认后跟进 | 中，6–10h | 修好询盘入口后做；优先内部使用 |
| 受限家族引导 | “不知道先看哪种设备”；已有VisitorAssistant与静态知识，复用成本低 | 五家族、现有咨询路径已够；不够回答具体参数/现场适用性 | 不给精度、价格、交期、认证、保证；不用虚构概率；只输出候选方向、缺项、允许路径 | 中，4–8h | 先预览小范围启用，满足下方门槛再决定正式开启 |
| 询盘分类/待办 | “这条应由谁看、缺什么？”；字段齐全后价值更高 | 现有type/subtype够规则分类；负责人/优先级标准需业主确认 | 不按国家武断评客户价值；AI不得自动外发或许诺；销售可改分类 | 小至中，4–8h | 先规则；AI只补自由文本歧义 |
| 型号/别名检索 | “型号写法不同搜不到”；当前29产品/10文章无需向量服务 | 已发布型号、真实别名、slug足够 | 同源公开数据；不搜草稿/私有附件；数据量尚小不设武断容量阈值 | 小，2–4h | 可以；是搜索增强，不必贴AI标签 |
| 有出处的资料问答 | “这条参数在哪一页、哪个版本？” | 现有静态助手知识不足；需完整已审核datasheet、版本、适用型号、公开资格 | 引用文件/页码/原句；版本不确定拒答；不得把生成答案变成检测合格结论 | 中至大，12–20h | 暂缓；先补真实资料目录 |
| 附件提取助手 | “客户给一份文件，重复录入费时” | 已有后台资料提取底座可复用，实际业务附件与规则需确认 | 大小/类型限制；私有文件不自动公开；图中猜测标不确定；仅人工采纳 | 中至大，10–18h | 后做，初稿不阻塞 |

### 现有 AI 的真实边界与一期建议

已实现：`VisitorAssistant.vue`、`/api/assistant`、`visitorAssistantTarget`与provider registry；启用与key/model配置双门槛；4KB请求上限、问题1–800字符、每IP每分钟3次、输出schema与跳转路径白名单、失败给人工入口。不能重复立项“从零搭客服”。**现有知识为小型公开静态摘要，未检索29个产品或完整datasheet，也没有真实人工坐席接管/已通知销售功能。**

建议一期先允许受限助手的预览验证；正式公开开关暂不在本次操作。开关前必须：

- 知识范围只含已发布英文家族/咨询说明；回答价格、交期、精度、合规等问题时转人工；保留拒答/失败演示。
- 页面提示“AI guidance; final configuration is confirmed by our team”；提示问题会送往所选模型提供商，勿输入敏感资料。隐私文本与实际服务匹配，提供商保留/训练政策需业主确认。
- “Talk to our team”跳转真实表单；征得客户操作后带入问题摘要，不暗示已派人处理。
- 在现有provider调用处设置输出token上限、超时及全站每日用量/费用熔断；IP限流不等于总预算。**每日金额上限需业主确认**；不配置新付费服务，模型API仍有实际用量费用，按当时价目测算，不编报价。
- 首期单实例可用简单服务端计数/现有数据库持久计数；多实例再统一计数，不要求引入新收费基础设施。
- 用正常选型、缺资料、要求报价/交期、越权指令、上游超时各一组代表性问题验收即可，不做高成本无尽评测。

## C. Blog 图片审计

### 证据说明

当前封面UUID来自posts快照；内容描述依据库内 `blog-cover-assets.json` 与已有同名交付资产/真实设备照片。实际Directus `/files` 的 `filename_download`、115个媒体全表与公开状态没有提供，本轮**无法核验**。下面的旧图名是逻辑别名，不伪装成已读取的真实下载文件名；DSH执行前须对照实际缩略图与元数据。

### 十篇逐项表

| post ID / slug | 标题 | 当前封面UUID / 别名 | 图像、重复与匹配判断 | 处理 |
|---|---|---|---|---|
| 12 `how-x-ray-inspection-works` | How X-ray inspection works in food production | `d3eb45ab-2b32-4661-919e-d41b3c8bca1e` / `xray-real` | 真实食品 X-ray 设备照片；同 13；与主题相关，没有证据认定错图 | 保留 |
| 13 `x-ray-or-metal-detection` | X-ray or metal detection: which system fits your product? | `d3eb45ab-2b32-4661-919e-d41b3c8bca1e` / `xray-real` | 与 12 相同的 X-ray 设备照片；重复；标题为技术对比，单台设备仅能作为示例 | 复用真实照片 |
| 14 `how-metal-detection-works` | How metal detection works and when to use it | `f4899fc4-5ff1-4198-9e7c-fee718ef1940` / `metal-real` | 真实金属检测设备照片；独立，相关 | 保留 |
| 15 `checkweighing-basics` | Checkweighing basics: keeping fill weights compliant | `a6d701d1-4902-4880-a2f5-87ec36a0c03e` / `weigher-real` | 真实在线称重设备照片；独立，相关 | 保留 |
| 16 `combination-inspection` | Combination inspection: three technologies on one line | `a7702883-58a2-401f-8222-eeb1b86bf88a` / `packaging-line` | 包装输送线场景；同 17、20；未直接展示组合设备 | 复用真实照片 |
| 17 `conveyors-and-reject-systems` | Conveyors and reject systems for inspection lines | `a7702883-58a2-401f-8222-eeb1b86bf88a` / `packaging-line` | 包装输送线场景；同 16、20；保留为输送线主题的一张，非具体剔除结构证明 | 保留 |
| 18 `preparing-a-product-sample` | Preparing a product sample for inspection testing | `30a9a1f1-7a92-45b7-9092-b624ac42a757` / `loose-material` | 散料/粉末静物；相关性弱：正文强调最终包装中的代表性样品，封面未体现 | 生成替换 |
| 19 `inspection-sensitivity-and-product-effect` | Understanding inspection sensitivity and product effect | `dfc39fd9-aac6-456a-87b4-48802e318599` / `powder-materials` | 粉末材料静物；同 21；材料属性与 product effect 相关，非检测效果证明 | 保留 |
| 20 `fitting-inspection-into-a-line` | Fitting inspection equipment into an existing line | `a7702883-58a2-401f-8222-eeb1b86bf88a` / `packaging-line` | 包装输送线场景；同 16、17；安装空间与接口规划表达不足 | 生成替换 |
| 21 `what-to-prepare-for-a-quotation` | What to prepare before requesting an inspection quotation | `dfc39fd9-aac6-456a-87b4-48802e318599` / `powder-materials` | 粉末材料静物；同 19；与准备包装、尺寸和项目资料的主题联系较弱 | 生成替换 |

### 判断与已交付素材

- 重复三组：12/13，16/17/20，19/21。重复本身不是造假，但降低列表辨识度。
- 无证据认定真实X-ray设备照片是无关设备；保留12、14、15的真实图。19材料图、17输送线图与文章有关，保留各一张。
- 21报价准备、20安装规划、18最终包装样品的表达不足，补3张独立场景静物图；不借用其他行业图片、不生造机器性能。
- 13使用已有XR-300D真实食品X-ray设备图作为示例，配注明确不是两技术测试对照；16使用真实金属检测+称重组合图，并修正“三技术”绝对标题。
- 不因“像通用素材”就认定低质；当前照片清晰度与真实Directus原文件需DSH核对，不凭UUID判模糊。

| 新文件/复用文件 | 交付规格与用途 |
|---|---|
| `blog-images/insights-what-to-prepare-for-a-quotation.webp` | 1600×900；食品包装、卡尺、空白项目资料静物；替换21 |
| `blog-images/insights-fitting-inspection-into-a-line.webp` | 1600×900；独立输送段、测量工具与留空规划纸；替换20 |
| `blog-images/insights-preparing-a-product-sample.webp` | 1600×900；最终包装中的不同食品样品、托盘与空白标签；替换18 |
| `blog-images/real-xr-300d-source.png` | 已有Wix真实来源照片，保持原分辨率、不伪造高清；优先复用现有文件UUID `8667aa78-3555-475f-9ace-bfcae53e37bf`，替换13 |
| `blog-images/real-metal-detector-checkweigher-combo.webp` | 已有真实组合设备图，保持原分辨率；优先核验并复用UUID `77add968-6cc5-4982-a37c-2cad080b1757`，替换16 |

三张新图是AI生成的编辑配图，不是工厂、员工、客户案例或测试现场证据；图注应说明用途。无参数/认证/品牌口号，不作为产品主图。实际尺寸和SHA256见素材清单，整页预览见 `evidence/new-covers.jpg`。

### 给 DSH 的逐条操作

以 `03-BLOG-COVER-MAP.csv` 为唯一替换表，包含10篇post ID、真实slug、旧UUID、逻辑别名、新路径、复用UUID、alt、fit、caption；不使用任务书中举例但并不存在的长slug。

1. 只在授权的本地/测试Directus操作。先导出每篇 `id/slug/status/cover_image/seo_og_image/updated_at` 与目标文件元数据，作为本轮可回退清单；读取当前记录确认未被别人改动。
2. 12/14/15/17/19保持原封面。13/16先GET映射中的复用文件与实际缩略图；确认对应设备、is_public=true、未归档及引用关系。身份/图片不符时停该条，记录证据，继续其他条。
3. 对18/20/21分别上传相应1600×900 WebP；记录返回的新UUID。**先设置新文件公开资格并确认未归档/代理200，再PATCH posts的cover_image。** 不把上传成功当作前台可见。
4. 按post ID及slug匹配PATCH `cover_image`；不要改slug、正文、发布日期或发布状态。16标题修改作为独立文案修正并记录前值。
5. `seo_og_image`若原本指向旧封面且仅是自动跟随意图，按同一新图更新；若为独立编辑选择则保留，记录选择。前端优先级为专用OG→封面→站点fallback。
6. 逐篇验证 `/api/cms/posts/<slug>` **顶层** `coverImageUrl`，不要读取不存在的`post.coverImageUrl`；再验列表 `/api/cms/posts?type=insight&limit=100`（以实际参数契约为准）。允许合法 `?v=2` 等版本参数。
7. 浏览器检查列表、详情、OG各一个真实请求/图片；机器contain完整显示，场景可cover；10篇最后应有10个不同封面身份。桌面和390px对照图片，不需逐像素精审。
8. **禁止按旧任务书无条件把旧文件设为is_public=false。** 旧图可能仍被其他文章、产品、gallery或OG引用；未完成引用审计前保持原状态、不删除、不归档。即使本次不再引用，也可保留公开，清理另做。
9. 回退只PATCH受影响post的原cover/OG/标题，不覆盖期间别人修改的正文；恢复后复验列表与详情。素材留在媒体库不影响回退。

## D. SEO 与 Alt

### 现状确认

| 项 | 本轮结论 |
|---|---|
| robots | **存在**：`server/routes/robots.txt.ts`，本地GET200 text/plain。没有public/robots.txt不等于缺失；不要再建同路径静态文件造成双来源 |
| sitemap | 动态路由存在；当前快照模型输出23条。29产品因noindex被正确排除，但5个可索引分类+Blog列表与10详情未纳入，缺16条 |
| JSON-LD | 使用点是模板，不是“只有3个实际URL”：首页Organization/WebSite，产品模板Product/Breadcrumb，FAQ模板FAQPage已存在；当前29产品noindex所以不输出结构化数据，符合useSeoHead门槛 |
| canonical/hreflang | 已有统一工具；noindex页面主动不输出canonical/hreflang，不判成29条canonical故障；3个support请求页只useHead，缺统一SEO元数据 |
| OG/Twitter | 基础工具存在；Insights没有传自己的cover/seo.ogImage，仍用首页fallback；需要接上文章数据 |
| 图片alt | 57处img；16个空alt、41个非空/绑定表达式；绑定不保证实际运行值始终非空。逐项表见04 |
| H1 | 本次76个地址每个均1个H1，包括404页；没有据此虚构“全站H1混乱” |
| 404 | `error.vue`及兜底页面存在，未知英文URL返回404；不需新建404模板 |
| 标题长度 | 60/160不是硬标准；长标题可能截断，不因字符数直接列故障；所测title均未超60字符，8条description超160字符仅列编辑提醒。完整title/description表供编辑参考 |

### 缺口与修法

| ID/优先级 | 位置/事实 | 具体动作 | 估计h |
|---|---|---|---|
| D01 P1 | `server/utils/sitemap.ts:43,77` 没有输出分类URL，也没查询legacy Insights | 增加5个published且seo_noindex!=true的分类URL；增加Blog列表及10篇published insight；若新增posts noindex门槛则跟页面一致；不把草稿/无对应路由类型塞进sitemap；最终URL去重 | 2–3 |
| D02 发布决定 | 快照29个published产品均seo_noindex=true | 预览阶段保留；正式SEO首发前由业主/编辑确认哪些产品可索引，再逐条更改。不能在审查或脚本中一键全部关闭；改后检验robots meta、canonical、Product/Breadcrumb及sitemap共同变化 | 1–2核验，另需内容决定 |
| D03 P2 | `/products`与`/products/checkweighers`同title；`/resources`与`/resources/insights`同title/description；3支持请求页缺description/canonical | 称重页使用真实category.seo/title，Blog给专属title/description，3支持页统一useSeoHead；表单是否可索引明确决定，不误用其他页canonical | 1–2 |
| D04 P2 | Insights未传ogType、文章图与BlogPosting，已返回的seo字段未用 | 优先真实seo标题/描述，缺值回落现有title/excerpt；ogType=article；OG→cover→fallback；BlogPosting用真实headline/publish_date/author=LITUBO Team/image；不捏造dateModified | 1–2 |
| D05 P2 | 独立内容图片的空alt | 按04表补实际描述；图标/背景/已同链接命名的装饰图保持空，不机械把16处全填满 | 0.5–1 |
| D06 P2 | 公司/联系页没有页级schema | 复用现有Organization事实实体，加稳定@id；ContactPage/AboutPage引用；面包屑可复用已有builder。增益小于错误状态/内容，不阻塞初稿 | 1–2 |

**不做**：伪造offers、评分、认证、成立年份、客户案例；不承诺加schema一定获得Google富结果或排名。FAQ有效schema不代表商业站一定有FAQ富结果。

### robots 最终内容

生产主域沿用当前配置默认 `https://litubo.com`；是否改为www域需要业主确认并与canonical/sitemap/重定向统一，不凭任务书示例擅改。

```text
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Sitemap: https://litubo.com/sitemap.xml
```

这是现有动态路由的拟定输出，不是要求另建public文件。`/admin`的防护靠认证，不靠robots。不额外用robots屏蔽未发布语言；让有意404被正常识别即可。若发布公开预览域，另用预览访问控制/noindex规则，与生产Allow策略分开；不在本轮改部署。

### 16个空Alt逐项判断

| 位置 | 判断 | 文案/理由 |
|---|---|---|
| `pages/admin/media/index.vue:1902` | 保持空 | 相邻HTML已命名同一入口/文件，或纯背景/图标；无新增独有信息 |
| `pages/admin/media/index.vue:1952` | 建议补文件名 | selectedFile.title || selectedFile.filename_download || "Media preview"；这是管理端预览，不是SEO阻塞项 |
| `pages/applications/[slug].vue:191` | 补描述 | `${item.title} equipment example`；若有已核实型号用真实产品名 |
| `pages/applications/index.vue:50` | 保持空 | 相邻HTML已命名同一入口/文件，或纯背景/图标；无新增独有信息 |
| `pages/index.vue:293` | 保持空 | 相邻HTML已命名同一入口/文件，或纯背景/图标；无新增独有信息 |
| `pages/products/checkweighers.vue:238` | 建议补描述（设备图） | loc(p.name)；与标题重复并不自动构成无障碍失败 |
| `pages/resources/downloads.vue:95` | 补描述 | Online checkweigher shown as an equipment example |
| `pages/resources/insights/[slug].vue:55` | 补描述 | 按03映射的 alt_en；不得把图片写成真实安装或测试结果 |
| `pages/resources/insights/index.vue:92` | 保持空 | 相邻HTML已命名同一入口/文件，或纯背景/图标；无新增独有信息 |
| `pages/resources/insights/index.vue:113` | 保持空 | 相邻HTML已命名同一入口/文件，或纯背景/图标；无新增独有信息 |
| `components/admin/content/ContentSeoLocales.vue:570` | 保持空 | 相邻HTML已命名同一入口/文件，或纯背景/图标；无新增独有信息 |
| `components/admin/content/ContentSeoLocales.vue:614` | 保持空 | 相邻HTML已命名同一入口/文件，或纯背景/图标；无新增独有信息 |
| `components/admin/media/MediaLibraryPicker.vue:238` | 保持空 | 相邻HTML已命名同一入口/文件，或纯背景/图标；无新增独有信息 |
| `components/global/CategoryStrip.vue:59` | 保持空 | 相邻HTML已命名同一入口/文件，或纯背景/图标；无新增独有信息 |
| `components/global/MegaMenu.vue:86` | 保持空 | 相邻HTML已命名同一入口/文件，或纯背景/图标；无新增独有信息 |
| `components/ui/ApplicationIcon.vue:31` | 保持空 | 相邻HTML已命名同一入口/文件，或纯背景/图标；无新增独有信息 |

分类图标、应用插画和同链接文章缩略图旁已有真实HTML标题，空alt可避免重复朗读；不把每个空alt报为SEO缺陷。设备内容图按任务书补描述；管理端缩略图不是搜索引擎收录问题。正文body中的图片还需用实际公开HTML检查，不能只以Vue模板57个img推断整站最终图片数。

## E. 建议下一步

1. **先修主链路**：A01/A02/A03/A04；故障不伪装404/空列表，无效询盘不入库，保留人工咨询入口。
2. **补内容与配图**：按03十篇映射落实5篇替换（3新图+2复用），修正post16与敏感绝对表述；A05资料上下文、已知series上下文一起收尾。
3. **做获客SEO收尾**：D01/D03/D04与alt；29产品indexability列成业主选择项，预览状态不自动公开索引。
4. **做一次适度验收**：代表性手机/桌面、搜索键盘、一个有效和一个失败重试表单；回归相关测试并更新过期断言。后台实际权限/媒体资格/编辑路径由DSH原环境给证据。
5. **再接AI增量**：先内部摘要，复用已有受限助手；配置预算/隐私/转人工后再请业主决定公开开关。上线、域名切换、Wix迁移另行授权。

交给DSH时先读 `02-DSH-EXECUTION-INSTRUCTIONS.md`，再按报告A/B/C/D和CSV执行。不要把本报告当成“网站已经可上线”的证明。
