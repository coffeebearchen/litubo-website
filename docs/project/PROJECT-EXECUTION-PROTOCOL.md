# LITUBO — Project Execution Protocol

> **状态：** ACTIVE（`PROJECT-EXECUTION-PROTOCOL-01`，用户授权，2026-09-14）
> **角色：** 全项目唯一的施工控制协议——模块生命周期、授权等级、Gate、会话恢复、模块内自动驾驶边界、STOP 条件、标准收口、Git / GitHub / Release 分层、项目档案更新规则。
> **入口：** `CLAUDE.md` 指向本文件。模板：`docs/project/templates/MODULE-WORK-ORDER-TEMPLATE.md`、`docs/project/templates/MODULE-CLOSEOUT-TEMPLATE.md`。

---

## 0. 适用范围

**本协议管：** 一个模块怎样被授权、执行、验证、收口、停止，以及怎样从仓库恢复项目状态。

**本协议不管：** 产品需求、字段字典、API 说明、数据模型、视觉设计，以及 Content Center / Media / AI 的蓝图内容。这些分别属于 Decision Log、Module Freeze、Blueprint、Register 和已批准视觉。

**与上位文件的关系：**

- `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md` 仍是 Admin/CMS 的最高治理文件。本协议不修改、不放宽 Charter 的任何边界、Gate、DoR / DoD 或框架变更规则（Charter §A、§B）。
- Admin/CMS 模块在本协议之外，仍须满足 Charter §K / §O、Implementation Blueprint §10 / §13、Register §10 与 `CLAUDE.md` 开工声明。二者同时适用；以更严格的为准。
- 本协议吸收并取代未跟踪资料包 `docs/product-cms/CMS-AI-CONSTRUCTION-PACK-V1/01_COLLABORATION_PROTOCOL.md` 与 `05_CLAUDE_MODULE_WORK_ORDER_TEMPLATE.md` 的执行规则；这两个文件保留为历史资料，不再是执行依据。

---

## 1. 控制原则

| # | 原则 | 含义 |
|---|---|---|
| A | **Repository reality first** | 当前 Git、仓库文件、运行服务事实最高。聊天、模型记忆、旧报告不能覆盖仓库事实。 |
| B | **One authorized module at a time** | 任何时候最多一个 Active Authorized Module。不得并行推进多个模块。 |
| C | **Safe autopilot inside module** | 模块获授权后，Claude 在模块边界内自主完成读取、施工、测试、验收、收口、本地 commit，不逐步询问。 |
| D | **Human Gate between modules** | 模块收口后 STOP。即使 Roadmap 已写下一步，也不得自动开始。 |
| E | **No silent scope expansion** | 范围外问题只记录、报告；阻塞则 STOP。不得顺手扩大施工范围。 |

治理原则：**framework before details；先让完整流程跑通再优化；模块化、可升级、少返工；按真实业务体量施工，不做企业级过度设计。**

---

## 2. 角色

| 角色 | 负责 | 不做 |
|---|---|---|
| **用户** | 业务决定、模块之间的明确授权、关键视觉批准、必要的本地交互登录、push / merge / deploy 授权、框架变更 | 不需要判断代码实现细节 |
| **Controller（GPT / Codex）** | 总体编排、架构、风险控制、模块拆分、验收标准、施工单设计、审查 Claude 报告 | 不直接修改仓库、数据库或生产环境；不代替用户确认业务事实 |
| **Claude（executor）** | 仓库盘点、施工、测试、视觉验收、治理收口、本地 commit、证据报告 | 不做业务决定、不扩大范围、不处理凭证、不自行 push / merge / deploy |

Claude Code 是唯一实际修改 `D:\LITUBO-website` 工作树的执行者（Charter §A.3）。

---

## 3. Authority Model

不同文件回答不同问题，不排成一条绝对顺序。

