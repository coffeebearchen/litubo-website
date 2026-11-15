# LITUBO-STATUS-HANDOFF-NO-TEST-01 — 现状与交接盘点（不测试）

> 模块：LITUBO-STATUS-HANDOFF-NO-TEST-01 · 2026-09-20 · 只读整理，未执行任何新测试。
> **用户主动暂停剩余测试。** 本轮只整理现有资料与证据，不运行 tests / typecheck / lint / build / 浏览器 / CI，
> 不安装依赖、不改应用代码、不修数据库或媒体、不重启、不部署、不 commit / push / merge，不初始化 ANYI。
> 本文件依据仓库内既有记录写成；**只读查看 Git 与既有日志不等于测试通过**。
> 当前状态**不是**"全面验收通过"的稳定生产基线。

---

## 1. 版本事实

### 1.1 本地

| 项 | 值 |
|---|---|
| 工作目录 | `D:\LITUBO-website` |
| remote | `origin` = `git@github.com:coffeebearchen/litubo-website.git`（fetch 与 push 同一地址） |
| 当前分支 | `review/final-release-verification-01` |
| **本地完整 HEAD** | **`186fe3b16f352a3f1fa71336fc9692f65e4b997d`**（`fix(public-media): legacy post body images and file links under RSG-06`，2026-09-19）。**它只是开发候选 HEAD**：远端 CI 未核实、独立审阅未做、未合并 master、未部署，**不是 Stable Production SHA，Stable Production SHA 仍未冻结** |
| 已跟踪文件的未提交修改 | **0**（`git status --short` 无 `M` / `A` / `D` 行） |
| 未跟踪文件 | 6 项，见 §1.2 |
| 本地 `master` 分支 | `b6125f68dff8df2898b1b983b1221c61294e2288`（2026-09-09）——是 HEAD 的祖先，但**落后远端 master 96 个提交**，不能当作基线 |
| `origin/master` 本地跟踪副本 | `64bfc566569d87b50142d8081b6763a1bf68275e`（最后一次 fetch：2026-09-18T08:20） |
| 远端 review 分支 | `186fe3b16f352a3f1fa71336fc9692f65e4b997d`（2026-09-19 push 成功，当时以 `git ls-remote` 核实；本轮未重新查询远端） |
| HEAD 相对 `origin/master` | 领先 4 个提交、落后 0 个：`39bf8f1`（文档）、`fd807f6`、`64bf807`、`186fe3b` |
| 本地分支总数 | 65（多为历史 review 分支） |

### 1.2 未跟踪文件（HEAD **不包含**这些内容）

| 路径 | 文件数 | 体积 | 性质 |
|---|---|---|---|
| `README-FIRST.md` | 1 | 4 KB | Media Library Cloud Workspace V1 交付包的安装与开工说明（外部来源） |
| `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/` | 5 | 5.7 MB | 视觉母版交付包 |
| `docs/design-reference/approved/admin-cms-product-workspace-v1/` | 12 | 22 MB | Product Workspace 视觉母版 |
| `docs/design-reference/inbox/` | 9 | 15 MB | 未归档的视觉素材 |
| `docs/product-cms/CMS-AI-CONSTRUCTION-PACK-V1/` | 12 | 144 KB | 施工包文档 |
| `docs/project/LITUBO_9C-2R_正式施工单.md` | 1 | 12 KB | 施工单文档 |

本文件（`LITUBO-STATUS-HANDOFF-NO-TEST-01.md`）本轮**不 commit**，保存后也是未跟踪状态。
`docs/project/CURRENT-STATE.md` 的本轮追加同样**未 commit**。

**明确声明：本地 HEAD `186fe3b` 不包含上述未跟踪内容，也不代表"当前全部成果"——未跟踪的交付包与本轮新增文档都在工作区、不在 HEAD 内。**

### 1.3 线上（生产 / 验收站）

| 项 | 值 | 证据 |
|---|---|---|
| 线上域名 | `https://tuboluo.com`（临时验收域名，`X-Robots-Tag: noindex`） | `CURRENT-STATE.md` §0 `Production release` 行；`LITUBO-SIMPLE-GO-LIVE-AUTOPILOT` 节 |
| **线上实际 SHA** | **`64bfc566569d87b50142d8081b6763a1bf68275e`**（`/opt/litubo/repo`） | `CURRENT-STATE.md` §0 `Production runtime` 行（2026-09-19T04:53Z 只读实测）；`LITUBO-PRODUCTION-ACCEPTANCE-01` 节（同一 SHA，tracked 0 / 未跟踪 0） |
| 线上构建产物指纹 | `.output` = `32210fd901f7f94d` | 同上；工作包 1 验收前后相同 |
| 运行构建来源 | **未完全验证**（构建产物不含 SHA，未做字节级复现；间接证据链完整） | `LITUBO-PRODUCTION-ACCEPTANCE-01` 节"目标与运行构建" |
| 本轮是否重新核实线上 | **否**，未登录服务器。上述值引用既有部署记录，最后一次实测为 2026-09-19T04:53Z；此后未部署 | 本文件 |
| 正式域名 | `litubo.com` / `www.litubo.com` 仍在 Wix，未切换、未改 DNS | `LITUBO-SIMPLE-GO-LIVE-AUTOPILOT` 节 |

