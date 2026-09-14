# LITUBO Admin/CMS 施工总纲 V1.1
# Governing Architecture Charter V1.1

**建立日期：** 2026-09-06（V1）/ 2026-09-06（V1.1 框架补全）
**状态：** 生效中（Active）
**负责人：** 用户（业务决策）/ Codex/GPT（架构与施工单）/ Claude Code（唯一执行者）

---

## A. 宪法级定位与生效规则

### A.1 本文件的性质

本文件是 LITUBO Admin/CMS 当前有效的架构与施工总纲。

**它不授权任何代码、数据、schema、AI、发布或部署操作；它只定义后续施工的方向、边界、优先级、验收和变更规则。**

本文件一旦生效，成为所有 Admin/CMS 施工的上位约束。除非用户明确宣布以下任意一句话：

```text
"框架变更"
"替换原框架"
"修订 Governing Charter"
```

否则，任何普通需求、代码任务、文案任务、视觉任务，都不得改变本总纲定义的方向、优先级、架构边界或母版来源。

### A.2 三方职责

| 角色 | 职责 | 不可自行决定或执行 |
|------|------|------------------|
| **用户** | 业务方向、真实资料确认、视觉母版确认、发布决定、框架变更决策 | 不需判断代码实现细节 |
| **Codex/GPT** | 总体架构、施工单撰写、风险审查、验收与里程碑管理 | 不直接改代码、数据库、生产环境；不代替用户确认业务事实 |
| **Claude Code** | 唯一代码/文档执行者，只在明确施工单范围内修改 `D:\LITUBO-website` | 不改业务规则、不扩展范围、不处理凭证、不 push 或部署 |

### A.3 单执行者规则

Codex/GPT 与 Claude 不得同时修改同一工作树。**Claude Code 是当前唯一实际修改 `D:\LITUBO-website` 的执行者。**

---

## B. 框架锁定与变更协议

### B.1 普通施工不得改变框架方向

若用户没有明确宣布"框架变更 / 替换框架 / 修订 Governing Charter"，不得以普通任务、局部截图、单个页面、文案优化或临时技术便利为理由改变架构方向。

### B.2 变更协议（五步流程）

如需框架变更，必须严格按以下顺序执行：

```text
1. 先做只读影响审计（不改任何代码）；
2. 写出新版本或修订版 Charter；
3. 明确列出被替换的章节、迁移影响和保留内容；
4. 获得用户明确确认；
5. 才能开始改变施工方向。
```

---

## C. 证据与方向优先级

### C.1 事实真相优先级（从高到低）

```text
1. 实际仓库代码 / Git 状态 / Directus schema / 运行服务
2. docs/project/CURRENT-STATE.md
3. docs/project/MASTER-ROADMAP.md 与 CLAUDE.md
4. 系统蓝图、治理文档、施工包（CMS-AI-CONSTRUCTION-PACK-V1）
5. 已确认视觉母版（状态为 CONFIRMED 的图）
6. 历史聊天记录与旧报告
```

### C.2 施工方向优先级（从高到低）

```text
1. 用户明确的框架变更指令
2. 本 Governing Charter
3. 已确认 Construction Pack 与视觉/逻辑母版（CONFIRMED 状态）
4. 单次 Claude 施工单
5. 旧报告、临时推测
```

### C.3 冲突处理规则

出现以下任一情况，Claude 必须**停止施工并报告**，不得猜测、静默改方向、自行选一套资料：

- 资料之间出现相互矛盾；
- 视觉状态不是 `CONFIRMED`（仅 `DRAFT` / `REVIEW` / `SUPERSEDED`）；
- 代码与总纲定义不一致；
- 资料缺失导致无法确定施工边界；
- AI / Import 功能被错误描述为"已完成"。

**严格禁止：** 把文案翻译误报为视觉母版落地；把全局 Media Library 当作产品专属 Media & Resources；把尚未实现的 AI / Import 功能说成已完成。

### C.4 Implementation Blueprint 交叉引用规则

`docs/project/ADMIN-CMS-IMPLEMENTATION-BLUEPRINT-V1.md` 是受本 Charter 约束的完整执行总施工图：

- **Blueprint 不能推翻 Charter；如两者冲突，以 Charter 为准。**
- Blueprint 规定的模块顺序、前置依赖、前后端合同、AI/导入边界和验收要求，构成受 Charter 约束的执行层规则。
- 任何代码施工必须同时满足 Charter 的架构边界 **和** Blueprint 的模块合同；不得只满足其中一方。
- 若发现 Blueprint 与仓库事实（代码、schema、运行服务、Directus 状态）冲突，**先报告事实冲突，不得猜测或静默施工**。
- Claude 每次 Admin/CMS 开工报告须同时引用 Governing Charter V1.1 与 Implementation Blueprint V1，缺一不得开始代码修改。

### C.5a Visual & Data Conformance Register 交叉引用规则

`docs/project/ADMIN-CMS-VISUAL-DATA-CONFORMANCE-REGISTER-V1.md` 是受本 Charter 与 Blueprint 双重约束的执行登记册：

- Register 在权限层级上位于 Blueprint 之下、CURRENT-STATE.md 之上。
- Register 只记录事实映射与验收证据；它不能自行改变架构方向、施工顺序、模块权限或 Charter 定义的决策门控。
- Charter 优先于 Blueprint，Blueprint 优先于 Register。若 Register 内容与 Charter 或 Blueprint 冲突，以 Charter / Blueprint 为准，并立即报告冲突。
- 无对应 Register 条目（含目标路由、共享外壳、数据/API 合同、English-first 范围、DoR 状态）的模块，Claude 不得开始代码施工。
- Register 中可保留的数据/API 必须优先保留；不得因视觉重构而静默破坏既有接口兼容性。
- 当运行事实、仓库事实或用户新决定与 Register 内容冲突时，先报告事实冲突，不得猜测改代码。

### C.5 Decision Gate 命名空间规则

- **Charter Decision Gates（`DG-xx`，无前缀）**：由本 Charter 在 Section M.2 中定义，具有治理级效力；DG-01～DG-16 保持原有编号和业务含义，不得重编。
- **Blueprint Decision Gates（`BP-DG-xx`，含前缀）**：由 Implementation Blueprint V1 Section 12 定义，是执行层实现门控；BP-DG-01～BP-DG-15 仅在 Blueprint 内部使用。
- 两套编号是**完全独立的命名空间**；同一数字（如 DG-10 与 BP-DG-10）指向完全不同的决策内容，不得相互推断。
- Claude 开工报告中列出的 Charter DG-xx 与 Blueprint BP-DG-xx 必须分列，不得合并；任何跨命名空间映射须由 Codex 显式建立并经用户确认后方可引用。

---

## D. 母版登记与追溯表

> 不得复制图片；只引用原始路径。视觉状态不是 `CONFIRMED` 时，对应代码施工不得开始。

| 类型 | 精确路径 | 负责范围 | 当前状态 | 后续施工引用规则 |
|------|---------|---------|---------|----------------|
| Construction Pack | `docs/product-cms/CMS-AI-CONSTRUCTION-PACK-V1/` | 业务逻辑、数据治理、施工顺序、安全边界 | 已安装，仓库事实优先 | 每次施工前必读对应章节 |
| Visual Index | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/README_VISUAL_INDEX.md` | 所有 Admin 页面视觉的唯一登记入口 | 生效中 | 新图必须先在此登记 |
| ADM-02（Product Center 全部产品） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-02__product-center__all-products__desktop-reference__v01.png` | Product Center 主列表页 | **DRAFT — 不可开始正式代码施工** | 用户确认为 CONFIRMED 后方可施工 |
| ADM-02a（Product Center 分类视图） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-02a__product-center__category-list__desktop-reference__v01.png` | Product Center 分类过滤视图 | **DRAFT — 不可开始正式代码施工** | 同上 |
| ADM-03（规格工作台） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-03__product-workspace__specifications__desktop-reference__v01.png` | Product Workspace — 规格 | **DRAFT** | 同上 |
| ADM-04（媒体与资源） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-04__product-workspace__media-resources__desktop-reference__v01.png` | Product Workspace — 媒体 | **DRAFT** | 同上 |
| ADM-05（页面内容） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-05__product-workspace__page-content__desktop-reference__v01.png` | Product Workspace — 内容 | **DRAFT** | 同上 |
| ADM-06（关联） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-06__product-workspace__relations__desktop-reference__v01.png` | Product Workspace — 关联 | **DRAFT** | 同上 |
| ADM-07（SEO 与多语言） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-07__product-workspace__seo-locales__desktop-reference__v01.png` | Product Workspace — SEO | **DRAFT** | 同上 |
| ADM-08（来源与历史） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-08__product-workspace__sources-history__desktop-reference__v01.png` | Product Workspace — 来源与审计 | **DRAFT** | 同上 |
| 逻辑参考图 01 | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/01_single_product_dossier_workbench.png` | 单品号 Dossier 工作台逻辑与层级 | **DRAFT（流程参考）** | 逻辑参考使用；正式施工仍须 CONFIRMED 桌面图 |
| 逻辑参考图 02 | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/02_multi_model_import_ai_review_queue.png` | 多品号导入与逐项审核队列逻辑 | **DRAFT（流程参考）** | 同上 |
| CURRENT-STATE evidence | `docs/project/CURRENT-STATE.md` | 已实施事实的唯一记录 | 持续更新 | 每次施工前必读 |

### D.2 生效的框架决定（Framework Decisions）

框架决定是由用户明确确认、写入本 Charter 的正式授权记录。框架决定中的 `USER-CONFIRMED FOR IMPLEMENTATION` 与视觉母版原始登记的 `CONFIRMED` 状态具有同等施工效力。

#### FD-001 — User Confirmation of Admin Visual & Logic Masters（视觉与逻辑母版施工授权确认）

| 项目 | 内容 |
|------|------|
| **决定编号** | FD-001 |
| **决定名称** | User Confirmation of Admin Visual & Logic Masters |
| **日期** | 2026-09-06 |
| **状态** | **Effective / 生效** |
| **授权者** | 用户 |

**被确认的母版（范围）：**

- `ADM-02`：Product Center — 全部产品列表
- `ADM-02a`：Product Center — 分类视图
- `ADM-03 ～ ADM-08`：Product Workspace 各子标签（规格 / 媒体 / 内容 / 关联 / SEO / 来源历史）
- 逻辑参考图 01：`logic-references/01_single_product_dossier_workbench.png`
- 逻辑参考图 02：`logic-references/02_multi_model_import_ai_review_queue.png`

**重要区分（必须准确记录，不得修改原始资料包状态）：**

```text
原始资料包中保留的 DRAFT 状态，描述的是资料包自身的原始登记状态。
不得被修改、覆盖或伪造为其他状态。

