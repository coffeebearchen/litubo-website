# LITUBO — Module Work Order Template

> 依据 `docs/project/PROJECT-EXECUTION-PROTOCOL.md` §10。由 Controller（GPT / Codex）填写；一份施工单只对应一个模块；必须完整、自包含，可一次交给 Claude 执行。不适用的字段写 `N/A` 并说明理由。

```text
# LITUBO — <MODULE-ID>

## 1. Module ID
<MODULE-ID>（Admin/CMS 模块同时写工程模块 ID，如 PWS-xx / CC-xx，以及 Source Asset ID）

## 2. Module Type
TYPE A Visual/UX | TYPE B Runtime/Backend/Data/AI | TYPE C Governance/Docs | TYPE D Release | TYPE E Read-only

## 3. Recommended Model
<模型 + 推理等级>（常规小修 medium/high · 跨模块 high · 架构/治理/上线前 最高）；模块中途不切换

## 4. Goal
<让谁、在什么边界内、完成什么>

## 5. Authorization Level
A0 READ_ONLY | A1 GOVERNANCE_DOCS | A2 LOCAL_IMPLEMENTATION | A3 PUSH_REVIEW_BRANCH | A4 MERGE_TO_PRIMARY | A5 PRODUCTION_DEPLOY
（授权不自动升级；外部副作用须在此逐项点名）

## 6. Expected Baseline
branch: <...>
HEAD: <full hash>
tracked changes: 0
historical untracked: <路径列表或数量>
不符 → STOP

## 7. Source of Truth
<本模块适用的 Charter 章节 / Decision / Freeze / Blueprint / Approved Visual / Register 行，含精确路径与状态>

## 8. In Scope
<允许修改的文件 / 目录 / 领域>

## 9. Out of Scope
<明确不碰的文件 / 模块 / 数据 / 服务>

## 10. Dependencies
<前置模块与 Gate 状态；未满足 → STOP>

## 11. Required Reads
<CLAUDE.md、PROJECT-EXECUTION-PROTOCOL、CURRENT-STATE、相关文档与代码；阅读层级 FD-003 Tier>

## 12. Implementation Contract
<必须实现什么、必须复用什么、数据/API/状态机/权限要求；Blueprint 待定项不得自行设计>

## 13. Safety Boundaries
- 凭证：不读取 / 不输出 / 不要求粘贴
- 数据：TEST ONLY 规则；真实数据是否允许
- AI / Provider 费用：是否允许，上限
- Draft / Published 隔离
- push / merge / deploy：<按授权等级>

## 13a. Safety Gates Touched
<docs/project/RELEASE-SAFETY-GATES.md 中触及的 RSG-xx；或 none + 理由>
Required evidence: <每个触及 Gate 的 Golden Path（G-/P-xx）与 Negative Path（N-xx）编号>
（高风险模块按 PROJECT-EXECUTION-PROTOCOL §12.1 执行；只能增加证据，不能削弱 Gate）

## 14. Validation
<风险导向：测试命令、typecheck、lint、build、runtime/security 检查、git diff --check>

## 15. 1440 Contract
<依据的 PRIMARY 视觉 / 合同；或 N/A + 理由>

## 16. 375 Contract
<移动端合同；或 N/A + 理由>

## 17. STOP Conditions
<本模块专属 STOP 条件> + 协议 §8.2 通用条件

## 18. Governance Closeout
CURRENT-STATE: always
Register: <是否登记 / 更新哪行>
MASTER-ROADMAP: <仅里程碑变化>
Decision Log: <是否预期新增长期决定；默认不新增>
Freeze / Blueprint: <是否授权修改>

## 19. Git / Commit
branch: <review/...>，从 <hash> 创建
staging: 精确暂存，禁止 git add . / -A
commit message: <建议>
push / merge / deploy: <禁止 或 已授权的精确对象>

## 20. Final Report Format
按 docs/project/templates/MODULE-CLOSEOUT-TEMPLATE.md，全部中文

## 21. Next Candidate
<下一候选模块> — STATUS: NOT AUTHORIZED
```