**线上不包含**本地 HEAD 之前的三个修复提交（`fd807f6` hero 修复、`64bf807` 文章封面 / OG 修复、`186fe3b` 文章正文公开媒体修复）与 `39bf8f1`（文档）。
**不得用本地 HEAD 代替线上 SHA。**

---

## 2. 分类 1 — 已完成且有对应版本的测试证据

> "有证据"= 仓库记录里能指到具体证据位置与版本。除特别标注外，证据范围都是**本地**；本地证据不构成生产事实。

| 模块 | 实际状态 | 已有证据位置 | 涉及版本 | 对 ANYI 复用的影响 |
|---|---|---|---|---|
| 公开站点 Phase 1（28 个公开页面、导航、EN） | 线上可访问；部署时 7 页 1440 / 375 验收 PASS、无横向溢出、canonical 正确 | `CURRENT-STATE.md` `LITUBO-SIMPLE-GO-LIVE-AUTOPILOT` 节"验证结果"；`tests/publicRouteCorrectness.test.ts` 等 | `64bfc56`（线上）；本地 HEAD 含后续修复 | 页面骨架、导航、i18n 结构可作为派生基线；派生应基于经验收的 SHA，而不是任意本地提交 |
| 询盘链路（`/api/inquiries`、contact / spare-parts / support-request） | 线上真实提交 PASS（1 条、字段一致、`hubspot_sync_status=not_configured`）；`consent=false` 返回 400 不写入 | `LITUBO-PRODUCTION-ACCEPTANCE-01` 节表 E 行；`LITUBO-SIMPLE-GO-LIVE-AUTOPILOT` 节 | `64bfc56` | 可复用；ANYI 若复用需自备 SMTP / CRM 决策（本项目均未配置） |
| Admin 产品 CMS 核心流程（登录、建产品、编辑保存、规格、媒体上传、Draft → Review → Publish → 撤回） | 线上登录后验收 PASS | `LITUBO-PRODUCTION-ACCEPTANCE-01` 节验收表 A–D、F 行 | `64bfc56` | 可复用；但 hero 差异（见 §5）在该版本仍存在 |
| Media Library 基础与受保护系统目录 bootstrap | 本地测试通过；生产 10 个系统目录已建 | `MEDIA-LIBRARY-PRODUCTION-BOOTSTRAP-01` 节；`tests/mediaFolderBootstrap.test.ts`、`tests/mediaFolderBootstrapDbIntegration.test.ts`；决策 D-045 | `64bfc56` | 可复用；DB 集成用例需要 `CONTENT_DB_TEST_CONTAINER` 环境开关 |
| Content Center CC-IMP-01…10（Draft 编辑、媒体与关系、SEO / locales、预览与人工发布、归档 / 恢复、AI intake / review / apply、公开交付与 sitemap） | **LOCAL COMPLETE**，多数模块经 Controller 视觉签收；所有内容类型 `publicEnabled=false`，从未在生产启用 | `MASTER-ROADMAP.md` CC-IMP-01…10 补充行；`CURRENT-STATE.md` 对应各节；`tests/content*.test.ts`（约 15 个文件） | 本地提交链，已含在 HEAD `186fe3b` | 这是最完整的一套内容后台实现，可作为 ANYI 的参考；但它**从未在生产运行过** |
| 数据库 + Directus 媒体备份 / 恢复 | 本地演练 PROVEN；生产首份备份已创建并独立校验（`sha256sum -c`、`verifyBackupSet`），隔离恢复演练完成并清理 | `FINAL-RELEASE-PRODUCTION-READY-02` 节（D-040）；`LITUBO-STABLE-BASELINE-CLOSEOUT-01` 节"生产准备"表；`tests/backupRestore.test.ts` | 备份集 `litubo-backup-20260919-052730`（线上 `64bfc56` 运行时） | 备份 / 恢复工件可复用；异地、保留期、加密、定时仍未定（见 §4） |
| 运行时固定与 secret 边界（Node 22.22.2 gate、Directus / PostgreSQL 镜像 digest pin、构建产物 secret 计数 0） | 本地 scratch 范围 PROVEN；部署时 `release:verify` 通过、6 个 secret 在产物中出现 0 次 | 决策 D-038 / D-039 / D-041 / D-042；`RELEASE-SAFETY-GATES.md` RSG-08 子项；`LITUBO-SIMPLE-GO-LIVE-AUTOPILOT` 节 | `64bfc56` | 建议 ANYI 沿用同一套 runtime 与 secret 注入约定 |
| 本地公开媒体 RSG-06 修复链（产品 hero / gallery / 下载 / 区块图 / OG 图、分类主图、首页主图、旧版文章封面 / OG / 正文） | 本地自动化测试 + 本地浏览器 1440 / 375 验证通过；`64bf807` 的远端 CI run `35431238841` success 由 Controller 核实 | `CURRENT-STATE.md` `LITUBO-HERO-FIX-01`、`LITUBO-PUBLIC-MEDIA-CLOSEOUT-01`（含续轮）、`LITUBO-STABLE-BASELINE-CLOSEOUT-01`（含"续修"小节）；`tests/publicRouteCorrectness.test.ts` | `fd807f6` / `64bf807` / `186fe3b`（均未上线） | 修复只改读取端，可整体随代码派生；ANYI 若派生自线上 `64bfc56`，会**不包含**这些修复 |
| 最近一次全量自动检查（在 `186fe3b` 的最终代码上） | Node gate OK；typecheck 0 错；lint 0 错；`npm test` 90 文件 / 3213 条通过 + 193 条按环境开关跳过；build 通过 8.28 MB | `CURRENT-STATE.md` `LITUBO-STABLE-BASELINE-CLOSEOUT-01` → "续修"小节"检查"段 | `186fe3b` | 口径必须原样转述：**193 条跳过 ≠ 全量通过** |