用户已在 2026-09-06 明确确认，上述资料是当前 LITUBO Admin/CMS 的施工方向。
因此，本 Charter 内上述母版的 Implementation Authority 状态为：
USER-CONFIRMED FOR IMPLEMENTATION。

该确认不代表 AI、导入、真实资料写入或发布已经获授权；
它仅授权后续按已锁定顺序（Charter J 节）进行架构和界面施工。
```

**施工门槛（FD-001 生效后）：**

```text
可施工的母版必须满足以下任一条件：
- 原始状态为 CONFIRMED；或
- 在 Governing Charter 中有明确的 USER-CONFIRMED FOR IMPLEMENTATION 框架决定（如 FD-001）。

其他 DRAFT、历史、未确认或冲突资料仍不可驱动代码施工。
```

**明确边界：**

- `ADM-02 / ADM-02a` 是**下一阶段 Product Center 的视觉施工依据**（J-2）；
- `ADM-03 ～ ADM-08` 是**后续 Product Workspace 的视觉施工依据**（J-4，在 J-2 完成后）；
- 逻辑参考图 `01 / 02` 是后续 AI 工作流的逻辑依据；**不代表 AI 功能现在开始开发**；
- 全局 Media Library（ADM-12）**不得等同于**产品专属 ADM-04；
- 施工顺序仍严格按照 Charter J 节执行，不因本确认而跳步。

#### FD-002 — Master Authority & Responsive Adaptation（视觉母版权威与响应式适配裁定）

| 项目 | 内容 |
|------|------|
| **决定编号** | FD-002 |
| **决定名称** | Master Authority & Responsive Adaptation |
| **日期** | 2026-09-06 |
| **状态** | **Effective / 生效** |
| **授权者** | 用户 |
| **关系** | 细化 FD-001；不修改、不撤销 FD-001 |

**背景：** V-0.5.1 只读审计发现视觉资料分属两个独立且不一致的资料包，并记录了五项事实冲突（CF-1 ～ CF-5）。FD-002 是用户对这些冲突的正式裁定。

**裁定内容（七条，须原样保留其含义）：**

```text
1. 下列两张 VM1 文件是 J-2 Product Center 的主要实施视觉依据：
   docs/design-reference/CMS-AI-VISUAL-MASTER-V1/admin/desktop-1440/LITUBO_CMS_ADM-02_Product-Center__default__desktop-1440__v01.png
   docs/design-reference/CMS-AI-VISUAL-MASTER-V1/admin/mobile-375/LITUBO_CMS_ADM-02_Product-Center__default__mobile-375__v01.png

2. docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ 中的图片保留为
   用户确认的视觉方向参考；但其 README 明确说明它们不是独立代码规格，
   因此不得单独决定路由、数据/API、交互或移动端结构。

3. 后台所有可见 UI 以 English-first 为准。母版中的中文只作为信息层级、布局
   和视觉关系参考，不得照抄为可见中文文案。

4. J-2 当前右侧功能区采用 Product Control。AI 批量导入属于未来 IMP-01，
   目前不得实现、不得伪造可用状态、不得展示假 AI 数据。

5. PC-01 Product Center 与 PC-02 Category Context 的 375px 行为采用
   VM1 ADM-02 mobile-375 的卡片列表原则：不得出现横向滚动桌面表格。

6. 其余 Product Workspace 页面没有已批准的独立移动端适配合同；在每个模块的
   移动端适配合同获得 Codex 施工单授权前，不得施工。

7. 此决定细化 FD-001，但不修改、不删除、不伪造任何原始资料包中的
   DRAFT、README 或历史状态。
```

**FD-002 的作用范围（穷尽列举）：**

FD-002 **只**解决以下五件事，不涉及其他任何主题：

| 范围 | 裁定 |
|------|------|
| 视觉文件权威 | VM1 与 P2 两套资料包的权威等级与可使用范围 |
| English-first | 可见 UI 一律英文，优先于母版图中的中文 |
| 右侧功能区 | J-2 采用 Product Control，非 AI 批处理入口 |
| 移动端适配 | PC-01 / PC-02 采用卡片列表原则；其余模块阻塞 |
| 命名空间 | 工程模块 ID 与 Source Asset ID 取代模糊的 `ADM-xx` 编号 |

**FD-002 明确不授权：**

```text
不授权 AI 功能（AI-01 仍未开始）。
不授权批量导入（IMP-01 仍未开始）。
不授权真实产品数据写入。
不授权任何内容发布。
不授权跳过 Charter J 节施工顺序。
不授权 origin/master 推送。
```

**权威关系不变：**

Charter 仍高于 Blueprint；Blueprint 仍高于 Register。FD-002 作为 Charter 内的框架决定，与 FD-001 同级，均属于「用户明确决定」这一最高事实层级。

**原始资料包状态保持不变：**

```text
VM1 README_VISUAL_INDEX.md 中 ADM-02 行的 DRAFT 标记：保持不变。
P2 inbox/admin-cms-ai-v1/README.md 的全部声明：保持不变，继续有效。
两套资料包全程保持 ?? 未跟踪，不被修改、改名、暂存或提交。
```

FD-002 不改写任何原始文件；它只在治理文档中记录用户如何使用这些文件。

#### FD-003 — Context-Efficient Execution（高效分层阅读规则）

| 项目 | 内容 |
|------|------|
| **决定编号** | FD-003 |
| **决定名称** | Context-Efficient Execution |
| **状态** | **Effective / 生效** |
| **授权者** | 用户 |
| **日期** | 2026-09-06 |
| **关系** | 独立于 FD-001 / FD-002；不修改、不撤销二者 |

**规则（三层，须准确表达）：**

```text
A. 新模块、框架/母版/数据合同/Gate 变化、新 Claude Session 接手大模块、
   或推送 origin/master 前的最终验收：
   必须完整读取当前治理文件（CLAUDE.md 七步阅读顺序全套）与该模块适用母版。

B. 同一模块的后续子任务：
   仅读取 CLAUDE.md、CURRENT-STATE.md、该模块 Blueprint/Register 章节、
   适用母版、当前 Codex 施工单，以及相关代码/API/types/tests。

C. 纯机械验证（重跑检查、核对 diff）：
   仅读取当前施工单、相关文件、diff 与测试输出。
