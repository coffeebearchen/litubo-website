# Claude Code 施工任务书与完工报告模板 V1

本模板由 GPT / Codex 填写；用户明确授权后才可交给 Claude Code 执行。每次只用于一个模块。

## 1. 开工任务书模板

```text
【施工授权｜模块编号：S?-??】
状态：已授权施工

一、模块名称
[名称]

二、目标
[让哪一种用户，在何种边界内完成什么动作]

三、开工前必须只读核对
1. 阅读 CLAUDE.md；
2. 阅读 docs/project/CURRENT-STATE.md；
3. 阅读 docs/project/MASTER-ROADMAP.md；
4. 检查 git status --short、当前分支、相关服务与相关文件；
5. 如本任务书与仓库事实冲突，停止并报告，不修改代码。

四、已确认输入
- 业务决定：
- 数据治理决定：
- 视觉母版 / 页面参考：
- 相关系统蓝图章节：
- 当前真实项目状态：以 CURRENT-STATE.md 为准。

五、允许施工范围
- 前端：
- Nitro / API：
- Directus / schema：
- 文档：
- 测试：

六、明确禁止事项
- 不修改：
- 不新增：
- 不导入：
- 不接入：
- 不发布 / 不 push / 不部署：
- 不读取或输出凭证：

七、固定实现约束
- Product / Media / Revision / AI / Inquiry 边界：
- 必须复用的组件、字段模板、Media UUID 或 Public DTO：
- 测试数据标识：TEST ONLY — NOT FOR PUBLICATION；
- 资料可见性、权限、审计、状态机要求：

八、验收标准
- 功能流程：
- 负向测试：
- Draft/Published/私有资料隔离：
- 1440px 桌面：
- 375px 手机：
- 错误、空、无权限、失败/回退状态：
- 不得出现：

九、停止条件
- [本模块专属]
- 任何跨模块、真实外部动作、资料冲突或未确认业务规则，必须停止。

十、推荐模型
- [中等 / 高 / 最高推理]
- 模块中途不得自行切换；如有必要，先报告原因。

十一、完工报告必须包含
- 实际完成与受影响文件；
- 测试命令、结果和 exit code；
- 1440px / 375px 验证；
- 数据、权限与公开隔离验证；
- git diff --check、git status --short；
- 本地 commit hash；
- CURRENT-STATE.md / MASTER-ROADMAP.md 更新；
- 已知限制、风险与下一步需要用户决定的事项。
```

## 2. Claude 完工报告模板

```text
【模块完成报告｜S?-??】

结论：Completed / Blocked / Needs Fix
是否达到全部验收标准：是 / 否（说明）

一、实际完成内容
- ...

二、受影响文件
- 路径：
- 作用：

三、测试证据
- 命令：
- 结果：exit code ...
- 覆盖流程：

四、视觉验证
- 1440px：
- 375px：
- 水平溢出、遮挡、点击、无权限、错误状态：

五、数据与安全核对
- 测试资料标识：
- Draft / Published：
- 私有媒体与公开 API 隔离：
- 是否涉及真实外部数据：否 / 是（必须解释并附授权）
- 是否产生模型/API费用：否 / 是（必须解释并附授权）

六、Git
- git diff --check：
- git status --short：
- 本地 commit：
- commit message：

七、项目档案
- 已更新：
- 未更新及原因：

八、范围外发现与风险
- ...

九、下一步需要 GPT / 用户决定的事项
- ...
```

## 3. GPT 审查清单

GPT 收到报告后按顺序核对：

1. 是否只做了授权范围；
2. 是否把建议写成了已确认事实；
3. 是否破坏 Product Truth、Media UUID、Draft/Review/Published 或 AI 隔离边界；
4. 是否真的验证桌面、手机、权限与负向流程；
5. 是否有测试、Git、commit、项目档案证据；
6. 是否仍需用户确认业务、视觉、资料授权或外部动作。

GPT 只能给出：`接受收口`、`需定点修复`、`资料/规则待确认`、`证据不足` 四种结论。