---

## 3. 分类 2 — 已完成，但尚未测试或证据不足

| 模块 | 实际状态 | 已有证据位置 | 涉及版本 | 对 ANYI 复用的影响 |
|---|---|---|---|---|
| `186fe3b` 的远端 CI | **未核实**。`64bf807` 的 CI 已由 Controller 核实，结论不延用到新提交 | `CURRENT-STATE.md` §0 `Active authorized module` 行 | `186fe3b` | ANYI 不应把未核实 CI 的提交当作基线 |
| `186fe3b` 的独立审阅 | **未进行**。两轮 Claude 只读子会话审阅的阻塞项已修复，但修复后的代码本身未再送审 | 同上；"续修"小节"独立审阅"段 | `186fe3b` | 同上 |
| 最终代码的浏览器 1440 / 375 复验 | **未跑**。现有浏览器证据来自二审加固前的版本 | "续修"小节"本地浏览器验证"段 | `186fe3b` | 未知：视觉层未复验，派生前应自行确认 |
| 三个修复提交的生产验证 | **未部署、未验证**。RSG-06 服务器侧状态为 `OPEN`（待部署验收） | `RELEASE-SAFETY-GATES.md` RSG-06 行 | `fd807f6` / `64bf807` / `186fe3b` | 线上行为仍是 `64bfc56` 的行为 |
| Content Center 全链路在生产 | **未验证**。生产库为空（0 内容 / 0 产品 / 0 分类 / 0 文件），内容类型未公开启用 | `LITUBO-SIMPLE-GO-LIVE-AUTOPILOT` 节"生产库计数" | `64bfc56` | 复用前需自行完成生产级验证 |
| RSG-01 / RSG-02 Products（Draft 永不公开、单一公开资格合同的产品侧） | `OPEN` — 既有缺口，记为阻塞产品 CMS 公开切换 / 生产发布；V1 没有 Published Snapshot / Revision Draft | `RELEASE-SAFETY-GATES.md` RSG-01 / RSG-02 行 | 全部版本 | ANYI 若复用产品 CMS，会继承同一缺口 |
| RSG-03 人工发布取证 | Products `OPEN`（尚未按该文件取证）；Content `NOT_YET_EXERCISED` | `RELEASE-SAFETY-GATES.md` RSG-03 行 | 全部版本 | 同上 |
| RSG-05 遗留首页 `home.hero` 的语言回退 | `OPEN` — ES / PT 公开启用前须复核 | `RELEASE-SAFETY-GATES.md` RSG-05 行 | 全部版本 | ANYI 若多语言公开，须先解决回退语义 |
| RSG-07 产品子表过滤的 Directus 运行时正向执行、`inquiries` 行范围 | `OPEN`（`inquiries` 行范围登记为 P2 残留） | `RELEASE-SAFETY-GATES.md` RSG-07 行 | 全部版本 | 权限模型可复用，但正向执行未证明 |
| 安全修复（Directus 12.3.1，D-042） | 模块报 BLOCKING 0 / UNKNOWN SECURITY EXPOSURE 0，但**待 Controller 复核后方可视为关闭**；Container Security 不得写 `PROVEN` | `RELEASE-SAFETY-GATES.md` RSG-08 子项；`SECURITY-REMEDIATION-REVIEW.md` | `bb6c136` 及其后 | 镜像 pin 与修复结论可参考，但复核未完成 |
| 生产备份的异地副本 / 保留期 / 静态加密 / 定时调度 | `OPEN`；RPO / RTO 为 TO BE CONFIRMED；书面 rollback plan 仍不完整 | `RELEASE-SAFETY-GATES.md` RSG-08 子项 | — | ANYI 上线前需要同样的运维决定 |
| 应用回滚验证 | **未执行**（计划在部署维护窗口内进行） | `LITUBO-STABLE-BASELINE-CLOSEOUT-01` 节"生产准备"表最后一行 | — | 未知 |
| 生产 RAM / CPU 容量 | `OPEN`。本地容量基线"已记录"，但"不是生产证据" | `RELEASE-SAFETY-GATES.md` RSG-08 子项；`PRODUCTION-CAPACITY-DEPENDENCY-REVIEW.md` | — | ANYI 与 LITUBO、refrigerant-store 共用同一台主机，容量需重新评估 |
| 生产公开路由 / sitemap smoke | `OPEN` | `RELEASE-SAFETY-GATES.md` RSG-08 子项 | `64bfc56` | 未知 |
| OG 图域名过渡 | 单独待决：生产构建 `NUXT_PUBLIC_SITE_URL=https://litubo.com`，验收站的 `og:image` 指向尚未切换的 litubo.com；本地验证不算外部抓取验收 | `LITUBO-STABLE-BASELINE-CLOSEOUT-01` 节"验收站上的 OG 地址限制" | `64bf807` 起 | ANYI 需要在部署前定好 canonical / 站点地址 |
| 文档与事实的滞后 | `PRODUCTION-PREFLIGHT.md` §53 与 `RELEASE-SAFETY-GATES.md` 部分行未随 2026-09-18 部署更新（例如仍写"主机上没有任何 LITUBO 服务在运行"、marker"尚不存在"、RSG-09 仍写 `origin/master = 8f2e384`）；`docs/OPERATIONS-HANDBOOK.md` 仍写 vhost / systemd unit"还没有编写"、媒体路径仍写 `/assets/` | `LITUBO-SIMPLE-GO-LIVE-AUTOPILOT` 节"仍 OPEN"第 4 条；`LITUBO-PRODUCTION-ACCEPTANCE-01` 节"发现"第 2 条 | — | 交接给 ANYI 前必须以 `CURRENT-STATE.md` §0 与各模块节为准，不能直接采信这两份文件 |

