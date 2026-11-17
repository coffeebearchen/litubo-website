# LITUBO 后端设计报告 · DSH思路V2

Plan ID：`BACKEND-DSH-V2-0e6e98d`。
仓库：`coffeebearchen/litubo-website`；分支：`work/c-refined-v1`；基线：`0e6e98dc3c0676137e6b8531aca524aa5d962b9b`。
日期：2026-11-17。本报告替代前一版后端设计用于本次施工；前一版暂不采用。

## 摘要（5行）

三个主要断点：称重系列设置未完整保存、首页CMS图未真正显示、当前Blog没有对应的posts管理入口。
三个改造动作：先修字段链路，再合并日常编辑/增加色区，最后接Hero与人工确认的AI摘要。
沿用原表、原认证、原产品发布保护；Hero使用现有site_content单行模型，不建万能CMS或双草稿记录。
文章明确分工：当前网站Blog/FAQ管理posts；Content Center保留高级结构化资料/案例/原AI功能，本轮不迁表、不增加双源详情。
拟新增字段仅posts.cover_fit；其他改动以小页面、增量接口、可回退的小提交为主；运行库若缺必要唯一约束，单列差异核实，不假定存在。

## 依据与可验证范围

已完整阅读业主附上的DSH指令，并核对指定提交。`c963115..0e6e98d`之间只增加`docs/project/CODEX-BACKEND-BRIEF-plain.txt`，业务代码未变。因此复用已核实的字段事实以节约工作量，**设计取舍、UI及施工顺序按本包V2重新编写**。

目标代码有66个Vue页面文件，其中30个非后台模板、36个Admin模板；不是66个独立前台页面。Admin接口文件100个。Workspace实际7页，附件写6页是旧口径。六份schema合计162列：34/46/29/21/24/8，与附件集合数量一致。

333个业务源文件已与指定commit的Git blob逐一核对（evidence/SOURCE-VERIFICATION-V2.json）。本轮只读源码与内容/schema快照，没有读取.env、客户询盘、生产数据或调用真实模型。不能独立证明“询盘AI字段全部为空”、实际权限、媒体真实公开资格或DeepSeek现时可用；这些由DSH在原环境核实，不转移私人记录到公开仓库。

## A. 前后端是否对应

### 逐页对照与字段账本

`02-PAGE-CORRESPONDENCE-V2.csv`按66个页面文件逐行给出：页面、渲染字段、接口、Directus列、对应状态和V2动作。动态页覆盖其同模板产品/行业/文章，不把模板文件数当交付URL数。

`03-SCHEMA-FACTS-V2.csv`完整列出六表162个字段的真实type/nullable/interface。导出中的nullable是顶层字段；没有导出的默认值、索引、外键、policy及部分子表约束，不能猜。

| 编号 | 位置/字段 | 事实 | V2修正 | 迁移 |
|---|---|---|---|---|
| V2-M01 | 产品编辑checkweigher_series/configuration/l_series | BasicForm可选；PATCH接口支持，但页面save payload漏发 | 改前端发送值；校验enum与true/false/null；保存后重读 | 无 |
| V2-M02 | 新建产品同3字段 | 页面发送form，POST白名单却忽略 | 后端补现有列的白名单/校验，仍只创建draft | 无 |
| V2-M03 | 空product_code首次填写 | 控件有，编辑save没有发送 | 当前为空时才发送；已设编码仍锁定 | 无 |
| V2-M04 | 首页hero.imageUrl | /api/cms/home返回site_content.hero_image，模板却只显示showroom产品图 | 有效CMS图优先，否则保留当前showroom；换图后不要沿用旧型号标签 | 无 |
| V2-M05 | Hero图后台编辑 | home-content GET包含hero_image，PATCH白名单无该列 | 新Page Content管理页接通图片读写；原API不暗改语义 | 无 |
| V2-M06 | Blog与Content Center | 当前10篇读posts；Content Center编辑另一个模型 | 加posts管理；结构化资料标清用途；不双写/不迁表 | 无 |
| V2-M07 | posts封面fit | 前端CONTAIN_SLUGS，换图后后台不能调整 | 可空cover_fit；迁完前继续兼容旧清单 | 只新增1列 |
| V2-M08 | 联系信息 | 页脚读site_settings，Contact侧栏写死 | 共享现有站点联系方式来源 | 无 |
| V2-M09 | 主图来源 | 公共页优先products_files中hero角色；部分后台只看products.hero_image | 管理端预览用同一主图选择规则 | 无 |
| V2-M10 | 询盘7个AI字段 | schema有，server/pages/types/components无引用 | 先做摘要/意图、人工确认；其他保留备用 | 无新列 |
| V2-M11 | document深链 | 父级读了参数，但未传实际表单 | 传给既有SupportRequestForm，保留文档类型前缀 | 无 |
| V2-M12 | Company/Support/Resources文案 | 很多文字来自代码/i18n | Hero可编辑；字段标签、校验、固定流程及长文不全迁 | 无新模型 |

