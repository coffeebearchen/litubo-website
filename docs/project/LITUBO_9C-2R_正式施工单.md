# LITUBO 9C-2R 正式施工单

**主题：** Media Folder Registry — 服务端目录治理收口  
**日期：** 2026-09-05  
**授权状态：** 目录策略已由 Jian Chen 确认；允许 Claude 使用既有的本地/测试管理员登录自行即时验收。  
**本施工单不包含：** 产品资料入库、AI Job、Source Snapshot、真实媒体迁移、部署或密码变更。

## 1. 交付目标

完成后，所有通过 LITUBO Nuxt 管理后台写入 `directus_files.folder` 的操作，必须由服务端按**真实 Directus 文件夹树**验证：

`folder UUID + parent chain + full path + operation`

前端仅显示服务端返回的允许目的地，不再以文件夹名称或前端静态白名单作为裁判。文件夹被改名、移动、删除、缺失或父级不匹配时，服务端必须拒绝写入（fail closed），不得猜测替代目录。

这是一项 **9C-2R 媒体目录治理工程**，不是 AI 产品资料导入工程。

## 2. 已冻结的业务策略

| 状态 | 路径 | 行为 |
|---|---|---|
| Active canonical | `home`、`applications`、`company`、`products/xray`、`products/metal-detection`、`products/combination`、`products/checkweigher`、`products/conveyor` | 可作为受控上传和移动目标 |
| Container only | `products`、`resources` | 可浏览；不可直接上传或移动到此处 |
| Legacy — read only | `products/technical-docs`、`resources/case-studies`、`resources/downloads`、`resources/insights`、`company/global-service` | 可浏览；不可作为上传或移动目标；可由人工明确移出到 Active canonical |
| Conflict / frozen | 根目录 `certifications` | 可浏览；不可新写入；不得自动迁移或改名 |
| Planned, not created | `brand`、`resources/manuals`、`resources/certificates`、`test-only` | 当前不创建、不显示为可选目标、服务端一律拒绝 |
| Needs Classification | 当前 `folder = NULL` 的 8 个文件 | 保持未分类；不得自动分类或移动 |

`certifications` 和未来的 `resources/certificates` 不是同一个目录。此任务不得擅自统一、迁移或创建二者。

### `folder = NULL` 的明确规则

- 新上传时，用户明确选择 **Needs Classification** 才可保存为 `folder = NULL`。
- 既有文件的普通 metadata patch、单文件移动和批量移动，不得以 `folder = NULL` 绕过目录策略；本任务不新增“把已有文件退回未分类”的入口。
- 未分类文件可以由人工移动到 Active canonical 目录。

## 3. 不可触碰的边界

1. 不创建任何 Directus 文件夹、collection、字段或权限角色。
2. 不移动、重命名、删除或归档任何现有真实文件/文件夹；不自动处理 8 个未分类文件。
3. 不接入 AI、产品 Draft、产品资料包、Source Snapshot 或外部服务。
4. 不部署、不推送远端、不改密码、不在报告中输出任何账号、密码、Token 或 `.env` 值。
5. 不新建平行文档目录；不创建 `docs/design`、`construction-handoff-v1` 或第二套治理规范。
6. 不修改 `CLAUDE.md`、`docs/product-cms/` 的既有权威文件、`docs/design-reference/approved/`，除非后续另有明确授权。
7. 绝不使用 `git reset --hard`、`git checkout --`、`git clean` 或 `git stash` 来处理工作区。

## 4. 开工前检查（先做，后写代码）

1. 读取：
   - `CLAUDE.md`
   - `docs/project/CURRENT-STATE.md`
   - `docs/project/MASTER-ROADMAP.md`
   - `docs/project/MEDIA-AND-PRODUCT-DATA-GOVERNANCE.md`
   - `docs/project/PHASE-9C-2-MEDIA-LIBRARY-FOUNDATION-SPEC.md`
2. 记录 `git status --short` 与当前 HEAD。已知基线为 `master` / `2f0bac4`，并且下列 9C-2R 工作区改动必须保留并在其基础上继续：
   - `pages/admin/media/index.vue`（modified）
   - `utils/mediaFolderPolicy.ts`（untracked）