---

## 4. 分类 3 — 尚未实现

| 模块 | 实际状态 | 已有证据位置 | 涉及版本 | 对 ANYI 复用的影响 |
|---|---|---|---|---|
| ANYI 代码派生 | **未启动**（本仓库除 `CURRENT-STATE.md` 的记述外没有 ANYI 文档或代码） | 本文件 §7 | — | 派生门槛与方式未定，本轮不改 |
| 产品 CMS 公开切换（J-10 / 产品发布工作流） | 未完成；RSG-01 / RSG-02 Products 仍 `OPEN` | `RELEASE-SAFETY-GATES.md` §4.2、RSG-01 行 | — | ANYI 若需要产品发布工作流，须重新设计或等本项目补齐 |
| IMP-01 批量导入 | **未开始** | `MASTER-ROADMAP.md`（"`AI-01`/`IMP-01` 均未开始"） | — | 无 |
| Product Workspace（PWS 系列） | **见 §4A 的三分类更正**（本表原先笼统写成"未开始"，与仓库实际代码不符，已更正） | §4A | — | 见 §4A |
| ES / PT 公开启用 | 未启用，只有 EN 公开；结构从 Module 1 起就位 | `CLAUDE.md` locale 架构；RSG-05 行 | — | 多语言能力存在但未验证 |
| 正式域名切换 `litubo.com` / `www` | 未执行、未授权；Wix 仍在服务 | `LITUBO-SIMPLE-GO-LIVE-AUTOPILOT` 节；决策 D-044 | — | 无 |
| `cms.litubo.com` 的访问方式 | 未决定；Directus 只监听 127.0.0.1:8055，Studio 经 SSH 隧道 | `CURRENT-STATE.md` §0 `Next candidate` 第 5 项 | — | ANYI 需要自己的 CMS 暴露方案 |
| document-extractor（PDF / 图片抽取）在生产 | 未启动（AI 关闭）；镜像可复现性 `OPEN`，被记为非上线 blocker | `PRODUCTION-PREFLIGHT.md` §53"非上线 blocker"；`RELEASE-SAFETY-GATES.md` RSG-08 子项 | — | AI 相关能力不建议现在派生 |
| AI provider 生产配置 | 未配置（无 Key，AI 费用 0）；真实调用授权余额 **0** | `CURRENT-STATE.md` §0；`FINAL-RELEASE-LIVE-VALIDATION-01-R3` 节 | — | 同上 |
| HubSpot 提交、真实邮件 / newsletter、公开 AI 聊天、下载 gate | 未实现，按项目范围禁止在未授权时建设 | `CLAUDE.md`"Content and SEO rules"；`LITUBO-PRODUCTION-ACCEPTANCE-01` 节"对外通知 未触发" | — | ANYI 若需要，须单独立项 |
| 自动备份定时任务（cron） | 未部署 | `docs/OPERATIONS-HANDBOOK.md` 运维清单未勾选项；RSG-08 子项 `OPEN` | — | 上线前必须补 |
| `master` 分支保护 | 未启用 | `CURRENT-STATE.md` §0 `origin/master` 行；`PRODUCTION-PREFLIGHT.md` 人工 gate | — | 建议 ANYI 一开始就启用 |