| 类别 | 包含 | 决定什么 |
|---|---|---|
| **3.1 Reality** | live Git、仓库文件、运行服务、获授权检查的数据库 / Directus 事实 | 事实是什么。最高。 |
| **3.2 Governance** | Governing Charter、已确认 Decision Log 条目、`CLAUDE.md`、本协议、安全规则 | 长期边界与不可越界事项 |
| **3.3 Current State** | `docs/project/CURRENT-STATE.md` | 最新完成什么、当前授权什么、下一候选是什么。live Git 覆盖过时的 CURRENT-STATE。 |
| **3.4 Module Contract** | Module Freeze、Blueprint、Approved Visual | Freeze = 范围 / 职责 / 写入边界 / 路由意图；Blueprint = 数据 / API / 技术实现合同；Approved Visual = 布局 / 层级 / UI 方向。三者互不越权。 |
| **3.5 Planning** | `MASTER-ROADMAP.md`、Visual & Data Conformance Register | 路线、映射、状态记录。不能覆盖真实代码与已确认 Decision。 |
| **3.6 Conversation / memory** | 聊天、handoff、模型记忆、旧报告 | 最低。只能加速发现，不能代替仓库事实。 |

与 Charter 的对应：事实问题按 Charter §C.1（事实真相优先级），方向问题按 Charter §C.2（施工方向优先级）。本表只做分类，不改变 Charter §C 的顺序。

### 3.7 冲突处理

以下组合出现**无法按职责边界解释的实质冲突**时：

```text
Repo vs CURRENT-STATE
Governance vs Blueprint
Freeze vs Blueprint
Blueprint vs Approved Visual
Decision vs runtime
```

→ **STOP · REPORT · DO NOT GUESS。** 不得擅自选择"看起来更新"的一方。

可按职责边界解释的差异不是冲突（例如：视觉画了一个菜单，而仓库 shell 为准——Freeze 已裁定）。

---

## 4. 模块类型与生命周期

每份施工单必须声明模块类型。不同类型适用的 Gate 不同；不适用的项写 `N/A` 并说明理由，不得伪造。

### TYPE A — Visual / UX Module

```text
Requirement / Scope
→ Visual Direction → User Visual Approval
→ Module Freeze（改变页面职责 / 路由 / 写入边界时）
→ Blueprint（技术或数据设计非平凡时）
→ Implementation Authorization
→ Implementation → Tests → 1440 Acceptance → 375 Acceptance
→ Governance Closeout → Local Commit → STOP
```

简单 UI 修复、小幅对齐可复用现有视觉合同与现有 Freeze / Blueprint，不必新建。

### TYPE B — Runtime / Backend / Data / AI Module

```text
Scope → Safety / Architecture Check → Freeze / Blueprint（如适用）
→ Implementation Authorization → Implementation → Automated Tests
→ Runtime / Security Verification → Governance Closeout → Local Commit → STOP
```

无 UI 时：`1440 = N/A`、`375 = N/A`（写明理由）。

### TYPE C — Governance / Documentation Module

```text
Scope → Repository inventory → Minimal governance change
→ diff / consistency validation → CURRENT-STATE update → Local Commit → STOP
```

通常：`runtime tests = N/A`、`1440 = N/A`、`375 = N/A`。

### TYPE D — Release / Deployment Module

必须独立授权。开发模块完成 ≠ release 授权。至少分为独立步骤：

```text
Release Review → Push Authorization → Merge Authorization → Production Deploy Authorization
```

"继续""可以""做吧"这类话**不能**被解释为 push + merge + deploy。

### TYPE E — Read-only Review / Audit

```text
0 modification · 0 commit → REPORT → STOP
```

---

## 5. Gates

| Gate | 何时必需 | 何时不必需 |
|---|---|---|
| **Visual Gate** | 新的主要 UI、workspace 或 workflow：先有 approved visual direction | 简单 UI bug、小幅对齐：复用现有视觉合同 |
| **Module Freeze Gate** | 新模块或改变页面 / 模块职责、路由拓扑、写入边界、域所有权 | 简单 bugfix |
| **Blueprint Gate** | 进入实施前涉及新 schema、新 API 合同、新生命周期、新跨域关系、新持久化模型、新权限、新发布行为 | 现有 Blueprint 已充分覆盖 |
| **Release Gate** | 任何 production release：独立 Release Review（见 §13） | — |
| **Safety Gate** | 触及 Publish / Public Delivery / Sitemap / AI Apply / Locale Publication / Public Media / Permissions / Release / Production 的高风险模块：按 §12.1 与 `docs/project/RELEASE-SAFETY-GATES.md` 取证 | 未触及上述领域的模块（报告写 `Safety gates touched: none`） |

Admin/CMS 模块另受 Register DoR（Register §10.1、Blueprint §10.3a）与 Charter §O.1 约束。

---

## 6. 授权等级