3. 先盘点全仓库所有可能写入 `directus_files.folder` 的 Nuxt 服务端路由、上传流程、metadata patch 和批量操作。不得只修一个已知端点。
4. 核对实际 Directus 文件夹树。当前已知为 16 个文件夹；`products/xray` 有 4 个文件、`resources/case-studies` 有 1 个文件、另有 8 个 `folder = NULL`。此前报告对 `products/technical-docs` 的文件数有一处矛盾，必须仅记录核对结果，**不能因该核对移动资料**。
5. 审计普通运营账号是否仍能直接通过 Directus Admin/API 修改 `directus_files.folder`：
   - 本施工单不自行改 Directus 权限；
   - 若存在绕过路径，明确写入最终报告为 **Launch Gate: unresolved**；
   - 不得把“Nuxt API 已保护”描述成“所有 Directus 写入均已保护”。技术 Super Admin 的受控绕过也必须如实说明。

如发现与上述基线无关的脏文件、未知写入入口或数据风险，停止在开工报告阶段，说明事实，不要猜测或清理。

## 5. 实施顺序（不得倒置）

### Step A — 服务端 Folder Registry Resolver（先做）

1. 采用现有代码风格，在 `server/utils/` 建立或重构一个**服务端唯一权威**的 Folder Registry Resolver；最终文件名由仓库惯例决定。
2. V1 不新建 Directus Registry collection。Resolver 每次从真实 Directus 文件夹树解析：
   - `folder_uuid`
   - `parent_chain`
   - `full_path`
   - `policy_state`
   - `allow_upload`
   - `allow_move_target`
3. 策略配置必须使用完整路径，不得只使用 `name`。例如 `products/xray` 与同名的其他位置必须被区分。
4. 提供一个统一的断言/解析入口，供所有 folder write API 调用。它至少区分：新上传、单文件移动/metadata patch、批量移动。
5. 对未知 UUID、同名但父级错误、Legacy、Conflict、Container、Planned、路径不一致、文件夹缺失或解析失败，返回稳定的英文错误代码/信息并拒绝写入。
6. 不要把现有 `utils/mediaFolderPolicy.ts` 的静态名称集合继续当作安全来源；如保留它，只能作为显示类型或由服务端结果派生，不能作为授权依据。

### Step B — 封住所有 Nuxt 写入入口

1. 对开工检查中找到的每一个可写 `directus_files.folder` 的 Nuxt 路由应用同一个 Resolver。
2. 客户端只能提交 folder UUID；服务端不信任客户端传来的名称、路径、canonical 标记或 UI 状态。
3. 当请求没有修改 `folder` 字段时，不应误触发目录校验；当请求明确修改 `folder` 时必须校验。
4. 新上传的 `Needs Classification` 例外必须显式实现；普通 move/patch/batch 不可借 `null` 规避策略。
5. 批量移动必须在写入任何一项前完成整批目标预校验；发现非法请求时整批拒绝，不能出现部分移动。
6. 保持既有 Archive、Restore、Reference Protection 与 403 降级行为。不降低“引用无法确认时安全拒绝归档”的保护。
7. 如既有 lifecycle/audit 结构能够准确记录 folder 变更，可复用；不要为此新增 schema。若无法记录，写入最终的后续建议，不得临时造 collection。

### Step C — 服务端向前端提供已解析的目录状态

1. 优先扩展现有 folder-list API；若其职责不适合，再新增一个窄范围的内部 admin endpoint。
2. 前端获得的每一项必须包含服务端计算的完整路径与可操作状态，至少可区分：Active canonical、Container only、Legacy — read only、Conflict / frozen、Needs Classification。
3. 不生成假目录：`brand`、`manuals`、`certificates`、`test-only` 不存在时不能出现在上传/移动下拉框。若需要解释，只能是不可操作的 Planned 说明，不能伪装成 Directus folder。

### Step D — 修正并收口 Media Library 前端