---

## 4A. Product Workspace（PWS）状态更正 — 未实现 / 已实现未部署 / 已实现未验收

> **更正说明：** 本报告首版把 PWS 系列笼统写成"未授权、未开始"，依据只是 2026-09-07 两份治理记录。
> 对照仓库实际文件后更正如下。已部署与否按一条已核实的祖先关系判定：本地 `master`（`b6125f6`，2026-09-09）
> 是线上 `64bfc56` 的祖先（`git rev-list --left-right --count` = `0 96`），因此 2026-09-07 / 09-09 交付的
> Workspace 代码**都已包含在线上构建里**；但"代码在线上"不等于"生产验收过"。

**仓库实际存在的 Workspace 路由（`pages/admin/product-workspace/[id]/`）：** `overview.vue`、`page-content.vue`、
`specifications.vue`、`media-resources.vue`、`sources-evidence.vue`、`ai-source-intake.vue`、`ai-proposal-review.vue`。

### 4A.1 未实现

| 模块 | 依据 |
|---|---|
| `PWS-08` Change History | `MASTER-ROADMAP.md` PWS-07-FAST-01R 补充行明写"`PWS-08`、人工审核写入、AI 均未开始"；`pages/admin/product-workspace/[id]/` 下没有对应页面 |

### 4A.2 已实现未部署

| 模块 | 依据 |
|---|---|
| **（本类为空）** | 上述 7 个 Workspace 页面都早于线上 `64bfc56`，已随该构建部署；PWS 范围内没有"已实现但不在线上"的模块。（线上缺失的只有与 PWS 无关的三个公开媒体 / hero 修复提交 `fd807f6` / `64bf807` / `186fe3b`） |

### 4A.3 已实现未验收

| 模块 | 实际状态 | 已有证据位置 | 涉及版本 |
|---|---|---|---|
| `PWS-01` Page Content（`page-content.vue`） | 已交付为可编辑模块，复用旧编辑器的 `product_sections` / `product_faqs` API；**生产未验收**（工作包 1 未测该页）；`CH-DG-13` / `BP-DG-07` 未关闭 | `MASTER-ROADMAP.md` PWS-01-FAST-01 补充行；`LITUBO-PRODUCTION-ACCEPTANCE-01` 节范围说明 | 已在 `64bfc56` 内 |
| `PWS-07` Sources & Evidence（`sources-evidence.vue`） | 只读展示版已交付，通过本地自动化与浏览器验收；**生产未验收**——工作包 1 明写"来源 / 证据关联**未做**"；`BP-DG-06` 保持未解决 | `MASTER-ROADMAP.md` PWS-07-FAST-01R 补充行；`LITUBO-PRODUCTION-ACCEPTANCE-01` 节"授权与范围" | 已在 `64bfc56` 内 |
| 产品 AI 工作流（`ai-source-intake.vue`、`ai-proposal-review.vue`） | 单产品 AI 已交付并在 TEST ONLY 产品上跑通（Source Intake、Proposal / Batch Review、Apply to Draft、重复 / 重放防护）；**生产未验收**，生产默认 fail-closed 关闭 Apply（`PRODUCT_AI_APPLY_ENABLED`）；无 AI Key、真实调用 0 | `MASTER-ROADMAP.md` 2026-09-09 更新行；`RELEASE-SAFETY-GATES.md` RSG-04 行 | 已在 `64bfc56` 内 |
| 规格参数页（`specifications.vue`） | 已实现；**生产验收通过该页的保存路径**（工作包 1 "B 规格参数（Workspace）" PASS：参数组 1 / 参数 1 保存、刷新后仍在）；该页对应哪个 PWS 编号未在记录中写明 → **编号归属状态待核实** | `LITUBO-PRODUCTION-ACCEPTANCE-01` 节验收表 B 行 | 已在 `64bfc56` 内 |
| Media & Resources 页（`media-resources.vue`） | 已实现；工作包 1 的媒体上传 / 设为产品图片验收 PASS（hero 有差异），但记录未点名经由该页 → **验收归属状态待核实** | `LITUBO-PRODUCTION-ACCEPTANCE-01` 节验收表 C 行 | 已在 `64bfc56` 内 |
| Workspace Overview / Shell（`overview.vue`） | 代码存在；2026-09-07 的治理记录说 `PWS-00` 代码未开始，此后是否按 `PWS-00` 合同实现、是否验收，收集到的记录中没有结论 → **状态待核实** | `MASTER-ROADMAP.md` PWS-DOR-02 补充行（旧）；仓库文件清单（新） | 已在 `64bfc56` 内 |
| `PWS-02`…`PWS-06`、`PWS-AI-01` / `PWS-AI-02` 的编号—页面映射 | 收集到的记录只确立了命名空间，没有逐个登记实现状态；不按"未实现"笼统归类 → **状态待核实** | `MASTER-ROADMAP.md` PW-GOV-01 补充行（"不代表任何模块已实施"） | — |