| 等级 | 名称 | 允许 | 不包含 |
|---|---|---|---|
| **A0** | `READ_ONLY` | 读取、检查、报告 | 任何文件修改、commit |
| **A1** | `GOVERNANCE_DOCS` | 在授权范围内修改文档 / 治理 / 模板 / 已批准设计资产登记；本地 commit | runtime 代码、DB、Directus、push |
| **A2** | `LOCAL_IMPLEMENTATION` | 在授权范围内修改代码与相关文档、运行测试与本地验收；本地 commit | push、merge、deploy、生产变更 |
| **A3** | `PUSH_REVIEW_BRANCH` | push 指定的 review / checkpoint 分支（fast-forward，不 force） | merge 主分支、deploy |
| **A4** | `MERGE_TO_PRIMARY` | 更新 `origin/master` | deploy |
| **A5** | `PRODUCTION_DEPLOY` | 按 Release 合同部署生产 | 施工单未列出的其他生产变更 |

**授权不可自动升级。** A2 不含 A3 / A4 / A5；每一级都需要明确授权，且只对施工单点名的对象有效。

**凭证：** 任何等级都不得读取、输出、保存或要求用户粘贴 `.env`、password、cookie、JWT、token、API key、secret。必要的本地交互登录由用户本人完成。

**外部副作用**——付费 Provider 调用、发送邮件、生产发布、支付、部署、真实 CRM 写入——无论等级，都必须由施工单单独、明确授权。

---

## 7. Active Authorized Module

- 只有用户或 Controller 在施工单中明确授权的模块，才能进入 **Active**。
- Roadmap / CURRENT-STATE 中的 **Next Candidate 不是授权**。
- 同一时间最多一个 Active 模块。
- 模块收口（本地 commit + 报告）后，Active 回到 `NONE`，直到下一份授权。
- 施工单中途会话中断：新会话先 bootstrap（§9）；如存在未提交改动或未收口的模块分支，报告现状并 STOP，等待继续该模块的施工单，不自行续做或丢弃改动。

---

## 8. 模块内自动驾驶

### 8.1 授权后默认自主完成

- 读取必要文件，建立本模块 review 分支；
- 修改明确 in-scope 文件；
- 运行必要测试，修复由本模块直接引起的问题；
- UI 模块执行 1440 / 375 验收；
- 更新项目档案（§11）；
- 创建本地 commit，输出证据报告。

对于可由现有合同解决的正常技术细节，不逐步询问用户。

### 8.2 必须 STOP 的情况

```text
baseline mismatch（HEAD / 分支与施工单不符）
unknown tracked changes
governance conflict（§3.7）
scope expansion
requires a new business decision
requires credentials
requires destructive DB action
requires production changes
requires Provider spend not already authorized
requires unsupported / unverified product truth
requires modifying another active module
requires push / merge / deploy beyond current authorization
```

STOP 报告须包含：阻塞点、已确认事实、为何不能自行决定、影响、可选方案、需要用户 / Controller 回答的一句话。

### 8.3 禁止顺手修复

施工中发现与本模块无关的问题（例如另一个模块的 P2 缺陷、旧 Roadmap 漂移、无关 lint 问题）：

- **不阻塞当前模块** → 记录为 out-of-scope issue，写进报告，继续当前模块；
- **阻塞当前模块** → STOP。

---

## 9. Session Bootstrap — 新会话恢复

**新会话必须能只凭仓库恢复项目，不依赖上一段对话。** 聊天 handoff 只能加速发现，不是事实来源。

标准恢复顺序：

```text
1.  确认仓库根目录（git rev-parse --show-toplevel）
2.  读 CLAUDE.md
3.  读本协议
4.  完整读 CURRENT-STATE.md（文件很长时，可用并行只读子任务分段全文读取，不得自行跳读）
5.  读 MASTER-ROADMAP.md
6.  读当前相关的 Decision Log 条目与 Charter 章节，以及 CLAUDE.md 新会话交接要求的文件
7.  识别：latest completed module · active authorized module · next candidate · 授权状态
8.  读 Active 模块的 Module Freeze（如有）
9.  读 Active 模块的 Blueprint（如有）
10. 相关时读已批准视觉
11. 检查：git branch · HEAD · git status · 近期 commit · git remote -v · 相关服务状态（docker compose ps）
12. 对照仓库事实与 CURRENT-STATE 顶部 PROJECT CONTROL SNAPSHOT
13. 一致 → 仅当存在明确授权的 Active 模块（有其施工单）时继续该模块
14. 否则 → 报告恢复出的状态并 STOP
```

