# 给 DSH 的执行指令（英语首稿收尾）

你是实现方。请完整阅读本包README、01审查报告、01-ISSUES.csv、03-BLOG-COVER-MAP.csv、04-ALT-AUDIT.csv，再开始；不要只读摘要，不要跳过未解决项。最新业主要求：只审/完善英文，不把西语暂缓列成缺陷，不加语言，不回退已确认方案C，不改英文URL，不切换Wix。

## 文件位置与领取

- Drive主目录：https://drive.google.com/drive/folders/1_rQ9HbRWdHGPaq-dYS1GtoibTfOlrf0S
- 报告与指令：01_报告与执行指令
- 图片及映射：02_Blog替代图与映射
- 验证记录/完整ZIP：03_验证证据与完整包
- 所有文件只在 tutuboluojiang@gmail.com 所属指定项目目录中交付。
- 下载完整包后解压到仓库外，例如 D:\LITUBO-handoff\review-b169d97。不要把报告里的Codex绝对/workspace路径当作你本机路径。
- 建议把去密后的报告/映射/素材归档进 `docs/project/reviews/2026-11-16-b169d97/`，并在CURRENT-STATE/你的施工进度入口写相对链接；不得把`.env`、私人数据库dump、客户资料、模型密钥或审查mock配置提交进去。

## 第0步：建立基线，不覆盖新工作

读取项目AGENTS与当前状态，执行 `git status --short`、`git branch --show-current`、`git rev-parse HEAD`、`git log -1 --oneline`。基线是work/c-refined-v1@b169d97。若已有后续提交，先逐项标记哪些问题已经修好；不reset、不覆盖未提交修改、不照旧行号盲改。

本审查使用快照适配器，模拟图片公开状态，不是你的正式Directus。不要运行审查tools目录来替换现有后端；不要把其中临时token配置带入生产。报告的行号只针对b169d97。

## 第1步：修好主要链路（A01–A04）

1. Insights详情使用现有publicPageStatus，保持真实503；不存在的slug仍404。用停止/拒绝posts读取验证，不要只测正常200。
2. 称重分类取useAsyncData.error，统一SSR错误状态，客户端失败可retry；故障不能出现“All series 0 models”。正常无匹配结果才显示Clear filters。
3. 公共邮箱在最终规范化后验证；拒绝HTML，不把清洗成无效的邮箱入库。
4. 各type/subtype建立最小必填表，按现有UI规则，不让备件姓名突然必填。缺字段400且零写入；合法表单仍写入一次。
5. 错误发生后保留填写内容、禁用发送中重复点击；UI给可理解提示和人工联系。不要为初稿引入新的表单/工作流框架。

## 第2步：消除丢失上下文和操作缺口

- A05：document白名单结果接入SupportRequestForm.messagePrefix/defaultMessage；POST中确认资料类型和客户正文同时保留。
- 既有series待办：technical-matching读取并显示有效series，提交携带到现有合适字段/message；Pharmaceutical无机型资料仍是专用系列咨询，不编型号。
- A06：搜索焦点限制在dialog，关闭回到触发按钮；搜索旧请求必须在输入变化/清空/关闭时失效，不能等新请求启动才更新序号。
- A07：邮箱格式、首错焦点、aria关联；A09：服务端只保存来源域名/来源origin，去query和fragment。
- A10：先在真实Directus演示编辑一篇现有posts文章与cover，前台列表/详情一致。不要误改Content Center中的另一条technical_article然后声称Blog同步完成。最小可用原生编辑路径即可，不要求这一轮迁移整套内容模型。

## 第3步：按映射落实图片与文案

完整读报告C；逐条处理03表，不要自己拿3张样本去套全部10篇。

- 保留12/14/15/17/19；替换13/16/18/20/21；每行匹配id+slug，slug不改。
- 13和16优先复用表中的现有Directus UUID；先对照真实缩略图确认，资产文件作为备用，不能盲猜文件ID。
- 18/20/21上传本包3张1600×900 WebP。先新文件is_public=true、未归档、代理200，再更新posts.cover_image；不关闭现有共享文件的公开资格。
- 设备图片contain；场景可cover。03表含英文alt、fit、图注，前端字段不足时可用只针对这10篇的受控映射，或最小posts媒体描述字段；不复制一个与CMS脱节的产品数据库。
- 对16标题去掉three technologies绝对说法；技术文章中的检测/包装适用性措辞要附条件，最终工程确认，禁止补新参数。
- 新生成图标注编辑用途，不能当工厂实拍或检测结果；不得覆盖产品真实主图。
- 每篇验证API顶层coverImageUrl、列表、详情；如果上游不是预期结构先读接口代码，不能再用$d.post.coverImageUrl误报空值。

## 第4步：SEO及视觉小修

1. 在动态sitemap工具中加缺的5分类、Blog索引和10篇已发布Insights；发布/noindex/路由一致；最后loc去重。
2. 29产品全部noindex是快照事实。列出业主待确认，不自动一键关闭；上线时逐条审核后再放行并验证Product/Breadcrumb输出。
3. 修改重复title/description，3个支持请求页接useSeoHead；文章传入真实OG图和BlogPosting；不造价格/评分/认证。
4. 不新建public/robots.txt：现有动态robots已可返回。若加/admin禁止爬取只在该路由加；siteUrl使用确认的主域。
5. 按04逐项处理alt，避免装饰图重复朗读。金色CTA改深字，品牌金黄/叶绿不变。
6. 菜单中CSS空图片区用已有合适图片补齐；Resources只推荐真实已发布文章；不要新增菜单、重排导航或重新设计整站。

## 第5步：验证与回报

- 修正旧测试预期而不是回退当前Blog：保留私有/归档媒体负向测试、404/503区分、询盘不合法零写入。
- 针对变更跑相关测试+typecheck，完成一次必要build；通过就停止扩大无关检查。
- 做实际浏览器视觉对照：1440与390为主，补320、768、1024。核对设备不裁主体、页头不遮标题、按钮可读、表单可填写；不要以截图拼接假象冒充网站缺陷。
- 快照没有真实files/policy；你需在本机核对新文件资格、服务角色最小权限、合法询盘入库、管理员读写、未登录写接口拒绝。不要打印token/询盘详情。
- 原移动溢出在本审查代表矩阵没复现；按旧地址复测，给documentElement.scrollWidth与innerWidth数字。有问题定位具体元素，不用body overflow-x:hidden掩盖。
- 给业主回报表：问题ID/修复提交/正常场景/失败场景/截图/未完成原因；全站状态按READY_FOR_REVIEW，不擅自写READY_FOR_LAUNCH。

## 执行节奏

先完成不依赖业主的所有修复，不逐条请示。仅把内容事实、产品索引发布、正式AI预算与启用、法律文字、生产部署集中留为业主决定；其他事项持续推进。不要自行发送外部客户消息，不改DNS/Wix，不把“API已有”写成“真实服务已联调”。

AI这轮仅按报告B出最小实施任务，不为追求“智能”引入付费新服务；已有助手知识不含全部产品参数。先内部询盘摘要，再受限预览，正式公开开关须单独记录决定。