### 五类“不对应”的结论

- **前端有、后端无**：cover_fit是合理的编辑属性，值得一列；固定图标、五系列枚举和表单规则不一定需要数据库字段。
- **后端有、前端没用**：7个AI列、部分Hero图是真缺口；posts.topics已经返回/可过滤，但Blog不展示可以是首稿简化。faq_group已用于FAQ分组，不能再报未使用。
- **类型不一致**：公共DTO显式String(id)不是缺陷；Admin保留number ID也合理。nullable boolean不能变成字符串再用Boolean("false")；三个称重字段按现有enum/null验证。
- **可空未兜底**：图为空用品牌占位、文本空回批准默认、日期空不显示、不制造假作者/型号。子表schema没提供时标未验证，不因为备份缺子表就说线上没有规格。
- **文案硬编码**：首先迁Hero与真实联系信息。把所有正文/标签/路由迁入CMS会提高维护成本，本轮不做。

### 该迁与不该迁

| 内容 | 本轮位置 | 理由 |
|---|---|---|
| Hero标题/介绍/图片/主要CTA | site_content现有列 | 运营经常改，适合管理和预览 |
| 分类名/简介/分类图 | product_categories | 已有模型，不在site_content复制 |
| Blog/网站FAQ | posts | 直接管理当前真实内容 |
| 公司邮箱/电话/地址/WhatsApp | site_settings | 单一来源，避免每页各存一份 |
| 系列枚举/说明默认值/图标/布局 | 共享代码配置 | 五系列稳定；型号归属读products三列 |
| 表单字段与校验、inquiry_type、寄样确认提示 | 原组件/原合同 | 避免运营改坏业务链路 |
| Company审定长文、行业正文 | 本轮保留代码 | 不为Hero管理扩成整站重写 |
| SEO/法律文案 | 原SEO字段/法律审定流程 | Hero标题不自动覆盖SEO，AI不改法律结论 |

## B. 后台重新设计

### 1. 一个日常产品编辑器，独有工具继续保留

主路径继续`/admin/products/:id`及content/specs/media/faq/seo/preview。它保留基础信息、原状态机、SEO、FAQ和预览能力；把Workspace成熟的编辑组件放进对应页，不复制API或数据。

| 现有Workspace页 | V2处理 |
|---|---|
| overview | 临时跳转到/admin/products/:id，不把只读Overview当完整编辑器 |
| page-content | 日常编辑进入/admin/products/:id/content |
| specifications | 进入/admin/products/:id/specs |
| media-resources | 进入/admin/products/:id/media |
| sources-evidence | 保留原URL和独有功能，主编辑器给明确入口 |
| ai-source-intake | 保留原URL/生成流程 |
| ai-proposal-review | 保留原URL/逐项审查与Apply到草稿流程 |

**不另建三套来源/AI规范URL，不删旧文件。** 4个日常重复页做可撤销跳转；3个独有工具页继续用。全局Products激活状态同时识别工具页路径；从工具页可返回同一产品，避免迷路。

必须逐项保留：模块与条目/排序、参数组与说明、媒体角色/alt/启用/焦点、FAQ、SEO、预览、来源证据、AI审查、发布状态和软归档保护。产品仍按现有Draft-only内容写入、Review/Published保护，不能为“保存方便”放宽。