```

**不可跳过的底线：** 任何层级都不得跳过当前模块的 Gate、视觉母版、数据/API 合同、English-first 规则、验收条件或明确的不触碰范围——层级只降低"要重复读多少"，不降低"要满足什么"。Codex 当前施工单可以提高阅读要求（例如把 B 级任务临时提升为 A 级），但不得降低当前任务本应满足的读取要求。

**作用范围（穷尽列举）：** FD-003 只优化重复阅读成本，不改变 Charter、Blueprint、Register 三者的权威关系，不降低任何代码或验收标准，不构成框架变更，不授权跳过 J 节施工顺序或任何 Decision Gate。

#### FD-004 — Risk-Proportionate AI MVP Delivery（AI MVP 风险比例与最小可用闭环原则）

| 项目 | 内容 |
|------|------|
| **决定编号** | FD-004 |
| **决定名称** | Risk-Proportionate AI MVP Delivery |
| **状态** | **Effective / 生效** |
| **授权者** | 用户 |
| **日期** | 2026-09-09 |
| **关系** | 独立于 FD-001 / FD-002 / FD-003；不修改、不撤销三者 |

**目的：** FD-004 **不降低基本安全**。它存在的原因是：当前 LITUBO 单产品 AI 填表 MVP 曾被不成比例的安全工程与基础设施工作拖偏方向。本决定的作用是把工程投入重新对齐到当前真实业务风险，使第一个可用闭环能够真正跑通。

##### FD-004.1 当前 AI MVP 的业务性质

当前 LITUBO AI MVP：

- 用于工业设备产品资料整理；
- 用于后台 Draft 参数、功能等内容的辅助填写；
- 当前主要对象是**单一设备 / 单一产品**；
- 当前首要目标是 Specifications、Functions 等结构化资料；
- **不属于**机器安全控制系统；
- **不属于**医疗、金融等高风险自动决策系统。

因此，工程复杂度、安全措施与测试深度**必须与当前实际业务风险成比例**。不得为了理论上的完美安全，无限扩大当前 MVP 的技术范围。

##### FD-004.2 当前必须守住的核心边界（P0）

以下问题属于当前阶段真正的 **P0 / Blocker**：

1. 跨 `product_id` / `product_code` 混入其他型号的资料；
2. AI 把未知、缺失或无可靠来源的技术参数**猜测后当作真实事实**；
3. API Key、Token、Cookie、密码等凭证泄露到浏览器、日志、Git 或报告；
4. 未经明确人工 Accept / Edit 确认，AI 内容**直接写入**产品资料；
5. AI 自动 Published、自动公开、自动发送客户或自动发布外部渠道；
6. 造成**不可恢复**的正式产品数据或正式媒体破坏；
7. 明显可能造成失控 AI API 费用的自动循环、无限重试或重复调用。

这些硬边界继续保持。**FD-004 不取消**以下任何一项：

- one-product isolation（单产品隔离）；
- human review（人工审核）；
- Draft-only（仅写草稿）；
- no auto publish（不自动发布）；
- credential protection（凭证保护）；
- TEST ONLY 保护；
- Media Library 作为单一媒体源；
- 不猜测真实技术参数。

##### FD-004.3 问题分级（P0 / P1 / P2）

FD-004 生效后，AI MVP 相关问题**必须先分类，再决定是否阻塞**：

| 级别 | 含义 | 处置 |
|------|------|------|
| **P0 / Blocker** | 会直接破坏 FD-004.2 的核心边界 | 当前模块**必须停止** |
| **P1 / Fix before beta** | 不造成上述核心安全问题，但会明显影响真实单产品 Beta 的可靠使用 | 在真实 Beta **之前**解决 |
| **P2 / Backlog** | 边缘情况、规模化问题、理论 hardening、未来基础设施增强 | **不得自动阻塞**当前 AI 填表闭环 |

**明确写入：不得把所有技术缺陷自动升级为 blocker。** 一项缺陷是否阻塞，取决于它是否触及 FD-004.2 列举的核心边界，而不是取决于它在理论上是否是一个缺陷。

##### FD-004.4 默认不阻塞当前 MVP 的事项

除非**仓库事实证明**它们已经直接触发 FD-004.2 的某一项 P0，以下事项默认属于后续 hardening / backlog：

- Redis；
- 分布式 rate limiting；
- 完美多实例一致性；
- 企业级共享 quota 系统；
- 所有异常必须拥有最理想的 HTTP 状态语义；
- 为每一种文件格式建立独立解析服务或容器；
- 首个单产品 Beta 前清零全部 npm audit 项；
- 为未来大规模部署提前建设当前用不到的基础设施；
- 与当前单产品 Draft 填表真实用户流程没有直接关系的理论攻击面强化；
- 为极低概率边缘情况进行大规模重构。

**注意：这不是说这些问题永远不处理。** 它们应进入 backlog，在真实使用、上线准备或规模增长时再处理。

##### FD-004.5 当前实现原则

**优先复用**现有资产，而不是新建平行体系：

- Product Workspace；
- Specifications；
- Media & Resources；
- Sources & Evidence；
- 当前 Admin API；
- 当前 Directus 数据结构。

在满足 FD-004.2 核心边界的前提下，选择：

```text
最小实现 + 最少返工 + 可理解 + 可测试 + 能真实使用
```

而不是：

```text
理论最完美 + 基础设施最复杂 + 尚未需要的规模化设计
```

##### FD-004.6 当前第一 AI 产品闭环

当前正式优先目标**固定**为：

```text
Current single product Draft
→ Select already-linked sources
→ AI proposes Specifications / Functions
→ Human Accept / Edit / Reject
→ Apply accepted items to the same product Draft
→ Stop
```

完成该闭环之后，**先进行单产品真实 Beta**，再根据真实使用结果决定是否推进：PDF 恢复、Excel、更多 AI Targets、Page Content、FAQ、SEO、批量导入、多实例成本控制、更复杂的安全基础设施。

**不得在第一个闭环之前，因为这些未来能力而继续扩大范围。**

##### FD-004.7 FD-004 不构成的授权

FD-004 **不授权**：

- 部署；
- push / merge `origin/master`；
- 填写真实 AI API Key；
- 调用真实收费 AI；
- 自动发布；
- 自动发送；
- 修改生产环境；
- 绕过人工审核；
- 删除正式资料；
- 绕过既有身份认证。

**作用范围（穷尽列举）：** FD-004 只规定"当前单产品 AI MVP 阶段，什么算阻塞、什么算 backlog、工程投入应与何种风险成比例"。它不改变 Charter、Blueprint、Register 三者的权威关系，不降低 FD-004.2 列举的任何核心边界，不解除任何 Decision Gate，不授权跳过 J 节施工顺序。

---

## E. 目标系统架构与前后端联动

### E.1 技术栈（锁定）

```text
Nuxt 3 + Vue 3 + TypeScript + Vite + Nitro（SSR/hybrid）
  → Nuxt Server /api/admin/* — 受控 BFF / Adapter 层，唯一权限、状态机、AI 编排、导入门禁
  → Directus 11 + PostgreSQL 16 — CMS 数据、媒体、权限、Revision 底座
  → Nuxt Public Frontend — 仅通过受控 Server 层读取已发布内容
  → Docker Compose + Nginx — 本地与生产部署基础
  → Cloudflare Free — DNS、TLS、缓存、基础防护（不是第二个应用服务器）
```

### E.2 核心边界规则

- 公开前台不能直接自由写 CMS；
- 浏览器不能直接获得通用 Directus 写权限；
- Admin API 保持认证（httpOnly cookie）、角色、CSRF 与服务端校验；
- Directus 是媒体与结构化数据底座；
- 全局 Media Library 保存可复用资产（UUID 引用）；
- 产品只保存资产引用、角色、顺序、上下文 ALT/Caption，不复制正式文件；
- Sources（来源记录）、媒体、产品、审核、发布各有独立职责；
- 不因视觉重构而绕开既有认证、权限、发布边界。

### E.3 系统关系图（文字版）

```text
访客 → Nuxt 公开前台 → Nitro 服务层 → Directus CMS + Media Library → PostgreSQL
管理员 → Nuxt Admin 后台 → Nitro 服务层（/api/admin/*）
Nitro 服务层 → AI 编排与任务 Worker（待实现，须单独授权）
Nitro 服务层 → 表单 / HubSpot 适配层
```

### E.4 系统域所有权（Data Domain Ownership）

Admin CMS 分四个功能域，各有独立职责边界：

| 功能域 | 主要职责 | 核心数据 | 不可越界 |
|--------|---------|---------|---------|
| **Product Center** | 产品记录、规格、生命周期、完整度计算 | `products`、`product_categories`、`product_spec_*`、`product_faqs` | 不直接拥有媒体文件；不管理 Content Center 内容的发布（产品页内容模块 `product_sections` / `product_section_items` 仍归 Product Workspace，见 D-031） |
| **Media Library** | 媒体 UUID 唯一资产、文件治理、文件夹管理、归档 | `directus_files`、`media_file_lifecycle`、Folder Registry | 只负责文件存储与引用；不复制文件到产品 |
| **Content Center** | 统一内容中心（V1 内容类型：Technical Article、Application / Solution、Case Study、Resource / Download、News）；内容 Draft、结构化内容、SEO / 多语言、人工发布 | 内容存储由 `CONTENT-CENTER-BLUEPRINT-01` 定义；`posts`、`site_content` 为遗留结构，须 Blueprint 盘点，不预设归属 | 不拥有产品事实，不以 `product_sections` / `product_section_items` 作为内容存储；只通过 Relations 引用产品；媒体只引用 Media Library UUID；AI 只 Apply 到当前 Content Draft，不得发布；按 D-031 能力型 Gate 推进，不以 M4 / M5 字面排期 |
| **Settings** | 角色、规则、站点设置、审计日志、未来 AI 配置 | `site_settings`、`site_social_links`、角色/权限 | 不管理具体产品或媒体数据 |

**关键边界声明（不可违反）：**

```text
全局 Media Library ≠ 产品专属 Media & Resources 工作台；
产品只能引用媒体文件（UUID），不能复制或拥有物理文件；
Nuxt Server/BFF 层是 Admin API、认证、权限、审计与业务规则的唯一执行边界；
Directus 是数据存储、媒体治理与权限基础设施，不是前端业务逻辑层；
不得在 Directus Admin UI 直接操作业务数据绕过 Nuxt BFF 层校验。
```

### E.5 前台与后台联动合同

**后台职责：**
- 建立、审核和发布合格的结构化产品数据；
- 控制产品生命周期状态（draft → review → published → archived）；
- 确保媒体、来源、规格、内容模块等子记录的完整性与引用合法性；
- 管理角色与权限，记录审计日志。

**前台准入条件（同时满足才可读取并渲染）：**

```text
1. status = published；
2. seo_noindex = false（仅 true 时 noindex，不禁止渲染，但 sitemap 排除）；
3. product_code 存在（发布门禁已确认）；
4. 对应语言字段存在且非空（多语言规则）；
5. 请求来自 Nuxt Server（不是浏览器直接访问 Directus）。
```

**以下内容绝对不得出现在公开前台：**

```text
- status ≠ published 的任何产品数据；
- product_source_records（来源证据）的任何字段；
- 内部标识字段（review_notes、internal_description 等）；
- TEST ONLY 数据（product_code 含 TEST 或 ID=3 测试产品）；
- admin_at / admin_rt cookie；
- AI 建议版本（Candidate）或未审核内容。
```

**发布、撤回与更新后的前台行为：**

| 操作 | 前台行为 |
|------|---------|
| review → published | 产品列表出现、详情页 200、sitemap 收录 |
| published → draft（撤回）| 产品列表消失、详情页 404、sitemap 排除 |
| 字段修改后未重新发布 | 前台不变（仍显示旧发布版本内容） |

**API 兼容、缓存与降级：**
- 前台读 CMS 的 Nuxt API 必须保持向后兼容（不因 Admin 重构而破坏现有 slug / category 路由）；
- Directus 不可用时前台返回 503，不暴露内部错误信息；
- SEO（canonical、hreflang、noindex）责任归 Nuxt 服务层，不由 Directus 直接控制。

---

## F. Admin 信息架构与页面合同

### F.1 当前已实现页面清单（如实记录，不夸大）

| 路由 | 页面文件 | 当前实现状态 | 是否符合 ADM 目标 |
|------|---------|------------|-----------------|
| `/admin/login` | `pages/admin/login.vue` | 认证登录，JWT cookie，SSR 302 保护 | 满足需求 |
| `/admin/` | `pages/admin/index.vue` | 跳转或简单 Dashboard | 基础，待扩展 |
| `/admin/products` | `pages/admin/products/index.vue` | 简单 Tab + 表格（All/Draft/In Review/Published/Archived）；无缩略图、无 Readiness、无分类侧栏、无 Product Control 面板 | **与 ADM-02 有显著差距** |
| `/admin/products/new` | `pages/admin/products/new.vue` | ProductBasicForm（产品创建表单） | 基础功能存在，非 Dossier 结构 |
| `/admin/products/[id]` | `pages/admin/products/[id]/index.vue` | 基础信息编辑（name/slug/category/product_code 等） | 部分功能，非完整 Dossier Shell |
| `/admin/products/[id]/specs` | `pages/admin/products/[id]/specs.vue` | 规格组与规格项 CRUD | 有基础实现；与 ADM-03 视觉有差距 |
| `/admin/products/[id]/content` | `pages/admin/products/[id]/content.vue` | 页面内容 Sections 编辑 | 有基础实现；与 ADM-05 视觉有差距 |
| `/admin/products/[id]/media` | `pages/admin/products/[id]/media.vue` | 产品媒体关联（从 Media Library 选择） | 有基础实现；与 ADM-04 视觉有差距 |
| `/admin/products/[id]/faq` | `pages/admin/products/[id]/faq.vue` | FAQ CRUD | 有基础实现 |
| `/admin/products/[id]/seo` | `pages/admin/products/[id]/seo.vue` | SEO 字段编辑 | 有基础实现；与 ADM-07 有差距 |
| `/admin/products/[id]/preview` | `pages/admin/products/[id]/preview.vue` | 产品预览 | 有基础实现 |
| `/admin/media` | `pages/admin/media/index.vue` | 全局 Media Library（上传/归档/恢复/引用检查/文件夹管理） | **Media Library 基础已实现**；与 ADM-12 视觉差距待审计 |
| `/admin/settings` | `pages/admin/settings.vue` | 网站设置（联系信息、社交链接、安全面板） | 基础已实现 |

### F.2 尚未实现的页面（均须按 ADM 目标施工）

| ADM ID | 页面 | 状态 |
|--------|------|------|
| ADM-02（重构） | Product Center — 全部产品（含缩略图、Readiness、Product Control 面板、分类侧栏） | 未按母版实现 |
| ADM-02a（新增） | Product Center — 分类视图 | 未实现 |
| Product Workspace Shell | 统一 Dossier Shell（顶部面包屑/状态/操作栏 + 标签导航） | 未实现；当前子页面是独立路由而非统一 Shell |
| ADM-08 | Sources & History（来源证据面板 + 审核历史） | 未实现 |
| ADM-09–11 | Import Center（多型号工作簿导入 + 映射 + 逐项队列） | 未实现 |
| ADM-12（视觉对齐） | 全局 Media Library 视觉优化（功能已实现，与 ADM-12 目标视觉待对比） | 功能存在，视觉未验收 |
| ADM-13 | 媒体详情与全局引用 | 未实现（目前在媒体列表侧面板处理） |
| ADM-14–15 | AI 指挥台 + AI 单次任务详情 | 未实现 |
| ADM-16–17 | 询盘列表 + 技术匹配详情 | 未实现 |
| ADM-18–19 | 设置 — Schema/词典/Profile + 角色/语言/AI Policy | 未实现 |

### F.3 每页合同（当前需施工的优先页面）

#### Global Admin Shell（`layouts/admin.vue`）

- **用户目标：** 统一导航、用户信息、移动端汉堡菜单
- **对应母版：** ADM-02 左侧栏结构（DRAFT，已作参考；最终须 CONFIRMED 图）
- **当前代码状态：** 已有固定左侧栏（Product Center、Content Center disabled、Media Library、Settings）；移动端抽屉已实现；`Sign out` 按钮已英文化
- **决策：** 保留并按 ADM-02 CONFIRMED 后对齐；不因重构破坏认证和 SSR 保护
- **不可触碰：** httpOnly cookie 认证机制、SSR 302 重定向、Admin Auth 中间件

#### Product Center — ADM-02（`pages/admin/products/index.vue`）

- **用户目标：** 全局产品列表；筛选分类/状态/完整度；快速查看产品摘要；Product Control 侧面板
- **对应母版：** `ADM-02` 参考图（**DRAFT，不可开始正式施工**）
- **当前代码状态：** 简单 Tab 过滤 + 表格；无缩略图、无 Readiness 进度条、无 Product Control 面板、无分类侧栏
- **决策：** 重构为按 ADM-02 CONFIRMED 目标实现；先不改，等视觉确认
- **后端 API：** `GET /api/admin/products`（已有）；需扩展以支持分类过滤、完整度字段
- **验收条件：** ADM-02 视觉母版获得用户 CONFIRMED 确认后，1440px + 375px 全通过

#### Product Category View — ADM-02a

- **用户目标：** 查看单一分类内所有产品；分类健康度摘要；分类层级导航
- **对应母版：** `ADM-02a` 参考图（**DRAFT，不可开始正式施工**）
- **当前代码状态：** 未实现
- **决策：** 新增；等 ADM-02a CONFIRMED 后施工

#### Product Workspace Shell / Product Control

- **用户目标：** 单一产品的统一工作台入口；顶部显示产品名、product_code、当前状态、发布操作；左侧或顶部标签导航至各子区域
- **对应母版：** 逻辑参考图 01（DRAFT 流程参考）；正式施工须 ADM-03～08 CONFIRMED 图
- **当前代码状态：** 各子页面独立存在（`/[id]/specs`、`/[id]/content` 等），无统一 Dossier Shell；`ProductBasicForm` 存在，作为 Basic Info 编辑器
- **决策：** 新增 Product Workspace Shell 作为共用框架；原各子页面内容迁入 Shell 标签页
- **不可触碰：** product_code 一旦设置不可修改的业务规则；发布状态机 `draft → review → published → archived`

#### Specifications — ADM-03

- **对应母版：** `ADM-03` 参考图（DRAFT）
- **当前代码状态：** `pages/admin/products/[id]/specs.vue` — 规格组/项 CRUD 已有基础实现
- **决策：** 保留数据层（API 和 schema 不变）；等 ADM-03 CONFIRMED 后重构 UI 进入 Workspace Shell

#### Product Media & Resources — ADM-04

- **对应母版：** `ADM-04` 参考图（DRAFT）
- **当前代码状态：** `pages/admin/products/[id]/media.vue` — 产品媒体关联已有基础实现；从全局 Media Library 选择文件
- **决策：** 保留数据层；等 ADM-04 CONFIRMED 后重构 UI；**全局 Media Library ≠ 产品专属 Media & Resources**，两者明确分离

#### Page Content — ADM-05

- **对应母版：** `ADM-05` 参考图（DRAFT）
- **当前代码状态：** `pages/admin/products/[id]/content.vue` — Section 编辑基础已有
- **决策：** 保留数据层；等 ADM-05 CONFIRMED 后重构 UI

#### Relations — ADM-06

- **对应母版：** `ADM-06` 参考图（DRAFT）
- **当前代码状态：** 未实现独立关联管理页面
- **决策：** 新增；等 ADM-06 CONFIRMED 后施工

#### SEO & Locales — ADM-07

- **对应母版：** `ADM-07` 参考图（DRAFT）
- **当前代码状态：** `pages/admin/products/[id]/seo.vue` — SEO 基础字段已有
- **决策：** 保留数据层；等 ADM-07 CONFIRMED 后重构 UI 并增加 Locale 管理

#### Sources & History — ADM-08

- **对应母版：** `ADM-08` 参考图（DRAFT）
- **当前代码状态：** `product_source_records` 表已存在，API 已有（GET/POST/archive）；无前端管理界面
- **决策：** 新增前端界面；等 ADM-08 CONFIRMED 后施工

#### Global Media Library（独立，不等同 ADM-04）

- **对应母版：** ADM-12（DRAFT）
- **当前代码状态：** `pages/admin/media/index.vue` — **已实现完整基础功能**（上传/归档/恢复/引用检查/Folder Registry/文件夹管理/批量移动）；UI 已英文化
- **决策：** 保留，等 ADM-12 CONFIRMED 后做视觉对齐优化

#### Content Center / Settings

- **Content Center：** 模块形态已冻结（`docs/content-cms/CONTENT-CENTER-MODULE-FREEZE-V1.md`，D-031）。按能力型 Gate 推进：Approved Visual → Module Freeze → Blueprint → 明确实施授权 → Draft / Public 安全 Gate → 生产发布 Gate。视觉、Freeze、Blueprint 与 Draft-only 实现可在真实产品生产发布之前推进；生产发布与公开暴露仍受 J-10 及相关 Gate 约束。侧边栏入口当前仍禁用，未来只在现有 Admin Shell 中启用。
- **Settings：** `pages/admin/settings.vue` — 基础已实现；等 ADM-18/19 CONFIRMED 后扩展

### F.4 不可偷跑规则（No Premature Implementation）

```text
每个模块施工时，必须同时实现：
真实数据 + 真实 API + 完整交互 + 错误态 + 空态 + 响应式
不得只实现以下任意一项就宣称模块"完成"：
- 仅添加菜单项或路由（无页面内容）
- 仅做静态 HTML / 假数据展示
- 仅做视觉框架（无 API 对接）
- 仅做 API（无对应前端界面）
- 仅做桌面端（不含 375px 响应式）

每个模块的施工单必须包含：
- 对应的 ADM 视觉母版确认状态
- 数据/API 合同引用（Section G.4）
- 保留/重构/新增/缺失 判定（Section I）
- Open Decision Gate 检查（Section M.2）
- 验收标准（含空态/错误态/两个断点）
```

---

## G. 数据、状态、发布与人工控制合同

### G.1 产品生命周期（固定，不可变更）

```text
draft → review → published → archived
```

- `published` 是唯一进入公开 API、前台详情页、sitemap 的状态；
- 发布 / 撤回必须经过管理员与服务端控制；
- Draft、AI 建议、私有来源资料绝不进入公开路由或搜索引擎；
- 已发布内容的实质修改必须创建新 Revision Draft，线上保留旧版本直至新版审核通过；
- 真实产品、媒体、来源资料不因测试或视觉开发被修改；
- **ID=3 TEST ONLY Draft 不得被当成真实产品或发布**。

### G.2 目标数据关系

```text
Product（product_code 唯一）
  ↔ Product Category
  ↔ Product Revision（draft/review/published/archived）
       ↔ Product Media / Resource References（products_files，UUID 引用）
       ↔ Product Source Records / Evidence（product_source_records）
       ↔ Product Page Modules（product_sections + items）
       ↔ Product Specifications（product_spec_groups + items）
       ↔ Product FAQ（product_faqs）
       ↔ Product SEO Fields
       ↔ Review / Audit History（待实现）
```

**待审计 / Decision Gate（以下关系尚未确认，施工前须先与用户确认）：**
- Product Family（系列分组）的具体 schema 字段与 CONFIRMED 状态
- Relations（关联产品 / 应用场景）的完整数据模型
- Source Snapshot 的冻结机制（目前 `product_source_records` 存在但无 snapshot 版本）
- Revision 版本历史（目前产品无 `revision_no` / `superseded_by` 字段）

### G.3 已有 API 范围（如实记录）

```text
POST   /api/admin/auth/login
POST   /api/admin/auth/refresh
POST   /api/admin/auth/logout
GET    /api/admin/auth/me
GET    /api/admin/products
POST   /api/admin/products
GET    /api/admin/products/[id]
PATCH  /api/admin/products/[id]
GET    /api/admin/products/[id]/sections
POST   /api/admin/products/[id]/sections
PATCH  /api/admin/products/[id]/sections/[sid]
DELETE /api/admin/products/[id]/sections/[sid]
GET    /api/admin/products/[id]/specs
POST   /api/admin/products/[id]/specs
...（完整清单见 server/api/admin/products/）
GET    /api/admin/products/[id]/sources
POST   /api/admin/products/[id]/sources
POST   /api/admin/products/[id]/sources/[sourceId]/archive
GET    /api/admin/media
POST   /api/admin/media/upload
PATCH  /api/admin/media/[fileId]
POST   /api/admin/media/[fileId]/archive
POST   /api/admin/media/[fileId]/restore
GET    /api/admin/media/[fileId]/references
POST   /api/admin/media/batch-move
GET    /api/admin/settings
PATCH  /api/admin/settings
```

### G.4 产品数据与 API 合同（Data & API Contracts）

**施工原则：先审计、后编码。** 每份代码施工单必须引用下表对应的数据/API 合同，不得先做视觉再猜数据结构。

#### 产品—媒体（products_files）

```text
字段：file_id（FK→directus_files）、file_role（枚举，11 值，DG-12 确认）
      sort（整数）、enabled（boolean）
      alt_en/es/pt（多语言 alt）、caption_en（说明文字）
      language（语种限制）、version_label（版本标签）、file_date（资料日期）

规则：
- 产品只存 UUID 引用，不复制文件；
- file_role 枚举须在 ADM-04 施工前与用户确认（DG-12）；
- alt/caption 是产品上下文专属，Media Library 端不直接管理；
- enabled=false 的媒体不出现在公开前台；
- 引用保护：有产品引用的媒体文件不可归档，须先解除引用。
```

#### 产品—来源（product_source_records）

```text
字段：product_id、source_file_id（FK→directus_files，必填）
      source_locator（文件内位置，非独立可溯源标识）
      raw_excerpt（来源原文摘录）、fact_key（自由文本，标识关联的产品事实/字段，
      非结构化外键）、review_status（枚举，见下）、note（内部审核备注）、
      date_created
      archived（boolean）、archived_at（timestamptz）

规则：
- source_file_id 必须提供有效 UUID；locator-only 不允许（422 SOURCE_REFERENCE_REQUIRED）；
- 无物理删除，仅逻辑归档（archive.post.ts）；
- nuxt-server 角色无任何 product_source_records 权限；
- review_status 枚举：confirmed / needs_review / missing / conflict（PWS-07-FAST-01R 核实，
  enum 本身未变，只在只读界面重新措辞为英文展示文案）；
- Source Snapshot 冻结机制尚未实现（须 DG-08 确认）；
- fact_key 目前是自由文本，不是到 product_spec_items 等表的结构化外键（PWS-07-DOR-02A/
  PWS-07-FAST-01R 核实的既成事实，非新政策）。
```

#### 产品—内容模块（product_sections + items）

```text
字段：type（枚举 SectionType）、title_en/es/pt、sort、enabled
      子 items：content_en/es/pt、media_id、layout、enabled

规则：
- 内容模块的审核粒度（整产品还是逐模块）待 DG-13 决策；
- 启用/禁用控制前台是否渲染；
- 审核通过前内容模块不出现在公开前台。
```

#### 产品—关系（待实现，DG-12/G.2）

```text
当前状态：无独立关联管理页面（ADM-06）。
施工前必须由用户确认：关联产品/资源/应用场景的数据模型与存储方式。
```

#### 产品—SEO/Locale（seo_* 字段）

```text
字段：seo_title_en、seo_description_en（其余语言待 M6 激活）
      seo_noindex、seo_canonical_path

规则：
- seo_title ≤ 120 字符；seo_description ≤ 320 字符（服务端强校验）；
- noindex=true → sitemap 排除，仍可渲染但搜索引擎不收录；
- canonical_path 由 Nuxt 服务层最终控制，不由 Directus 直接输出；
- ES/PT 激活条件待 DG-14 确认。
```

#### 产品完整度（Readiness）

```text
定义：计算值，不是生命周期状态（不得混入 draft/review/published/archived 状态机）。
计算依据（用户决策 DG-11）——目前尚未确认，禁止硬编码：
- 基础信息完整（product_code、name、slug、category）
- 至少一组规格数据
- hero 图已关联（file_role=hero，DG-12 确认后）
- SEO 字段已填
- 至少一条来源记录

完整度以百分比或分级显示在 ADM-02 列表，不作为发布前置条件
（由发布门禁 G.5 另行控制）。
```

### G.5 生命周期门禁、并发与错误合同

#### 发布门禁（Publishing Gates）

```text
draft → review 必须满足：
1. product_code 已设置（格式合法）；
2. name_en 非空；
3. slug 合法且唯一。

review → published 必须满足：
1. 上述所有 draft→review 条件；
2. Readiness 阈值规则（DG-11 确认后强制执行）。

无来源证据（0 条 active source_records）是否阻止进入 published，待 DG-11 确认。
无人工 review 步骤不得直接 draft → published（状态机不允许跨步）。
TEST ONLY 数据（product_code=NULL 或 ID=3）不得进入 published，且 seo_noindex 必须=true。
```

#### 权限、CSRF 与审计（不可绕过）

```text
- 所有 /api/admin/* 端点：必须通过 admin-auth 中间件（httpOnly cookie + Administrator 角色验证 + CSRF Origin 检查）；
- SSR 页面路由 /admin/*：无有效 admin_at → 服务端 302 到 /admin/login（不依赖客户端跳转）；
- 任何 Directus Schema 变更必须先导出快照，再提交快照文件，再执行变更；
- 管理员操作写入 Directus Activity Log（审计）；不得绕过。
```

#### 并发编辑、保存失败与错误态

```text
并发编辑（两个标签页同时编辑同一产品）：
- 当前无乐观锁机制；施工 J-3 Workspace Shell 时须定义处理策略（DG-14）；
- 暂定后保存者覆盖；须在 UI 明确提示"其他会话已修改此产品"（来自 Directus updated_at 对比）。

保存失败：
- 网络错误 → 弹出错误态，数据不丢失（不自动清空表单）；
- 服务端 400/422 → 显示具体字段错误，不整体重置；
- 服务端 500/503 → 通用错误提示，保留已编辑内容供重试。

无权限态：
- 非 Administrator 访问任何 /admin/* → 302 或 403；
- 无权限的字段/操作不出现在 UI（角色矩阵待 DG-09 正式定义）。
```

---

## H. AI 与导入治理合同

### H.1 当前状态（如实记录，2026-09-14 同步）

**当前已交付并签收的 AI 只有单产品 AI V1（`AI ONE-CLICK FILL V1 = COMPLETED / SIGNED OFF`，详见 `CURRENT-STATE.md`）。除此之外，不得把任何 AI 流程表述为"已完成"。**

当前已有（均限于一个产品及该产品的同一个 Product Draft）：

- AI Source Intake：只分析本产品已关联且已启用的资料；
- 型号归属保护（D-025）：分析时标明当前产品；资料描述多个型号时，只采用明确归属当前产品的值，归属不明确即省略，不做模糊型号匹配；
- Proposal Review：AI 只生成 Specifications 建议；人工逐项 Accept / Edit / Reject，支持批量审核；多份资料互相矛盾时进入来源冲突审核，由人工选定取值或拒绝；
- Apply to Draft：只把人工已接受的建议写入同一个产品 Draft，非 Draft 产品由服务端拒绝写入。

**AI 可读来源格式不在本 Charter 中逐项维护。** 某个格式当前是否可读，以 `08-decision-log.md` D-024（统一来源抽取合同）及其共享格式合同（`utils/aiSourceFormats.ts`）为准，模块级签收记录见 `CURRENT-STATE.md`；每个格式只有在自己的实施模块通过验收后才变为可读。截至 AI-PDF-SOURCE-01（D-026），带文字层（text-layer）的 PDF 抽取已实现：由隔离的 document-extractor 读取，只有有界文本进入同一个 Proposal Engine，原始 PDF 不发送给 AI Provider；生产部署仍须单独授权。

截至 AI-PDF-SOURCE-01 仍未实现：扫描 PDF 的 OCR、DOCX 抽取、XLSX 抽取、图片 OCR、Vision、旧版 DOC / XLS；Specifications 以外的 AI Target；专用 AI 任务 Worker / 队列（当前在 Nitro 服务层内同步处理，见 E.3）；多产品 AI 与批量导入（H.3）；自动发布。

AI 不得自动发布（Published），不得绕过人工审核，不得未经人工确认覆盖真实资料。

### H.2 未来单品号 Dossier AI 规则

以下规则在 AI 功能施工时必须严格遵守（当前落实情况见代码块下方）：

```text
一项 AI 任务 = 一个 product_code + 一个 Product Draft + 一个冻结的 Source Snapshot；
AI 只能读取已关联的资料（来源 UUID、页码/Sheet 范围）；
AI 只生成带来源的建议版本（Candidate/Suggestion）；
已人工确认的字段不可被 AI 覆盖；
人工可选择：接受 / 编辑后接受 / 退回拒绝；
AI 不可自动发布、删除或移动正式媒体；
所有写入必须经服务端规则和人工确认。
```

**当前落实情况（单产品 AI V1，2026-09-13 同步）：**

- 已落实：一次分析只针对一个产品，结果只 Apply 到同一个产品 Draft；只读取本产品已关联且已启用的资料；AI 只生成建议，不直接写入；人工可 Accept / Edit / Reject；AI 不发布、不删除、不移动媒体；唯一的写入（Apply）经服务端校验，且只写人工已接受的条目。
- 部分落实：AI 不能自行覆盖既有参数，既有值只有在管理员对该行明确接受并点击 Apply 后才会更新；但尚无"已确认字段锁定"机制。
- 未实现：冻结的 Source Snapshot；页码 / Sheet 范围；逐条标注来源的建议、建议版本记录与完整来源追溯（provenance）。

### H.3 未来多品号导入规则

```text
工作簿上传 → 字段映射 → 校验预览 → 仅创建多个 Draft
  → 每个 product_code 独立 AI 任务与上下文（队列逐个处理）
  → 人工审核 → 进入单品号工作台。

禁止批量发布；
禁止不同型号混合 AI 上下文；
工作簿导入最多只能创建 Draft，不能创建 Published；
导入模板字段与错误修复规则须 DG-15 确认后方可施工。
```

### H.4 AI / 导入接入前置条件（完整 Gate 链）

以下所有条件满足前，不得开始 AI 或批量导入相关代码施工：

```text
J-3 Product Workspace Shell 必须完整验收；
J-4 ADM-03 Specifications 必须完整验收；
J-5 ADM-04 Product Media & Resources 必须完整验收；
J-6 ADM-05～08 必须完整验收；
Media Library 引用保护机制已完整验收（现已完成）；
管理员权限与角色体系已完整定义并经用户确认（DG-09）；
Source Snapshot 冻结机制已实现（DG-08）；
人工审核链路（接受/拒绝/锁定字段）已实现；
AI 模型供应商、费用预算、数据出境范围已由用户明确确认（DG-07，须单独授权）；
导入模板字段与错误修复规则已确认（DG-15）。
```

**事实说明（2026-09-13）：** 单产品 AI V1 已依据逐个明确、窄范围的模块授权（2026-09-08 起）及 FD-004（2026-09-09 生效）实施，并已完成签收（见 H.1）。上述条件本身不变，不因此视为已满足；M.2 中 DG-07 / DG-08 / DG-09 / DG-15 的状态也不变。未来扩大资料格式、Provider / 数据出境、基础设施、生产部署或自动发布，仍受现有 Gate 约束。

**Content AI 适用范围（D-031，2026-09-14）：** H.2 / H.3 的 `product_code` 规则与 D-021 单产品范围继续只约束 Product Workspace AI 与导入。Content Center 的 AI 范围是"当前一个 Content Draft + 明确选择 / 关联的允许来源"，复用同一 Source → 有界抽取 → Proposal → Human Review → Apply to Draft 架构，沿用现有来源上限，AI 不得发布。Content AI 施工须先完成 Content Center Blueprint 并取得单独实施授权；FD-004.2 的全部 P0 边界同样适用。H.4 中以 Product Workspace 为对象的 J-3～J-6 验收条件不是 Content AI 的准入依据；Provider、费用与数据出境（DG-07）等通用条件继续适用。

---

## I. 保留 / 重构 / 新增决策表

| 分类 | 当前内容 | 决策 | 不可破坏的边界 |
|------|---------|------|--------------|
| **保留** | Nuxt 3 + Directus + PostgreSQL 技术栈 | 不因 UI 改造替换 | — |
| **保留** | Admin Auth（httpOnly cookie、SSR 302、auto-refresh） | 不因视觉重构绕开 | admin-auth 中间件覆盖范围不得缩小 |
| **保留** | 产品生命周期 `draft → review → published → archived` | 唯一状态机，不得添加平行状态 | — |
| **保留** | `product_code`（UNIQUE，设置后不可修改，状态门控） | 产品身份主键 | 不允许 AI 或导入猜测 product_code |
| **保留** | 媒体治理（Folder Registry、引用保护、archive/restore） | 作为后续底座 | 不物理删除有引用的媒体 |
| **保留** | 所有现有 server/api/admin/* 端点与测试 | 重构 UI 不改 API 签名 | — |
| **保留** | `product_source_records`（audit trail，无物理删除） | 来源证据基础 | nuxt-server 角色不得有此表权限 |
| **保留并重新定位** | `ProductBasicForm.vue` | 未来作为 Workspace Shell Overview 的一部分 | 不单独废弃，迁入 Shell |
| **重构** | `pages/admin/products/index.vue`（Product Center 主列表） | 按 ADM-02 CONFIRMED 后重构 | 等视觉确认；不改 API |
| **新增** | Product Workspace Shell（Dossier 共用框架） | ADM-03～08 的统一容器 | 等 ADM-03～08 CONFIRMED |
| **新增** | ADM-02a 分类视图 | 分类导航与分类健康摘要 | 等 ADM-02a CONFIRMED |
| **新增** | ADM-08 来源与历史前端界面 | `product_source_records` 已有后端 | 等 ADM-08 CONFIRMED |
| **新增** | Import Center（ADM-09～11） | 多品号工作簿导入 + 队列 | 须单独授权 |
| **新增** | AI 工作台（ADM-14～15） | AI 任务管理 | 须单独授权 + AI 接入前置条件满足 |
| **新增** | 产品专属媒体与资料引用视觉优化 | 与全局 Media Library 分开 | 等 ADM-04 CONFIRMED |
| **新增** | 单品号 Product Dossier（含 AI 功能） | 逻辑图 01 | 须单独授权 |
| **新增** | 多品号导入审核队列 | 逻辑图 02 | 须单独授权 |

### I.2 渐进重构、兼容、迁移与恢复原则

```text
重构策略：
1. 不做全量推倒重写；采用"保留底座 + 逐模块替换 + 兼容适配层"；
2. 每次重构只改一个边界内的代码，不同时跨越 UI / API / Schema 三个层；
3. 保护旧路由/API 签名：重构 UI 时不改 API；调整 API 时保持 URL 不变（兼容参数扩展）；
4. ID=3 TEST ONLY 产品在整个重构阶段不得被修改或发布；
5. 既有媒体文件（UUID）和 source_records 在重构过程中不得被移动、重命名或删除；
6. 新能力（如 Workspace Shell）必须与旧子页面共存，直至完整验收后才合并/替换。

回退规则：
- 每个模块施工前必须有可回退的 git commit（不在同一 commit 混合多个无关改动）；
- Schema 变更须先快照、再提交快照文件、再执行变更；Directus 不可回退时须有 DB 备份；
- 若施工中发现破坏已有功能（typecheck/lint/test 失败），立即停止，不继续前进，报告并修复。

测试数据隔离：
- ID=3 TEST ONLY 永不与真实产品逻辑混用；
- 新功能开发阶段不使用真实 LT-180C 数据，直到 J-9（真实产品 Draft 录入）正式开始。
```

---

## J. 锁定的施工顺序与依赖

除非用户明确改框架，后续施工必须按以下顺序执行，不得跳步：

```text
J-0   母版对齐审计（只读，已由本 Charter 建立基线；已完成）
J-1   Charter V1 / FD-001（已完成）
J-1.1 Charter V1.1 框架完整性补全（本次）
J-2   ADM-02 + ADM-02a Product Center 结构性重构（FD-001 视觉已确认，可开始施工）
J-3   Product Workspace Shell + Product Control 框架
J-4   ADM-03 Specifications（进入 Workspace Shell）
J-5   ADM-04 Product Media & Resources（进入 Workspace Shell）
J-6   ADM-05～08 按依赖拆分（Page Content / Relations / SEO / Sources & History）
J-7   Single Product Dossier（含 AI 功能，须 H.4 前置条件全部满足 + 单独授权）
J-8   Multi-model Import Review Queue（须 H.4 前置条件全部满足 + 单独授权）
J-9   合格真实资料审计与真实产品 Draft 录入（真实 LT-180C 等）
J-10  前台 CMS 联动与发布验收（含 SEO、sitemap、多语言上线验收）
```

**Content Center（D-031，2026-09-14）：** Content Center 是按能力型 Gate 推进的独立轨道（Approved Visual → Module Freeze → Blueprint → 明确实施授权 → Draft / Public 安全 Gate → 生产发布 Gate），不插入、也不改变上面的产品线 J 顺序。J-9 真实产品录入不阻塞 Content Center 的规划与 Draft-only 建设；J-10 与生产发布 Gate 仍约束其公开发布。

---

## K. 每次施工前的强制读取与 Framework Gate

### K.1 不可跳过的必读文件

每次 Claude 接到任何 Admin/CMS 代码任务，必须先读（按顺序）：

```text
1. CLAUDE.md
2. docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md（本文件）
3. docs/project/CURRENT-STATE.md
4. docs/project/MASTER-ROADMAP.md
5. 本任务相关 CMS-AI-CONSTRUCTION-PACK-V1 章节
6. 本页面对应的 CONFIRMED 视觉母版，或在 Charter 中有 USER-CONFIRMED FOR IMPLEMENTATION 框架决定（如 FD-001）的母版；两者均无则停止施工
7. 当前相关代码与测试
```

### K.2 每次开工报告必须包含的声明

```text
Framework version: Governing Charter V1.1（docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md）
Relevant Charter sections: [填写本次相关的 A/B/C/... 章节]
Relevant visual/logic master: [精确路径 + 当前状态 CONFIRMED/DRAFT/FD-001]
Current milestone: [填写当前处于 J-? 阶段]
Scope is aligned / conflict found: [对齐 / 冲突（需报告）]
Files explicitly excluded: [施工单禁止暂存的文件列表]
Data/API contract reference: [引用 G.4 节对应合同；未审计则停止施工]
Preserve / Refactor / New / Missing: [本模块在 Section I 中的判定]
Open Decision Gates check: [无阻塞本模块的未确认 Gate / 若有则停止]
Acceptance criteria: [含空态 / 错误态 / 无权限态 / 1440px + 375px 两个断点]
```

**没有这段开工声明，不得修改代码。**

---

## L. 验收、Git 与备份规则

### L.1 模块施工闭环

```text
一份施工单
  → Claude 自动完成代码与自动化验证（typecheck / lint / build / tests）
  → 用户最多一次集中登录（仅确有浏览器验收必要时）
  → Claude 集中验收
  → 一份精确的 commit / GitHub push 施工单（须用户单独授权后 push）
```

### L.2 代码模块必须通过

```text
npm run typecheck — 0 errors
npm run lint — 0 errors
npx nuxt build — 成功
npx vitest run — 0 failures（如有测试）
git diff --check — 无 whitespace 错误
1440px + 375px 浏览器验收（无法使用 MCP 浏览器时，以 curl/typecheck/build 代替，如实记录限制）
CURRENT-STATE.md 更新以反映新状态
```

### L.3 Git 操作规则

```text
精确暂存（git add -- file1 file2，不使用 add-all）；
提交前 git diff --cached --name-only 核实暂存内容；
不使用 git add . / git add -A / git reset --hard / git clean / git stash / git restore / git checkout --;
不暂存既有四个 ?? 资料包：
  docs/design-reference/CMS-AI-VISUAL-MASTER-V1/
  docs/design-reference/inbox/
  docs/product-cms/CMS-AI-CONSTRUCTION-PACK-V1/
  docs/project/LITUBO_9C-2R_正式施工单.md
git push 须经用户单独授权；
push 前 git rev-list --left-right --count origin/master...HEAD 确认本地不超过预期 commit 数。
```

### L.4 GitHub Checkpoint 规则（固定，2026-09-06）

Checkpoint 是远程备份，不等于已验收、已发布或可部署。

```text
1. 自动化验证通过的原子子任务，必须先创建精确本地 commit，再创建 checkpoint；
2. 用户 / Codex 授权时，创建或快进 GitHub 远程 checkpoint 分支；
3. origin/master 只能在集成验收、用户视觉确认、Codex 明确授权后更新；
4. 永不 force push、删除分支、改写历史或修改 remote URL；
5. checkpoint 分支不得自动删除；
6. 每次报告必须分别列出：
     - 本地 HEAD hash
     - checkpoint 分支 hash
     - origin/master hash
     - 三者是否相同或为何不同；
7. J-2 集成链的唯一 checkpoint 分支名：backup/admin-cms-j2（固定，不得更改）。
```

---

## M. 变更日志与可追溯附录

### M.1 Charter 变更日志

| 版本 | 日期 | 变更内容 | 授权者 |
|------|------|---------|--------|
| V1 | 2026-09-06 | 初始建立 | 用户 |
| V1.1 (FD-001) | 2026-09-06 | 新增 Framework Decision FD-001 — 视觉与逻辑母版施工授权确认（User Confirmation of Admin Visual & Logic Masters） | 用户 |
| V1.1（框架补全） | 2026-09-06 | 完整框架 11 项补充：E.4/E.5 域所有权与前台联动合同、F.4 不可偷跑规则、G.4 数据/API 合同、G.5 生命周期/并发/错误合同、H.4 AI 接入完整 Gate 链、I.2 渐进重构兼容原则、J 节施工顺序更新至 J-1.1 格式、K.2 开工声明扩展、M.2 新增 DG-10～DG-16、新增 Section N 非视觉质量合同、新增 Section O Definition of Ready/Done | 用户 |
| V1.1 (FD-002) | 2026-09-06 | 新增 Framework Decision FD-002 — Master Authority & Responsive Adaptation（视觉母版权威与响应式适配裁定）。裁定 VM1 两张 ADM-02 母版为 J-2 主要实施依据；P2 inbox 图片降为视觉方向参考，不得单独决定路由/数据/API/交互/移动端；English-first 优先于母版中文；J-2 右侧采用 Product Control，AI 批量导入延后至 IMP-01；PC-01/PC-02 采用 375px 卡片列表原则，其余 Workspace 模块移动端阻塞；引入工程模块 ID 与 Source Asset ID 命名空间。解决 V-0.5.1 记录的 CF-1～CF-5 五项冲突。不授权 AI、导入、真实数据或发布 | 用户 |
| V1.1 (FD-003) | 2026-09-06 | 新增 Framework Decision FD-003 — Context-Efficient Execution（高效分层阅读规则）。设立 A/B/C 三层阅读要求：新模块/框架变化/新 Session 接手/推送前最终验收须完整阅读；同模块后续子任务只读模块相关文件；纯机械验证只读当前施工单与 diff。层级只降低重复阅读成本，不降低任何 Gate、母版、数据/API 合同、English-first 或验收标准的适用范围，不构成框架变更 | 用户 |
| V1.1 (FD-004) | 2026-09-09 | 新增 Framework Decision FD-004 — Risk-Proportionate AI MVP Delivery（AI MVP 风险比例与最小可用闭环原则）。确认当前 AI MVP 为工业设备资料 Draft 辅助填写，非安全控制、非高风险自动决策系统，工程复杂度与测试深度须与真实业务风险成比例。设立 P0 / P1 / P2 分级：只有触及跨产品混料、猜测技术参数、凭证泄露、未经人工确认写入、自动发布、不可恢复数据破坏、失控 AI 费用循环七项核心边界的问题才构成 blocker；Redis、分布式限流、多实例一致性、企业级 quota、完美 HTTP 语义、按格式独立解析容器、npm audit 清零、未来规模化基础设施等默认进入 backlog，不得自动阻塞当前闭环。固定第一闭环为「单产品 Draft → 选择已关联资料 → AI 提议 Specifications/Functions → 人工 Accept/Edit/Reject → Apply 到同一产品 Draft」。不取消 one-product isolation、human review、Draft-only、no auto publish、凭证保护、TEST ONLY 保护、Media Library 单一媒体源、不猜测技术参数；不授权部署、master 推送、真实 AI Key、真实付费调用、自动发布或绕过人工审核 | 用户 |
| V1.1（Content Center 最小修正） | 2026-09-14 | 依据用户授权的 `CONTENT-CENTER-MODULE-FREEZE-01` 与 D-031，最小修正会误导 Content Center 的条款：E.4 Content Center 行（去除 `product_sections` / `product_section_items` / `posts` 归属与 M4 字面排期）及 Product Center 行边界说明；F.3 Content Center 排期（去除 M5 字面排期）；H.4 后新增 Content AI 适用范围说明；J 节后新增 Content Center 能力型 Gate 说明。未新增 FD；未改变产品线 J 顺序、G.1 产品生命周期、FD-004.2 P0 边界、no auto publish 与 J-10 生产门禁 | 用户 |

### M.2 Open Decision Gates（用户待确认事项）

| # | 事项 | 当前状态 | 影响 |
|---|------|---------|------|
| DG-01 | ADM-02 视觉母版施工确认 | **FD-001 已生效（USER-CONFIRMED FOR IMPLEMENTATION，2026-09-06）** | Product Center 重构（J-2）可开始施工 |
| DG-02 | ADM-02a 视觉母版施工确认 | **FD-001 已生效（USER-CONFIRMED FOR IMPLEMENTATION，2026-09-06）** | 分类视图（J-2）可开始施工 |
| DG-03 | ADM-03～08 视觉母版施工确认 | **FD-001 已生效（USER-CONFIRMED FOR IMPLEMENTATION，2026-09-06）** | Product Workspace Shell（J-4～J-6）在 J-2/J-3 完成后可开始施工 |
| DG-04 | Metal Detection 产品分类是否已在 Directus 建立 | 未确认 | 真实 LT-180C Draft 录入前置条件（J-9） |
| DG-05 | LT-180C 真实图片/文档资料上传 | 未上传 | J-9 准入条件之一 |
| DG-06 | `product_code = LT-180C` 业务确认 | 待确认 | product_code 设置后不可修改 |
| DG-07 | AI 试点：模型供应商、费用预算、数据出境范围 | 未授权 | AI 功能施工前置条件（J-7） |
| DG-08 | Product Family / Revision 完整数据模型 / Source Snapshot 冻结机制 | 当前 products 表无 revision_no | 完整 Dossier 工作流前置条件 |
| DG-09 | Publisher / Editor / Reviewer 角色边界正式定义 | 当前角色未细分 | 多人协作与权限模型前置条件 |
| DG-10 | Category Health 的业务定义（分类健康度如何计算、显示维度） | 未定义 | ADM-02a 分类视图施工前置条件（J-2） |
| DG-11 | 产品完整度（Readiness）计算规则与阈值（维度、权重、是否作为发布门禁） | 未定义 | ADM-02 列表 Readiness 显示施工前置条件 |
| DG-12 | 产品媒体角色（file_role）枚举的完整定义与排序规则（现有 11 值是否完整） | 现有 11 值未最终确认 | ADM-04 Product Media & Resources 施工前置条件（J-5） |
| DG-13 | 页面内容模块（product_sections）的审核粒度（整产品审核还是逐模块审核） | 未定义 | ADM-05 Page Content 施工前置条件（J-6） |
| DG-14 | SEO 与多语言发布规则（ES/PT 激活条件、hreflang 策略、noindex 范围） | 未定义 | ADM-07 SEO & Locales 施工前置条件（J-6）及 J-10 验收 |
| DG-15 | 导入工作簿模板字段与错误修复规则（字段映射、422 错误处理、重复导入） | 未定义 | Import Center 施工前置条件（J-8） |

**Resolved gate record**

| ID | Resolved on | Decision and evidence |
| --- | --- | --- |
| DG-16 | 2026-09-07 | Controlled private backup completed: `https://github.com/coffeebearchen/litubo-governance-assets`; immutable raw-asset snapshot is annotated tag `bk-gov-02-2026-09-07` → `e8d3d58c434468a339ace0726be6be5d52d9e30a`; `SHA256SUMS.txt` verifies 39/39 original files. See `CURRENT-STATE.md`. |

### M.3 路由 / 组件 / API / 测试追溯矩阵

| ADM ID | 路由 | 主要组件 | 关键 API | 测试文件 | 当前里程碑状态 |
|--------|------|---------|---------|---------|--------------|
| Shell | `layouts/admin.vue` | Admin Shell | `/api/admin/auth/*` | — | 已实现（保留） |
| ADM-02 | `/admin/products` | `pages/admin/products/index.vue` | `GET /api/admin/products` | — | 基础已有，待按母版重构（J-2）|
| ADM-02a | `/admin/products?category=` | 待新建 | `GET /api/admin/products` | — | 未实现（J-2）|
| WS Shell | `/admin/products/[id]` | 待新建 Workspace Shell | `GET /api/admin/products/[id]` | — | 未实现统一 Shell（J-3）|
| ADM-03 | `/admin/products/[id]/specs` | `pages/admin/products/[id]/specs.vue` | Specs API | — | 基础已有，待视觉重构（J-4）|
| ADM-04 | `/admin/products/[id]/media` | `pages/admin/products/[id]/media.vue` | Media API | — | 基础已有，待视觉重构（J-5）|
| ADM-05 | `/admin/products/[id]/content` | `pages/admin/products/[id]/content.vue` | Sections API | — | 基础已有，待视觉重构（J-6）|
| ADM-06 | `/admin/products/[id]/relations` | 待新建 | 待新建 | — | 未实现（J-6）|
| ADM-07 | `/admin/products/[id]/seo` | `pages/admin/products/[id]/seo.vue` | SEO 字段 | — | 基础已有，待视觉重构（J-6）|
| ADM-08 | `/admin/products/[id]/sources` | 待新建 | `GET/POST /api/admin/products/[id]/sources` | `sourceRecords.test.ts` | 后端已有，前端未实现（J-6）|
| ADM-12 | `/admin/media` | `pages/admin/media/index.vue` | Media API | FolderRegistry tests | 功能已实现，视觉待对比（J-6 之后）|
| ADM-09–11 | `/admin/import/*` | 待新建 | 待新建 | — | 未实现（J-8）|
| ADM-14–15 | `/admin/ai/*` | 待新建 | 待新建 | — | 未实现（J-7）|

---

## N. 非视觉质量合同（Non-Visual Quality Contract）

### N.1 响应式与无障碍

```text
所有 Admin 页面必须验收：
- 桌面端 1440px：无水平溢出，表格/媒体网格/列表正常展示；
- 手机端 375px：无水平溢出，宽内容以 overflow-x: auto 容器内滚动；
- 交互元素最小高度 44px（手机端）；
- 语义化 HTML：表格用 <table>，表单用 label 关联，aria-label 覆盖图标按钮；
- 键盘导航：Tab 顺序合理，焦点可见。
```

### N.2 空态、加载态、错误态、无权限态

```text
每个数据展示区域必须实现：
- 空态（无数据时显示说明文字，不显示空表格或空白区域）；
- 加载态（skeleton 或 spinner，不显示旧数据残留）；
- 错误态（API 失败时显示可操作的错误提示，保留已填数据）；
- 无权限态（403 时不显示空白，显示"无权限"提示）。
```

### N.3 列表性能与分页

```text
- 产品列表、媒体列表：服务端分页（limit/offset），不一次性加载所有记录；
- 搜索、筛选、排序：服务端处理，不纯前端过滤大量数据；
- 每个分页端点必须支持：limit（默认 20，最大 100）、offset、total_count 返回。
```

### N.4 审计日志（不可绕过）

```text
以下操作必须产生 Directus Activity Log（actor、action、collection、timestamp）：
- 产品状态变更（draft → review、review → published、published → draft、archived）；
- 媒体归档/恢复；
- 来源记录创建/归档；
- 角色、权限变更。

不得直接写 PostgreSQL 绕过 Directus 以逃避审计。
```

### N.5 测试策略

```text
服务端 API（Vitest）：
- 每个新 API 端点至少覆盖：正常路径 + 权限拒绝 + 无效输入 + 边界条件；
- 现有 127+ tests 为基线，新模块不得降低此基线；
- 施工完成前 Vitest 必须全数通过。

前端组件：
- 交互逻辑由 API/状态机测试间接覆盖；
- 纯视觉验收通过 MCP 浏览器或桌面应用截图（不强制 E2E，MCP 浏览器限制已记录）。

类型与构建：
- npm run typecheck — 0 errors（必须，非可选）；
- npm run lint — 0 errors；
- npx nuxt build — 成功。
```

### N.6 发布前完整验收门槛（J-10）

```text
J-10 上线前验收必须全部通过：
- 所有公开页面 canonical / hreflang / robots 正确；
- 非 Admin 用户无法访问任何 /admin/* 或 /api/admin/*；
- 真实产品 Published 状态在前台可见、Draft 状态 404；
- SEO 字段、noindex、sitemap 三项一致；
- 不含 TEST ONLY 数据的公开渲染；
- Directus Admin 界面（:8055）不对公网开放；
- 认证并发安全完整验收（独立测试环境，见 MASTER-ROADMAP M8）。
```

---

## O. Definition of Ready / Definition of Done

### O.1 每模块施工前（Definition of Ready）

开始代码施工前，以下条件必须全部满足：

```text
□ 视觉母版已确认（CONFIRMED 或 FD-001 等 USER-CONFIRMED FOR IMPLEMENTATION）；
□ 对应数据/API 合同已在本 Charter Section G.4 中审计并记录；
□ 保留/重构/新增/缺失 判定已在 Section I 或本模块施工单中明确；
□ 所有前置依赖模块已完成（见施工顺序 Section J）；
□ 当前 Open Decision Gates（Section M.2）中无阻塞本模块的未确认事项；
□ 验收标准（含空态/错误态/权限态/两个断点）已在施工单中明确；
□ 施工单已包含 Section K.2 的完整开工声明。
```

### O.2 每模块施工后（Definition of Done）

以下全部通过，才视为模块完成：

```text
□ npm run typecheck — 0 errors；
□ npm run lint — 0 errors；
□ npx nuxt build — 成功；
□ npx vitest run — 0 failures（新旧测试全部通过）；
□ git diff --check — 无 whitespace 错误；
□ 桌面端 1440px 响应式验收通过（无水平溢出）；
□ 手机端 375px 响应式验收通过（无水平溢出）；
□ 功能核心路径验收（真实 API 调用，非 mock）；
□ 空态/错误态/无权限态已验收；
□ CURRENT-STATE.md 已更新反映新状态；
□ 精确 git commit（只含本模块相关文件，无无关改动）；
□ GitHub push 已完成（须用户单独授权，不在 Claude 自动执行范围内）。
```
