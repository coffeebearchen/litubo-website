# 给DSH的完整施工指令 · V2唯一版本

Plan ID：`BACKEND-DSH-V2-0e6e98d`。日期：2026-11-17。

## 0. 入口、授权和基线

本次按业主新上传的DSH思路重新设计，前一版暂不采用。唯一设计包：
https://drive.google.com/drive/folders/1HROQkTEOH6pavE58VNXwizmI7AOiw3_p

把整个包下载到仓库外的独立目录，例如`handoff/BACKEND-DSH-V2-0e6e98d/`，不要覆盖旧包。先核对CURRENT-PLAN.json。完整阅读00原始指令、01报告A–F、08 UI规范、09验收和10 API规格；打开ui/五组PNG及对应HTML，再读02–06表格。不得跳读；若某项与旧包不同，以本V2为准。

仓库`coffeebearchen/litubo-website`，分支`work/c-refined-v1`，设计基线`0e6e98dc3c0676137e6b8531aca524aa5d962b9b`。先读仓库AGENTS.md，检查工作区、分支、最新提交、未提交改动。不要reset或覆盖他人工作；后续提交已修复的项目直接记录证据、跳过重复修复。先前已有开发授权内可以连续施工；本包不授权发布、合并、改DNS/Wix、对客户外发或自动启用生产AI。

Codex本轮交的是设计与契约建议，不是实现；新增API在施工前需与真实API白名单、认证、权限和schema再核对。只检查配置是否存在，不输出.env、token、客户原文或生产截图中的个人信息。缺资料/真实环境依赖标记为待确认，同时继续不依赖该项的工作。

## 1. V2-00：先建立小而真实的施工账本

核对六份schema快照与DSH实际测试库；只报告结构差异，不假定导出没写的索引/权限不存在。核对现有产品编辑7个日常页、Workspace7个工具页、Blog真实来源posts、Content Center公开依赖。区分“源码有”“本地已测”“真实服务已联调”。输出docs/project/BACKEND-DSH-V2-STATE.md：每项任务状态、修改文件、schema/API变化、验证、回退方式、需业主确认项。

## 2. V2-01：先修现有字段链路，不改模型

修产品编辑payload漏发的checkweigher_series/configuration/l_series，以及空product_code首次设置；后端POST补已有3列白名单和枚举校验。保留已有编码只读与Draft-only规则，不放宽Published写入。验证false和null不被字符串转成true。前台/后台主图统一沿用当前公共产品hero角色优先规则，不另建主图字段。

Contact联系方式复用site_settings；文档请求深链参数传入真正的SupportRequestForm，不能只在父页读取。每项按02表检查新建/编辑/刷新和公共DTO，不把String(id)当类型bug。

## 3. V2-02：颜色导航与一个日常产品编辑器

按UI-01/03和08规范调整现有Admin外壳。一级入口7个，Structured Content放Advanced tools；内容绿、客户蓝、素材低饱和琥珀、设置灰、AI紫，必须有文字标签与图标。沿用认证和现有角色。

主编辑器仍是/admin/products/:id的base/content/specs/media/faq/seo/preview。吸收Workspace成熟组件，不重写相同API。四个重复路径overview/page-content/specifications/media-resources分别replace跳到base/content/specs/media；来源sources-evidence、ai-source-intake、ai-proposal-review三个原工具路径完整保留，可返回该产品，侧栏仍高亮Products。

不要删除旧文件或丢失SEO、FAQ、预览、媒体角色/焦点/排序/启用、来源证据、AI逐项审查/Apply功能。对照04路线表逐条点开。保留原发布保护、引用保护、软归档和产品AI生产开关。

## 4. V2-03：管理当前Blog，明确高级内容分工

只新增一个/admin/posts页面（query选中记录），Blog/FAQ筛选，共用实际posts数据与原英文slug。列表、详情、编辑后重读都同源。不要把posts和Content Center迁表、双写，不增加CC到Blog详情的fallback reader。

Content Center保留编辑、案例、AI、快照、历史，入口标为Structured Content（高级）。核对资源总览/搜索/sitemap是否把CC-only technical_article错误导向posts详情；停止这种无真实落点的导流，保留真实Case Study路线。高级技术文章标注“当前Blog不读取此内容”，避免假“Visit Blog”按钮。未知合法依赖先保留并记录，不批量删内容、不擅改公开URL。