### 2. 当前Blog统一在posts管理；高级内容明确分工

新增**一个`/admin/posts`页面**，列表和选中记录编辑共用页面，可用query定位id；Blog & FAQ两个筛选标签，不新增标签表。

- 当前Blog、网站FAQ和legacy技术指南读写posts，直接改现有记录。
- Content Center保留完整结构化资料、案例、AI来源/提案、快照、历史。入口移入Content下的Advanced tools，标注“Structured content; not the current Blog editor”。不是删除系统。
- **本轮不将Content Center技术文章接入Blog详情，也不把10篇Blog迁过去。** `/resources/insights/:slug`继续只读posts，英文URL不变。
- 资源总览/搜索或sitemap若从Content Center技术文章生成了该前缀的无对应条目，停止这类错误导流；Case Study已有真实详情读取，保留。
- 在高级技术文章发布/预览区明确：快照发布不等于当前Blog上线；禁用无真实落点的“查看网站Blog”链接并说明原因，不改其既有编辑/快照/AI API。
- DSH先只读核对真实CC公开依赖，不自动修改已有记录或URL。若发现合法的独立公开依赖，先保留该依赖、记录单独问题；不要用新双源详情或批量迁表偷偷解决。

因此本轮达到的是**日常Blog单一编辑来源+高级资料清楚分工**，不是“所有内容物理合并到posts”。以后若要合并模型，另立迁移任务。

### 3. 颜色导航与页面数量

沿用现有Admin外壳、260px侧栏、18px正文/16px导航/28px标题；不修改前台22px字体、菜单和方案C视觉。

| 分区 | 色值/浅底 | 入口 |
|---|---|---|
| Content | #2F6B3A / #EEF5EF | Products、Blog & FAQ、Page Content；Advanced tools折叠保留Structured Content |
| Customers | #2563A6 / #EDF4FC | Inquiries、Visitors |
| Assets | #945A20 / #FFF4E8 | Media Library（含文件/文件夹） |
| System | #52606D / #F0F2F4 | Settings、原账号/退出 |
| AI assistance | #7250A2 / #F4F0FA | 当前产品/内容/询盘中的AI入口与待审面板 |

颜色用于小边条、图标、浅底和文字标签，不做整屏彩色背景；每区都有文字和图标。红色#B42318仅用于错误/低证据，需要原因文字，不以红绿区分为唯一依据。

**页面口径**：保留原36路由文件，新增posts单页、page-content单页，共38。4个Workspace页改兼容跳转，加已有2个跳转，共6个跳转，约32个非跳转页面模板（动态模板可有多条实际URL）。没有靠删除功能虚减页数；也没有上版43个路由的额外扩张。常用一级入口7个，Structured Content作为第8个高级入口保留。

### 4. 新UI交付

| UI编号 | 用途 |
|---|---|
| UI-01 Page Content | 页面清单、默认/草稿/公开状态、当前来源，一眼知道改哪页 |
| UI-02 Hero Editor | 单行编辑、清楚区分本地预览和发布，不伪装持久双草稿 |
| UI-03 Product Editor | 一个日常编辑器、分类字段可保存、独有来源/AI工具保留 |
| UI-04 Blog & FAQ | 直接管理posts，记录来源标识明确 |
| UI-05 Inquiry AI | 原始询盘与候选摘要并排，人工确认/丢弃，低证据有原因 |

UI均为新制作的V2设计参考，不是数据库运行截图。精确尺寸/颜色/响应式见08；DSH必须视觉对照，而非只读文字后自行重画。

## C. Hero和内容由后台管理

### 1. 复用已有24列，不新增同义字段

site_content已经有content_key/page_key/section_key/status/hero_image/eyebrow_en/title_en/body_en及CTA列。直接复用，**不新增hero_title_*、hero_intro_*、hero_fit/hero_alt_*，不加draft_payload，不建*.draft工作记录**。