**对 ANYI 复用的影响：** Workspace 是"代码已在线上、但大部分模块只有本地证据"的状态；派生前需要逐页确认验收范围，不能按"已上线"当作已验证。

---

## 5. 分类 4 — 已知报错、失败测试与未解决问题

> 这些是**已知失败 / 已知缺陷**，不是"仅未测试"。

| 问题 | 实际状态 | 已有证据位置 | 涉及版本 | 对 ANYI 复用的影响 |
|---|---|---|---|---|
| Content AI Live Golden Path 未走通（R2 / R3 均 **STOP**） | R3：真实 DeepSeek 调用发生，HTTP 200 但响应经 Target 安全校验后**零可用项**（失败点 `server/utils/aiTargets/contentDraftTarget.ts:263`），Proposal 未生成、Apply 架构上不可能发生；业务写入 0。R2：`SELECTION_INVALID_ERROR`（时序问题，R3 已通过分段执行规避）。用户授权的 1 次真实调用已消耗，**剩余 0** | `CURRENT-STATE.md` `FINAL-RELEASE-LIVE-VALIDATION-01-R2` / `-R3` 两节 | 本地 `801af4f` / `3684561` 基线 | AI 链路不可宣称可用；ANYI 不应把它当成已验证能力 |
| RSG-04 Content AI | `OPEN`——"Content AI Golden Path **仍未证明**"，不得写 `PROVEN` | `RELEASE-SAFETY-GATES.md` RSG-04 行 | — | 同上 |
| 分类卡片 hero 主图不显示 | 线上 `64bfc56` **仍存在**；本地 `fd807f6` 已修复并验证，未部署 | `LITUBO-PRODUCTION-ACCEPTANCE-01` 节"发现"第 1 条；`LITUBO-HERO-FIX-01` 节 | 线上 `64bfc56` | 从线上 SHA 派生会继承该缺陷 |
| 公开媒体 RSG-06 缺口（私有 / 已归档文件可能出现在公开输出） | 线上 `64bfc56` **仍存在**；本地 `fd807f6` / `64bf807` / `186fe3b` 已修复，未部署 | `LITUBO-PUBLIC-MEDIA-CLOSEOUT-01`（含续轮）、`LITUBO-STABLE-BASELINE-CLOSEOUT-01`（含"续修"）各节 | 线上 `64bfc56` | 同上；这是安全相关缺口，派生前应带上修复 |
| AI Source Intake 的 `Readable` 徽章只按 MIME 推导 | 未修（P2）。两个 malformed 的旧 JPG / PDF 仍显示 `Readable`，对人工操作者有误导 | `FINAL-RELEASE-LIVE-VALIDATION-01-R3` 节"已知 / 记录" | — | 未知 |
| `nuxt dev` 监视 `dev-data/postgres` 与 `dev-data/uploads` | 未修（P2）。Postgres 临时文件或媒体上传会触发整页重载 / Nuxt 重启；AI proposal 只存在于 Nuxt 进程内存，重启即丢失 | `FINAL-RELEASE-LIVE-VALIDATION-01-R3` 节"新观察"；`LITUBO-PUBLIC-MEDIA-CLOSEOUT-01 续轮`节"上传备注" | 本地开发环境 | 开发体验问题，ANYI 若沿用同一目录结构会继承 |
| FAQ 页 hydration 警告 | 未修。`components/ui/Accordion.vue` 用 `Math.random()` 生成 id（提交 `a2d1c4e`，2026-09-01） | `LITUBO-STABLE-BASELINE-CLOSEOUT-01` → "续修"小节 | 全部版本 | 会随组件一起被派生 |
| 后台产品媒体关联不拒绝已归档文件 | 未修 | `RELEASE-SAFETY-GATES.md` RSG-06 行"未关闭"；`LITUBO-STABLE-BASELINE-CLOSEOUT-01` 节"已知事项" | 全部版本 | 同上 |
| Media Library 归档检查不把首页主图算作引用 | 未修 | 同上 | 全部版本 | 同上 |
| 正文中带任何 UUID 的链接一律按文件引用判定（外链会被去链，fail closed） | 已接受的取舍，未修 | `RELEASE-SAFETY-GATES.md` RSG-06 行；"续修"小节"对正常内容的影响" | `186fe3b` | 需要在内容规范里说明 |
| 媒体库根目录不显示上传按钮；375 图库裁切；一次偶发跳转到产品中心 | 均未修（工作包 1 记录的第 4 / 5 / 6 条发现） | `LITUBO-PRODUCTION-ACCEPTANCE-01` 节"发现" | `64bfc56` | 未知 |
| 运维手册描述过时 | 未修。`/assets/` 路径与 403 描述与实际（`/api/cms/media/<id>`，未公开时 404）不符；vhost / systemd"还没有编写"已不成立 | `LITUBO-PRODUCTION-ACCEPTANCE-01` 节"发现"第 2 条；`docs/OPERATIONS-HANDBOOK.md` | — | 交接文档需要修订才能给运营使用 |
| **F-1：集成套件并行运行时有 10 条断言失败** | 已知、未修（记录为测试基础设施问题，非产品缺陷）。开启数据库集成套件并使用 vitest 默认文件并行时，`tests/releaseTestDataCheck.test.ts` 的 10 条清理断言失败——它统计五张共享表中**全部**负 id 行，而并行运行的其他集成套件正合法持有自己的负 id 夹具。改为串行（`--fileParallelism=false`）时：**95 文件 / 3242 条全部通过、0 失败、0 跳过** | `CURRENT-STATE.md` `FINAL-RELEASE-VERIFICATION-01` 节"十、自动化门禁与构建"与"十三、F-1" | RC `da8f445` 时实测，相关文件此后未改 | ANYI 若复用测试工件，需要知道集成套件必须串行跑 |
| **F-2：`nuxt dev` 运行时执行 `nuxt build` 会破坏 dev server** | 已知、未修（开发工具问题）。dev server 随后报 `#app-manifest` 预转换错误，已开的标签页出现 `/_nuxt/…` 503 | `CURRENT-STATE.md` `FINAL-RELEASE-VERIFICATION-01` 节"十三、F-2" | 全部版本 | 同上 |
| 测试口径 | 默认运行（跳过集成）：本轮最新为 **90 文件 / 3213 条通过 + 9 文件 193 条跳过**（需 `CONTENT_DB_TEST_CONTAINER` / `DOCUMENT_EXTRACTOR_TEST_*`）；RC 时为 87 文件 / 3075 通过 / 167 跳过。CI 范围小于本地——"**CI 绿不等于全量绿**" | `RELEASE-SAFETY-GATES.md` RSG-09 行；"续修"小节"检查"段；`FINAL-RELEASE-VERIFICATION-01` 节 | `186fe3b`（最新）、`da8f445`（RC） | 交接时必须原样转述，不得写成"全部通过" |
| 本地 `master` 分支落后 96 个提交 | 未同步（本轮不处理） | 本文件 §1.1 | — | 派生时务必确认基线 SHA，不要用本地 `master` |
| 未解决的人工 / 法务 gate | Poppler / libvips / util-linux 许可证审查 `OPEN`；隐私政策与 `PRIVACY_POLICY_VERSION` `OPEN`；Directus BUSL-1.1 商业确认须人工；遥测无法关闭（OIG `telemetry_required = true`，记为业务负责人 gate） | `RELEASE-SAFETY-GATES.md` RSG-08 子项；`PRODUCTION-PREFLIGHT.md` §47 人工 gate | — | ANYI 复用同一技术栈会继承同样的法务待办 |
| 生产发布状态 | `RELEASE-SAFETY-GATES.md` §8：**生产发布状态：NOT APPROVED**；`PRODUCTION-PREFLIGHT.md` §53：**PRODUCTION PREFLIGHT STILL INCOMPLETE**（6 项首次上线 blocker 中 4 项仍 OPEN / 部分关闭） | 两份文件本身 | — | 当前不是可直接复制的"已验收生产基线" |

