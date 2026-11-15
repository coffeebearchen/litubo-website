# LITUBO Media Library Cloud Workspace V1 — 安装与开工说明

这是一个**设计与施工控制包**，用于把现有 Media Library 升级为“类云盘的企业业务资产工作区 V1”。

## 复制位置

将本包中的 `docs` 文件夹合并复制到：

`D:\LITUBO-website\docs\`

最终至少应存在：

- `docs/project/MEDIA-LIBRARY-CLOUD-WORKSPACE-V1-BLUEPRINT.md`
- `docs/project/MEDIA-LIBRARY-CLOUD-WORKSPACE-V1-IMPLEMENTATION-PLAN.md`
- `docs/design-reference/approved/admin-media-library-cloud-workspace-v1/00-VISUAL-MASTER-RULES.md`
- 同目录 6 张 PNG 视觉母版

## 关键项目控制

### 当前 Active Module
`MEDIA-LIBRARY-CLOUD-WORKSPACE-V1`

### AI 主线状态
**HOLD — NOT CANCELLED**

AI 一键填入检查点：
`4bbc838529b6f6d4a25cb3f330e86945692a0aef`

已完成：
Single Product → Multi Source → Conflict → Batch Review → Apply to same Draft。

仍待：
**一次真实 2–3 Sources DeepSeek Beta。**

在 Media Library Cloud Workspace V1 完成前：
- 不修改 AI Source Intake
- 不修改 Proposal Engine / Target / Review / Apply
- 不修改 provider / prompt
- 不进行新的 AI 功能施工

Media Library V1 封板后：
**必须先恢复真实 Multi-source DeepSeek Beta，再进入其他无关模块。**

## 开工顺序

1. Claude 只读基线核对
2. `ML-CLOUD-GOV-01`：治理与 D-023
3. 用户/ChatGPT 验收
4. `ML-CLOUD-01`：客户文件夹基础
5. 验收
6. `ML-CLOUD-02`：文件操作与重复保护
7. 验收
8. `ML-CLOUD-03`：拖拽上传与 UX 精修
9. 1440 / 375 最终验收
10. Media Library V1 封板
11. 恢复 AI Multi-source real Beta

**一次只施工一个已授权模块。**