## 5. V2-04：Hero先两页试点，再扩13页

新增一个/admin/page-content页面，选页和编辑共页；不要每个页面一个后台路由。复用site_content现有列：content_key/page_key/section_key/status/hero_image/eyebrow/title/body/CTA。先首页、About试点，再扩Company4+Support请求5+Resources3，共13个Hero页面；Home保留原9块及key。

不加hero_title/hero_intro同义列，不加草稿JSON或*.draft双记录，不建新CMS。未发布行可存draft；已发布行的改动只存浏览器，Preview changes不写库，人工Publish changes才一次PATCH现有行。清楚提示刷新会丢失未发布编辑。撤回覆盖会回默认，必须如实提示。原home-content GET/PATCH含义保留，不暗改成保存草稿的接口。

公开读取只取published允许字段，缺行/空值/故障/不合格图回批准默认。首页CMS图真正优先并去掉不对应的showroom型号caption。预览使用真实Hero呈现组件和本地DTO，草稿媒体只走管理员代理，不用公开?draft=true。Support可选图位不得删除原帮助卡或挤成三列。图的alt复用已核实的媒体title/批准默认；设备主体contain。SEO不随Hero自动覆盖。

## 6. V2-05：仅一个新增字段与分类小tab

分类小tab读写现有product_categories，名字/简介/图片不复制到site_content。posts只加nullable string cover_fit，校验contain/cover；保留null兼容旧CONTAIN_SLUGS，先从已核实清单迁移，不批量猜测。原封面媒体公开资格、引用和归档保护继续有效；不新增cover_alt字段。迁移前导出受影响记录旧值与schema，回退不DROP该列。

## 7. V2-06：内部询盘AI，人确认后写现有七列

先做摘要+意图+缺项提示，保留普通询盘状态/备注工作。复用现有DeepSeek注册/provider/预算配置，不新建付费服务、不新增审核字段或表。

Generate只返回临时候选，绑定管理员、询盘、原文指纹，不写inquiries。Confirm重新校验候选归属、过期、原文未变和允许字段，一次保存已接受摘要/意图、服务端时间及ai_reviewed=true。Discard只丢候选，不清原文或已确认结果。新候选始终显示未审，不能沿用旧ai_reviewed=true作为新候选已确认。

ai_recommended_products、ai_draft_reply一期不填；无校准依据ai_confidence为null/Not assessed。低证据用红色+Needs human review+原因，不编90%分数。不得自动回复、发布、分配、生成参数/认证/交期。仅承诺人工确认标记，不声称完整版本审计；管理员若另外修改原文，须重新确认。

如现有provider未配置/调用失败，显示Unavailable并保留人工工作；费用预算/对外数据处理需按现有授权配置，不自行外发真实客户数据做测试。开发测试用合成询盘。

## 8. V2-07：严格视觉对照与有限验收

用1440px桌面、390px手机分别对照本包PNG与HTML；先主布局、信息层级、间距，再按钮/状态。不要只读说明后自由重画；HTML是原型，真实字段/权限/发布控件仍按本仓库契约。设计图里样例文案/状态/数据不写入生产。

验收按09：产品新建保存重读、4个跳转与3个保留工具、Blog同源、Hero预览零写/发布才变/空配置有默认、私图不可公开、AI未确认零写/丢弃不丢原文。运行与改动相关的检查和必要typecheck/build一次；出现新失败再修再测，不反复无关全站精检。

每批小提交，实际回退演练≤5分钟才放行下一批；达不到就拆小。只撤该批改动与该条记录旧值，不整表恢复、不删新列、不覆盖他人修改。输出实际截图和UI差异表，不能用本包设计PNG充当实现截图。

## 9. 交付回报

按V2-00→01→02→03→04→05→06→07推进，可独立项并行排队但不漏验收。回报任务ID/提交/改动/schema/API/截图/验证/回退耗时/未完成原因。别把“设计好、源码有、mock过、真实运行”混为一谈。把未配置服务、需真实业务确认、未授权上线分开列出；不中断不依赖它们的施工。

预计总量23–38小时（熟悉项目的开发者估算，未含外部等待），可分批交付；不作为固定工期承诺。第一交付优先字段闭环+统一入口+posts编辑，第二交付Hero，第三交付内部AI与收尾。整个本轮保持现有英文公开URL及Wix在线。