| 编辑项 | 存储/处理 |
|---|---|
| 页面身份 | 服务端固定registry映射content_key/page_key/section_key；运营不可任填键 |
| 标题与介绍 | title_en、body_en；eyebrow用现有列 |
| 图片 | hero_image UUID；复用现有媒体库/公开资格检查 |
| 图片描述 | 已核实的directus_files.title优先，再回批准默认alt；装饰背景按组件用空alt |
| 裁切 | 由页面固定布局配置控制；设备图contain，不为所有Hero再加一列fit |
| 按钮 | 既有CTA标签/path，服务器拒绝外部/协议相对等不安全路径 |
| 多语言 | 现有title/body的历史语言列原样保留；本轮只接英文，不把_pt当阿语，不扩语言上线 |

媒体标题是共享元数据，修改前提醒会影响所有引用；不自动把页面标题写成所有图片的标题。

### 2. 单行模型的真实保存规则

**未发布/新记录**：可Save draft（status=draft）→本地预览→人工Publish（status=published）。公共页仍用当前默认。

**已发布记录**：在浏览器表单编辑和实时预览，**不自动写数据库**；点击并确认“Publish changes”才一次写回该行。UI明确“修改暂存在本页，刷新会丢失未发布修改”，不假装已有持久的线上/草稿双版本。

如果用户明确撤回覆盖，保留既有status能力，但必须提示“公开页会回到批准默认内容”；不能把退draft说成旧公开覆盖仍保持不变。一期不增加发布快照或版本模型，换取改动小和回退直接。

产品仍遵守它原有严格Draft-only状态机；posts/site_content按各自现有单行模型设计人工发布，不能借Hero编辑器去绕过产品保护。

### 3. 回退和预览

- 未配记录/未发布/空值：回当前批准默认文字/图或品牌占位，不能让页面空白。
- CMS不可达：显示默认，后台标明正在用默认；不声称最新修改已生效。
- 图未公开/已归档/资格失败：不输出私有UUID/原Directus地址，回安全默认。
- 预览用同一Hero组件注入本地表单值；不开放公共?draft=true；草稿图片只在管理员代理中预览。
- 首页使用有效CMS图后，不继续写原showroom型号caption；无CMS图才沿用当前产品示例。
- 无图时保留原结构。Support配置图片后使用可选图位，原准备信息卡移到现有帮助区，不删内容、不挤成三列；手机图在介绍后，设备主体不裁切。
- 每次公开修改前备份该记录旧字段；回退仅恢复该记录允许字段，不恢复整表、不覆盖别人后续编辑。

### 4. 首批范围与后台位置

首批**13个Hero页面**：首页1、Company4、Support请求页5、Resources3（overview/downloads/videos）。Support总览、8行业深层正文、Contact等先保留当前默认，不扩大一期。

新增一个`/admin/page-content`页面，按Home/Company/Support/Resources分类，选中页就在同页编辑/预览。Home保留现有9个块，原key不改；新页例如company.about.hero。page_key/hero_image已有，不需要为每页建collection。

产品分类名/简介/图片仍存product_categories，在同页加Product categories小tab编辑已有5条，不复制到site_content；产品详情图片仍归products/products_files。

Settings原首页内容区改为清楚的链接入口，避免两个UI重复编辑。**原home-content GET/PATCH仍保留原有含义**，不暗改成“保存到另一草稿行”、不增加requiresPublish来假装兼容；新Page Content动作明确标出是否影响公开内容。

### 5. 唯一拟新增数据库字段

`posts.cover_fit`：string nullable，只允许contain/cover。初始从当前5篇设备图清单填对应值，其余已确认场景cover；未知记录保持null，沿用旧清单兼容。API增加可选coverFit，老页面字段不删除。

封面alt优先现有媒体标题/批准默认，不新增posts.cover_alt_en。旧文件公开资格不随换封面自动关闭，引用保护继续有效。

## D. AI协助人工

### 现状核实

- 7个询盘AI列存在，但当前server/前端/DTO没有读写；是否真的全空不能在不读客户记录的本轮证明。
- Product/Content Center已有来源选择、生成、逐项审核、Apply代码，不是空壳；真实key/运行状态未验证。
- 现有Product AI Apply生产开关、草稿限制和来源校验全部保留，不因换UI顺手开启。

### 一期优先级