---

## 6. 运行中的测试 / 进程

| 项 | 结果 |
|---|---|
| LITUBO 的测试 / dev server / 构建进程 | **无**。本机只有一个 `node` 进程（PID 34636），命令行为 Adobe Creative Cloud Experience 的 `main.js`，与本项目无关，未做任何处置 |
| 本会话的后台任务 | 上一轮的检查任务已结束（退出码 0），本轮未启动新任务 |
| 归属不明的进程 | 无。未杀进程、未重启任何任务 |

---

## 7. ANYI 复用现状

- 仓库内 **只有 `docs/project/CURRENT-STATE.md` 提到 ANYI**，且两处（第 12541、12650 行）说的都是"本机在线的另一个会话属于 ANYI"这件事实，**不是**任何派生计划或门槛；`docs/` 下没有 ANYI 的施工单、蓝图或门槛文档。
- **ANYI 代码派生未启动**：本项目历次施工单都把"修改 ANYI / refrigerant-store 或其他项目"列为明确禁止项，本轮同样未初始化、未克隆、未修改 ANYI 的开工门槛。
- 对派生的三条事实约束：
  1. 线上运行的是 `64bfc56`，**不含** hero 与公开媒体两类修复；若以线上版本为派生基线，会一并继承这两个缺陷。
  2. 本地 HEAD `186fe3b` 含全部修复，但其远端 CI 与独立审阅**都未完成**，也未部署验证。
  3. 多个 P0 安全 Gate（RSG-01 / 02 / 03 Products、RSG-04 Content、RSG-07 部分、RSG-08 整行）仍为 `OPEN`，派生不会自动关闭它们。