用户只说"继续 LITUBO 项目 / 按仓库项目协议恢复状态"时：执行上述恢复，报告当前控制状态；若没有明确授权的 Active 模块，**只报告、不开工**。长 handoff 只作为异常恢复手段。

FD-003 阅读层级（`CLAUDE.md`）仍适用于同一模块内的后续子任务与机械验证；新会话接手按 Tier A。

---

## 10. 标准施工单

模板：`docs/project/templates/MODULE-WORK-ORDER-TEMPLATE.md`。每份施工单只对应一个模块，必须包含：

```text
Module ID · Module Type · Recommended Model · Goal · Authorization Level
Expected Baseline · Source of Truth · In Scope · Out of Scope · Dependencies
Required Reads · Implementation Contract · Safety Boundaries · Validation
1440 Contract · 375 Contract · STOP Conditions · Governance Closeout
Git / Commit · Final Report Format · Next Candidate
```

**Recommended Model 约定：**

| 场景 | 推理等级 |
|---|---|
| 常规小修 | medium / high |
| 跨模块实施 | high |
| 架构 / 治理 / 上线前审查 | 最高适用等级 |

模型在模块开始时确定，中途不随意切换；确需切换，先报告原因。

---

## 11. 标准收口（Closeout）

模板：`docs/project/templates/MODULE-CLOSEOUT-TEMPLATE.md`。每个成功模块原则上依次执行：

```text
1.  Required tests（按 §12 风险确定）
2.  1440 验收（UI 模块）
3.  375 验收（UI 模块）
4.  git diff --check（暂存后再 git diff --cached --check）
5.  复核改动文件
6.  更新 CURRENT-STATE —— 总是
7.  更新 Register —— 模块在 Register 中登记时
8.  更新 MASTER-ROADMAP —— 仅当里程碑变化
9.  更新 Decision Log —— 仅当产生新的长期决定
10. 更新 Blueprint / Freeze —— 仅当本模块获授权修改它们
11. 创建本地 commit（精确暂存）
12. 核对 git status
13. 输出证据报告
14. STOP
```

### 11.1 CURRENT-STATE（总是更新）

- 顶部 **PROJECT CONTROL SNAPSHOT** 保持简短，只含控制字段：Latest accepted module、Latest completed module、Active authorized module、Active module authorization level、Next candidate、Next candidate authorized、Production release、Last closeout commit。收口时把 Active 置为 `NONE`（除非施工单明确授权了后续模块）。
- 文件无法包含自身所在 commit 的 hash；"Last closeout commit" 以 `git log -1 -- docs/project/CURRENT-STATE.md` 为准，snapshot 中记录上一次收口 commit。
- 文末追加模块节，至少记录：module、status、branch、commit 基线、scope、tests、visual verification、runtime / schema impact、next candidate、next candidate 是否授权。
- snapshot 中不放大段历史、详细测试或完整模块报告。live Git 始终覆盖过时的 snapshot。

### 11.2 MASTER-ROADMAP（仅里程碑变化）

只在里程碑达成、阶段变化、模块增删、下一主要候选变化时更新。Roadmap 不是流水账。

### 11.3 Decision Log（仅长期决定）

只记录长期的架构 / 业务 / 治理决定。不记录 bug fix、小 UI 调整、测试数、临时方案。

### 11.4 Register

Register 负责 module / visual / freeze / blueprint / implementation / acceptance 的映射与状态，不承担完整施工历史。状态词表见 Register §3（实施状态与治理标签分列）。

---

## 12. 验证规则

**风险导向，不强制每个模块跑相同测试。**

| 模块 | 默认验证 |
|---|---|
| UI runtime | 相关测试、typecheck、lint、需要时 build；1440 + 375 验收 |
| Backend / data / AI | unit / integration / contract / security 测试；runtime 验证 |
| Docs / governance | `git diff --check`、一致性检查 |
| Read-only | 无修改 |

Admin/CMS 代码模块仍须满足 Charter §L.2 / §O.2 与 Blueprint §10.2 的检查项；`CLAUDE.md` Module completion checklist 同样适用于代码模块。

**视觉验收（UI 模块默认）：**