1. **询盘摘要+意图+缺项提示**，供销售人工确认。先把这项完整做通。
2. 图片alt能按真实名称模板生成就用规则，必要时AI候选、人确认；不为少量图启动大工程。
3. 内容摘要复用既有来源/提案流程，放后面做；参数/认证/交期没有资料就不生成。
4. 字段缺口检查先用确定性规则，AI只解释差异，不给数据库改写权。

### 七字段用途

| 字段 | 用途 | 谁写/谁读 |
|---|---|---|
| ai_summary | 已确认的询盘摘要，不替换message | Confirm服务端写，销售读 |
| ai_intent | 意图候选，不自动改inquiry_type/负责人 | 人确认后写，销售读 |
| ai_recommended_products | 一期保留不填，后续只从真实已发布产品中选 | 本期不写 |
| ai_draft_reply | 一期不做自动回复；未来也只是内部草稿 | 本期不写，不连接发送 |
| ai_confidence | 未校准保持null/Not assessed；不伪造正确率 | 有依据时服务端写；低证据用红色+文字提醒 |
| ai_processed_at | 结果生成时间，服务端产生，确认时保存 | 服务端写，销售看时点 |
| ai_reviewed | 人工确认已保存结果的标记 | 只有Confirm可设true；不是参数验证保证 |

**不新增ai_review_meta、审核表或永久提案历史。** 一期只承诺人工确认标记，不宣称有完整不可篡改审计。若现有Directus activity/revisions已启用，可利用；是否启用需要DSH核实，不能当成已证实。

### 人工确认与丢弃

Generate读取当前记录，最少必要文本脱敏后发已有DeepSeek，返回绑定当前管理员/询盘/原文摘要指纹的临时候选，不写询盘。逐项Accept后，Confirm重新核对原文未变，只保存被确认的AI字段及ai_reviewed=true；Discard仅丢弃候选，原文和原AI记录均不清空。

候选与已有确认记录分开；重新Generate不先改旧ai_reviewed。已有原文若被技术管理员在Studio改动，需重新生成/清除确认；一期没有持久版本追踪，不虚报其能力。

低证据显示“Needs human review”与缺项，例如未提供包装信息，不编一个90%分数。模型故障、过期提案、资料不足可重试/丢弃，不能影响普通询盘状态/备注编辑。

不自动发布、不自动回复、不自动分配给服务商、不猜参数/精度/认证/交期；不引入新付费服务，现有模型API仍有用量费用，预算由业主既有设置/决策控制。

## E. 本轮不做

不重写技术栈/认证/数据库模型；不迁全部正文；不物理合并posts与Content Center；不新增CC详情双源读取；不改英文公共URL；不扩语言；不建新的AI审核数据模型；不做假视频/假证书/假指标。

不删除旧产品功能、来源证据、AI审查、媒体引用保护和软归档；不把所有侧栏换成不可用的Overview；不把新增设计图当成实现截图。

Codex只做方案与UI，不修改业务代码。DSH按本包和已有开发授权实施；上线、DNS/Wix、对客户外发不在本包授权内。

## F. 实施顺序、回退与验收

顺序：V2-00核对→V2-01字段闭环→V2-02导航/产品入口→V2-03 Blog→V2-04 Hero两页试点再13页→V2-05分类图/cover_fit→V2-06内部AI→V2-07验收。各项工时、依赖、验收和回退在05队列表，估计不是固定报价或进度承诺。

每批小提交，旧路由/组件先不删；回退为撤销该批UI/读取路径、恢复该条变更前字段。新增cover_fit回退时保留空列、不DROP；旧清单仍可用。先在隔离环境演练并记录≤5分钟，再放行该批；无法达到就拆小，不宣称天然保证。

最低验收：字段新建/编辑/刷新、产品状态保护、4个兼容跳转/3个独有工具、posts列表详情同源、Hero预览零写/发布才变、私有图不公开、AI候选未审不写/丢弃不清原文。1440与390对照V2图，一次相关测试/typecheck/必要build即可，不重复无限全站精检。

交付结果标为“可审查/待业务确认”，不能因截图看起来完整就宣称生产可上线。DSH应回报任务ID、提交、schema/API变化、代表证据、回退耗时及待确认项，持续推进不依赖阻塞项的工作。