- 其余影响在 §2–§5 的"对 ANYI 复用的影响"列逐项标注；无法判断的写"未知"。

---

## 8. 本轮边界声明

- 未运行：tests / typecheck / lint / build / 浏览器 / dev server / CI / 调度器 / 模型审查。
- 未安装依赖，未修改任何应用代码、数据库、媒体、认证或运行器。
- 未重启、未部署、未 commit / push / merge。
- 未初始化或克隆 ANYI，未修改 ANYI 开工门槛。
- 未删除任何测试脚本、历史报告或未提交成果。
- 修改 `CURRENT-STATE.md` 前已备份（会话临时目录 `handoff-backup-20260920/CURRENT-STATE.md.bak`，与修改前内容 SHA-256 一致）。
- 只读 Git 与既有日志的查看**不构成**任何测试或验收结论。

---

## 9. 资料缺口（如实记录）

**本轮没有任何只读任务仍在运行。** 两个只读读取任务的结果如下：

| 任务 | 结果 | 处理 |
|---|---|---|
| Gate / Preflight 状态读取（`RELEASE-SAFETY-GATES.md`、`PRODUCTION-PREFLIGHT.md`） | **完成**，结果已并入 §3 / §4 / §5 | — |
| `CURRENT-STATE.md` 全文（约 12,750 行）已知问题 / 未验证项 / ANYI 提及 的逐行清点 | **失败**（读取任务在中途因 API 连接错误终止，只产出一句进度文字，无可用结果） | 按本轮指示**不新开任务补查** |

**因此存在的缺口：**

1. `CURRENT-STATE.md` **第 1–10,100 行左右的历史段落没有逐行清点**。本报告对该区间的覆盖来自：§0 控制快照全文、文末各模块节（`FINAL-RELEASE-*`、`LITUBO-*` 共约 2,600 行）、以及针对 `ANYI` / `P0`–`P2` / "未解决" / "测试失败" 等关键词的定点检索。早期模块中可能还有未被本报告收录的已知问题或未验证项。
2. 因此 §5 的"已知问题"清单是**目前已收集到的**，不能宣称穷尽。
3. PWS 编号与页面的对应关系、`PWS-02`…`PWS-06` 的实现状态，仓库记录中没有结论，已在 §4A 标为"状态待核实"，本轮不去补查。
4. 本轮未核实线上 SHA（未登录服务器），线上值按 §1.3 的既有记录引用。

**本报告在上述缺口之内是完整的；有缺口的部分已按上表标明，不写成"全部完成"。**

---

## 10. 最终只读 Git 状态

统计时间：**2026-09-20T00:11Z（本机 2026-09-20 08:11）**，`git status --short` 一次，只读。当时 `git rev-parse HEAD` = `186fe3b16f352a3f1fa71336fc9692f65e4b997d`。

| 文件 | 是否被 Git 跟踪 | 是否被修改 | 是否已提交 |
|---|---|---|---|
| `docs/project/CURRENT-STATE.md` | 是（tracked） | 是（`M`，工作区有改动） | **否——本轮改动未提交** |
| `docs/project/LITUBO-STATUS-HANDOFF-NO-TEST-01.md`（本报告） | 否（untracked，`??`） | — | **否——从未提交** |
| 其余 6 个未跟踪项（`README-FIRST.md`、4 个设计 / 施工包目录、`LITUBO_9C-2R_正式施工单.md`） | 否（untracked） | 未改动 | 否 |
| 其他已跟踪文件 | 是 | **无修改**（`M` 行只有 `CURRENT-STATE.md` 一行） | HEAD `186fe3b` 为最后一次提交，本轮未新增提交 |

统计后本报告只做了一次写入以填入本表与 §9，文件的跟踪状态不变（仍为未跟踪、未提交）。本轮全程未执行任何 Git 写操作。

*最后更新：2026-09-20，由 Claude Code 在 LITUBO-STATUS-HANDOFF-NO-TEST-01 收口轮写入（未 commit）。*
