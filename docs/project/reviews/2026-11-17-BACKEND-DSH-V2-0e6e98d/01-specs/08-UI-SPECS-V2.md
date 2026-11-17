# 后台UI规格 · 全新V2

Plan ID：BACKEND-DSH-V2-0e6e98d。五张桌面图+一张手机图均为设计参考，非线上截图；所有展示状态为示例，不代表真实数据。HTML可直接打开，内联CSS，无框架、无网络请求。

## 全局外壳

1440px画板；侧栏260px固定，主内容padding 32px，内容max-width 1280px。背景#F6F8F7、面板#FFFFFF、正文#20352B、次文#52665C、边框#DEE6E1。Admin正文18px/1.55，说明16px/1.5，表单label16px/600，h1 28px/1.2；不是把前台22px强套后台。系统字体，内容标题不装饰衬线。

侧栏区名12px/700、大写/字距1px；导航16px/500、44px最小高，图标18px。active浅底+4px边条+文字，不只靠颜色。分区：Content #2F6B3A/#EEF5EF；Customers #2563A6/#EDF4FC；Assets #945A20/#FFF4E8；System #52606D/#F0F2F4；AI #7250A2/#F4F0FA。危险/低证据#B42318/#FFF1EF，带原因文字。仅局部色块，禁止整屏彩色。

内容容器间24px，表单两列gap20px，行间24px；卡片padding24px、radius10px、border1px，无叠加厚阴影；浮层shadow 0 12px 32px rgba(20,45,30,.12)。输入最小高48px、radius6px、border1px #B9C8BF；textarea最小112px。按钮高46px、横padding18px、字16px/600；主色用当前区色，次按钮白底边框。focus-visible 3px solid #2563A6、offset3px；禁用态带说明。hover只换背景100ms；必要展开180ms ease，reduced-motion取消非必要过渡。

## UI-01 页面内容清单

位置/admin/page-content。顶部面包屑→标题与来源说明→Home/Company/Support/Resources tab→页面列表。表格列：Page、Editing scope、State、Action；不展示真实数量KPI。默认配置不是错误，不用红色；Published override / Draft / Using default同时有文字。选中后同页进入UI-02，用query page保留深链；不增一个[id]页。Home可选9个原块，Product categories小tab单独标原集合。

行高72px、头48px；page标题18px、meta14px、编辑范围16px。Action为44px点击区。窄屏每条变卡片，标签保留，禁止全屏表格横向溢出。

## UI-02 单行Hero编辑与预览

标题含页面名/公开状态；760px以上，编辑区与预览区约1.1:1、gap24px；宽度不够时预览折到表单下，不挤第三栏。预览可关闭，默认内容占满工作区。先放“这次修改会影响哪里”的单行说明，再标题/简介/图/CTA。图片框16:9，设备图contain；小提示注明alt来自现有媒体title、共享元数据不可乱改。

已发布示例：横向浅黄提示“Changes stay in this browser until you publish.”；按钮Preview changes / Publish changes。不出现Save draft按钮，避免暗示持久双版本。未发布时改为Save draft / Preview / Publish。下方给Withdraw override文字动作并解释回默认。预览上显示Local preview — not live，不给伪可公开草稿链接。

390px：顶栏56px（菜单+LITUBO Admin）、主padding16px；h1 24px、正文18px；表单单列、预览在下、按钮自然两行，不用遮住字段的底部固定条。最小点击区44px。

## UI-03 产品统一编辑

位置原/admin/products/:id。头部产品标题、code、状态；警示区域展示实际Draft-only限制。七个tab：Basics / Content / Specifications / Media / FAQ / SEO / Preview。tab溢出仅局部横滚、keyboard可达；保存主按钮与Discard changes同一操作区。系列字段在Checkweigher classification卡片中，按真实enum绑定，不在示例中预填型号归属。

来源证据/AI源/AI审查作为“Product tools”三个显式链接，保留原workspace URL。工具区AI入口紫色小标识，不虚构已生成数量。原发布状态控件和确认流程仍在，不以设计示例的Draft状态覆盖实际状态。

## UI-04 Blog与FAQ

位置/admin/posts。明确来源badge posts；Blog/FAQ标签；左记录列表约30%、右编辑约70%，窄屏先列表再编辑。编辑中封面、title、excerpt、body、status和SEO按现有列，cover_fit是唯一新增选项。选择设备产品图默认contain，场景图cover；null显示Existing default，不能强迫所有旧记录迁值。编辑正文允许原有安全富文本流程，不直接注入未清洗HTML。

高级Structured Content不在此编辑器伪装为同源：底部文本链接解释另一用途。示例文章标题取真实既有题名；正文提示不是上线素材，不生成假文章。

## UI-05 询盘AI

位置原询盘详情。主区左右约1:1；左侧原始询盘（只读原文+原状态备注入口），右侧按需AI建议。标题紫色标AI assistance；未确认候选标Unreviewed proposal。展示摘要、意图、缺项；缺项框红边+Needs human review+文字原因。无校准分数，confidence显示Not assessed。

操作Confirm selected / Discard proposal；下方固定文案No customer reply is sent. 修改原文或候选过期时禁止Confirm并给Regenerate。持久已确认结果单独标签Confirmed，新的临时候选不继承确认。图内样例只使用example.invalid、通用合成请求，不是真实客户。

## 视觉验收方法

同一画板1440/390、相同滚动位置，设计PNG与本地实际截图并排比：侧栏/主区对齐→层级与行距→按钮语义→空/错误/未审/已发状态。容许系统字体渲染细差；不容许入口缺失、三列挤压、颜色满屏、伪状态或手机横溢。HTML仅设计交付物，DSH复用现有组件实现，不直接把静态HTML塞进Nuxt。
