# LITUBO — Module Closeout Template

> 依据 `docs/project/PROJECT-EXECUTION-PROTOCOL.md` §11。Claude 在每个成功模块结束时执行下列步骤，并按报告骨架输出（全部中文）。不适用的步骤写 `N/A` 并说明理由，不得伪造。

## 1. 收口步骤

```text
1.  Required tests            —— 按模块风险运行（协议 §12）
2.  1440 验收                 —— UI 模块；否则 N/A + 理由
3.  375 验收                  —— UI 模块；否则 N/A + 理由
4.  git diff --check          —— 暂存后再跑 git diff --cached --check
5.  复核改动文件              —— 只含本模块范围
6.  更新 CURRENT-STATE        —— 总是：顶部 snapshot + 文末模块节
7.  更新 Register             —— 模块在 Register 中登记时
8.  更新 MASTER-ROADMAP       —— 仅当里程碑变化
9.  更新 Decision Log         —— 仅当产生新的长期决定
10. 更新 Blueprint / Freeze   —— 仅当本模块获授权修改
11. 本地 commit               —— 精确暂存；历史 untracked 不纳入
12. 核对 git status           —— tracked 与 untracked 分开
13. 输出证据报告
14. STOP                      —— 不开始下一模块
```

## 2. CURRENT-STATE 顶部 snapshot（收口时更新）

```text
Latest accepted module:
Latest completed module:
Active authorized module:            NONE（除非施工单明确授权后续模块）
Active module authorization level:
Next candidate:
Next candidate authorized:           NO / YES（附授权来源）
Production release:
Last closeout commit:                以 git log -1 -- docs/project/CURRENT-STATE.md 为准；此处记录上一次收口 commit
Live Git always overrides this snapshot if stale.
```

## 3. 报告骨架

```text
## 1. Result
PASS / STOP（STOP 时：阻塞点、已确认事实、为何不能自行决定、影响、可选方案、需要回答的一句话）

## 2. Git
branch:
start HEAD:
final commit:
origin/master:
checkpoint branch（如有）:
push: 0 / 已授权对象

## 3. Scope Delivered
实际完成内容；受影响文件（新增 / 修改 / 删除，逐个列出）

## 4. Validation
tests（命令 + 结果）:
typecheck / lint / build:
git diff --check:
runtime / security 检查:

## 5. Visual Acceptance
1440:（或 N/A + 理由）
375:（或 N/A + 理由）
console / horizontal overflow:
已知基线噪声:

## 6. Data / Safety
TEST ONLY 数据:
Draft / Published 隔离:
凭证: 未读取 / 未输出
Provider 调用与费用: 0 / 已授权次数
DB / Directus / schema 影响:

## 7. Project Records
CURRENT-STATE: updated
Register: updated / N/A（理由）
MASTER-ROADMAP: updated / unchanged（理由）
Decision Log: unchanged / D-xxx（为何是长期决定）
Freeze / Blueprint: unchanged / updated（授权依据）

## 8. Out-of-scope Findings
记录但未修复的问题（P0 / P1 / P2）

## 9. git status
tracked changes:
historical untracked:

## 10. Next Candidate
<模块> — STATUS: NOT AUTHORIZED — WAITING FOR USER / CONTROLLER

STOP
```