- 1440 desktop 与 375 mobile 都检查；只有施工单明确标 `visual acceptance = N/A` 并写明理由时才可跳过。
- 默认包含：无意外 console error、无页面级横向溢出。已知基线噪声必须明确记录，不能静默忽略。
- console 证据来自 dev server 稳定后新开的标签页；截图须可辨认。

**测试数据：** 演示 / 测试数据标记 `TEST ONLY — NOT FOR PUBLICATION`；未验证数据不得进入 Published 或公开输出。

**AI 模块：** 引用既有原则——AI = proposal → Human Review → Apply to Draft → 不自动发布（FD-004、D-021 ~ D-031）。付费 Provider 调用须相应授权。

**Media 模块：** 引用既有原则——Media Library 是唯一业务媒体工作区（D-023）。

### 12.1 高风险模块：Safety Gate 流程（`RELEASE-SAFETY-GATES-01`，2026-09-15）

触及 Publish / Unpublish / Archive、Public Delivery、Sitemap / indexing、AI Apply、Locale Publication、Public Media、Permissions、Release / Production 的模块，必须按以下顺序执行（Gate 定义、状态词、Golden / Negative 证据编号见 `docs/project/RELEASE-SAFETY-GATES.md`）：

```text
identify touched gates
→ read safety gates
→ declare required evidence
→ implement
→ prove every touched gate
→ closeout（Gate Results · Open Gates · P0 Violations）
```

- 任一触及 Gate 的证据显示 `VIOLATED` → P0 → STOP（§8.2）。
- 证据不足 → 状态写 `OPEN` 并写明 owner，不得写 `PROVEN`。
- 施工单只能增加 Gate 证据，不能削弱 Gate；Gate 与 Charter / Blueprint 冲突 → STOP（§3.7）。

---

## 13. Git / GitHub / Production 分层

### 13.1 三层状态

| 层 | 状态 | 条件 |
|---|---|---|
| **Layer 1 — Local Complete** | 本地分支、测试通过、项目档案已更新、本地 commit | 默认施工完成状态（A1 / A2 内） |
| **Layer 2 — Remote Review** | review / checkpoint 分支已 push | 需显式 A3 授权，不自动 push |
| **Layer 3 — Primary / Production** | `origin/master` 已更新；生产已部署 | merge（A4）与 deploy（A5）分别需要显式授权，不绑定执行 |

```text
local commit          ≠ pushed to GitHub
pushed review branch  ≠ merged to master
merged to master      ≠ deployed to production
```

Admin/CMS 代码模块达到 Layer 1 即为 Local Complete；Charter §O.2 / Blueprint §13 的 Definition of Done 还包含"经授权后完成的 push"，该项在 A3 授权并完成前保持未完成。

### 13.2 默认策略

除非施工单明确改变：

```text
local commit = 在获授权的实施 / 治理模块内允许
push         = 未经明确授权禁止
merge        = 未经明确授权禁止
deploy       = 未经明确授权禁止
```

### 13.3 Commit 规则

- 精确暂存：`git add -- <file> ...`；禁止 `git add .` / `git add -A`。
- 提交前核对 `git diff --cached --name-only` 与 `git diff --cached --check`。
- 历史 untracked 路径不得顺手纳入。
- 禁止：`reset`、`stash`、`clean`、`rebase`、`merge`、`commit --amend`、`restore`、`checkout --`、force push、删除分支、改写历史、修改 remote URL（除非施工单另有明确授权）。
- push 前核对 `git rev-list --left-right --count origin/master...HEAD`。GitHub Checkpoint 规则见 Charter §L.4 / `CLAUDE.md`。
- 每次报告分别列出：本地 HEAD、checkpoint 分支 hash（如有）、`origin/master` hash、是否不同。

### 13.4 Release Review（TYPE D 前置）

任何生产发布前独立核对：open security gates、生产依赖、公开路由、sitemap、Draft 隔离、凭证、容量、CVE / license、回滚方案。`CURRENT-STATE.md` 中已记录的 Open Release Gates 与 Blueprint J-11、BP-DG-15 继续有效。

---

## 14. 本协议的变更

- 修改本协议或两个模板，须由用户 / Controller 以 TYPE C 治理模块明确授权。
- 本协议不得被用来修改 Charter；如某项协议规则只能靠修改 Charter 才能生效，STOP 并报告。
- 普通施工模块不得修改本协议。