1. 修复已知桌面 Bug：`.mobile-legacy-hidden { display: none; }` 不得在桌面生效。桌面 1440px 下 Legacy/Read-only 区必须始终可见；手机 375px 下才可按现有折叠交互显示。
2. 前端目标列表必须完全使用服务端返回的 `allow_upload` / `allow_move_target`，不得重新以名称白名单判断。
3. 保留完整路径显示、详情面板“Current path”只读、Needs Classification 视图、引用信息 403 降级等已有 9C-2R 有益改动。
4. 管理后台可见标签以英文为准，例如：
   - `Active destinations`
   - `Legacy — read only`
   - `Conflict — read only`
   - `Needs Classification`
   - `Move to approved folder`
5. 不做新的视觉重设计；本任务只做策略正确性、可见性和响应式修复。

### Step E — 只更新现有权威文档

在实现准确反映后，更新现有文件，而不是创建新规范包：

- `docs/project/MEDIA-AND-PRODUCT-DATA-GOVERNANCE.md`
- `docs/project/PHASE-9C-2-MEDIA-LIBRARY-FOUNDATION-SPEC.md`
- `docs/project/CURRENT-STATE.md`
- `docs/project/MASTER-ROADMAP.md`

文档可用中文说明内部治理；后台 UI 的基线语言仍是英文。文档须写清楚：V1 是服务端 runtime resolver，不是 Directus registry collection；Directus 原生绕过审计的结论；`certifications` 冻结；Planned 目录不自动创建。

## 6. 验收与测试（无固定时间等待）

**禁止：** 15 分钟等待、固定 `sleep`、轮询等候“也许会好”、为了测试改密码或使用真实产品资料。  
**允许：** 服务就绪后立即测试；Claude 使用既有本地/测试管理员登录即时检查；不输出凭据、不修改凭据。上线前由 Jian Chen 统一轮换密码。

### 必须通过的自动化验证

1. Resolver 单元测试：
   - Active canonical UUID + 正确 parent chain 可通过；
   - 相同名称但错误父级不可通过；
   - 未知/伪造 UUID 不可通过；
   - Container、Legacy、Conflict、Planned/缺失路径不可通过；
   - 新上传明确 Needs Classification 可得到 `folder = NULL`；普通 patch/move/batch 的 `folder = NULL` 被拒绝。
2. API 级验证：直接调用每一种 owned folder-write API，确认不能绕过前端写入 Legacy、Conflict、Container、伪造 UUID 或错误路径。
3. 回归：现有 media lifecycle / reference protection 测试、lint、typecheck、build 全部通过。

### 必须完成的即时人工验收

1. 使用既有本地/测试登录进入 Media Library；不做真实文件移动或目录创建。
2. 1440px：Legacy/Read-only 区可见；不存在 ghost destination；完整路径与禁用状态正确。
3. 375px：目录区、筛选、上传/移动入口和禁用状态可用；旧目录按移动端设计折叠而非消失。
4. 把验证截图放到：
   `docs/design-reference/inbox/admin-cms-ai-v1/verification/9c-2r/`
   仅作验收证据，**不得**移动至 `approved/`，不得视为新的视觉母版。

如没有隔离的测试媒体，只可做无保存 UI 检查，并以自动化 API 测试证明允许/拒绝逻辑；绝不能为凑人工正向测试而上传、移动或改写真实资料。

## 7. 提交规则与最终回报

1. 只有在全部测试通过、改动范围核对无误后，建立一个**本地**提交；不 push、不 deploy。建议提交信息：
   `feat(9c-2r): enforce media folder policy server-side`
2. 暂存前复核文件；若发现不属于本施工单的用户改动，不要加入提交，停止并报告。
3. 最终回报必须按以下结构，且不包含任何凭据：
   - Commit hash 与 `git status --short`
   - 修改文件清单及每项目的
   - 所有 folder-write API 的覆盖表
   - runtime Folder Registry 的实际解析结果（UUID 可截短、完整路径与状态必须准确）
   - Directus 原生绕过审计结论（Pass / Launch Gate: unresolved）
   - 自动化命令和结果、1440px/375px 验收截图路径
   - 明确声明：未创建目录、未迁移/删除媒体、未接 AI、未部署、未改密码
   - `CURRENT-STATE.md` / `MASTER-ROADMAP.md` 已如何更新

若任何一项安全校验、构建或目录策略验收失败，不要用临时放宽规则换取通过；保留现状，报告阻塞点和最小修复建议。
