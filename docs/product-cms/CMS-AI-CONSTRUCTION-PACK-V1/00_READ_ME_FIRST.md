# LITUBO 官网 + CMS + AI 施工总包 V1

**生成日期：** 2026-09-05  
**用途：** 将已确认的业务、视觉、数据治理与协作方法，交给用户、GPT / Codex 与 Claude Code 共同执行。  
**本包不授权：** 改代码、改数据库、接入 AI Key、产生 API 费用、导入真实产品资料、发送外部消息、push、部署或发布。

## 1. 这套文件解决什么问题

本包不是一份泛泛的技术方案，而是 LITUBO 的施工总图。它确保：

1. 公开网站、中文后台、CMS、Media Library、AI、Technical Matching 与 HubSpot 不会各自形成第二套数据；
2. 平面设计、数据库/API、前台页面与后台工作流使用同一套产品事实与发布规则；
3. GPT 负责总逻辑、任务书与验收，Claude Code 只在授权范围内施工，用户保留业务与发布决定权；
4. 每次施工可核对、可回退、可审计，避免“页面做出来但资料、权限、AI 和发布逻辑断开”。

## 2. 事实优先级

任何实施时，以下优先级不可颠倒：

```text
1. 当前仓库代码、Git 状态、实际 schema、运行服务
2. docs/project/CURRENT-STATE.md
3. docs/project/MASTER-ROADMAP.md 与 CLAUDE.md
4. 已确认的长期治理与系统蓝图文件
5. 已确认的视觉母版与页面设计
6. 聊天记录、旧报告、模型记忆
```

如果上列内容互相冲突，Claude 必须停止并报告；不得自行猜测、迁移、重写或覆盖。

## 3. 当前已知快照（实施前必须由仓库复核）

- 目标栈：Nuxt 3 + Vite + Nitro；Directus + PostgreSQL；Media Library 使用独立媒体卷与 UUID 引用。
- 公开网站一期英语 EN；ES/PT 结构预留，未审核内容不可公开。
- 后台中文、前台英文；手机端也必须验收。
- 手工 Product CMS 目前已达到管理员预览阶段；AI 导入尚未开始；本地、可逆的发布往返验收仍须以仓库事实核对。
- 真实资料、外部写入、AI Key、费用、push、部署与公开发布均需用户单独授权。

## 4. 阅读与使用顺序

| 顺序 | 文件 | 谁必须读 | 作用 |
|---|---|---|---|
| 1 | `00_READ_ME_FIRST.md` | 全部人员 | 使用顺序、事实优先级与范围。 |
| 2 | `01_COLLABORATION_PROTOCOL.md` | 用户、GPT、Claude | 三方职责、施工授权、停止条件与完工证据。 |
| 3 | `06_PRODUCT_CMS_AI_DATA_GOVERNANCE_V1.md` | GPT、Claude | 产品真相、媒体、版本、AI、公开性与权限的硬规则。 |
| 4 | `07_AI_PRODUCT_IMPORT_REVIEW_BACKEND_DESIGN.md` | GPT、Claude | 单型号 AI Dossier、多型号导入与逐项审核的专门设计。 |
| 5 | `02_SYSTEM_BLUEPRINT_FRONTEND_BACKEND_AI.md` | GPT、Claude | 前台、后台、CMS、媒体、AI、HubSpot 的整体关系与前后端契约。 |
| 6 | `03_ADMIN_VISUAL_REFERENCE_AND_PAGE_MAP.md` | 用户、GPT、Claude | 已确认视觉方向、后台页面地图、每页的读写边界。 |
| 7 | `04_CONSTRUCTION_ROADMAP_AND_TASKS.md` | 用户、GPT、Claude | 模块顺序、授权节点、验收门槛与停止条件。 |
| 8 | `08_IMPLEMENTATION_CONTRACTS_AND_DECISION_REGISTER.md` | GPT、Claude、用户 | 状态机消歧、目标数据模型、API、权限、UAT、环境边界与用户待决项。 |
| 9 | `09_PRE_S2_DECISION_GATES_AND_SECURITY_DESIGN.md` | GPT、Claude、用户 | S2 前必须冻结的 Schema、审核、认证、文件安全、队列与公开路由决策。 |
| 10 | `10_INSTALLATION_AND_VISUAL_MASTER_LOCATIONS.md` | 用户、GPT、Claude | 本机安装路径、视觉母版目录、完整设计图清单与批准门槛。 |
| 11 | `05_CLAUDE_MODULE_WORK_ORDER_TEMPLATE.md` | GPT、Claude | 每个模块开工与完工报告的可复制格式。 |

## 5. 本包中的视觉参考

`docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/` 含当前已生成的两张后台逻辑参考图：

1. `01_single_product_dossier_workbench.png`：单型号 Product Dossier；AI 实际填表、来源证据、字段审核与固定详情页模块。
2. `02_multi_model_import_ai_review_queue.png`：多型号导入后按型号逐个 AI 审核的任务队列。

它们是后台工作逻辑与视觉层级的参考；不代表可直接复制的代码。此前已确认的官网桌面端视觉母版不在当前工作区内，本包以文字视觉契约记录其不变规则。Claude 如需精确还原公开网站视觉，必须另行取得这些原始母版图，不得自行重画或猜测。

## 6. 安装到仓库前的规则

1. 先由 Claude 只读检查现有 `docs/project/` 的文件结构与命名习惯；
2. 不得直接覆盖已有项目档案；若文件已存在或内容冲突，停止并给出差异报告；
3. 经用户确认后，再把本包内容按仓库真实结构合并为项目档案；
4. 所有后续实施必须以仓库中的正式版本为准，而不是以本压缩包副本为准。

## 7. 本包仍需由用户补给的输入

- 已确认的官网桌面/手机端原始视觉母版图（当前工作区没有这些文件）；
- 真实产品字段、单位、公开资料等级、审核人和发布人；
- 真实 AI 试点的资料范围、供应商/预算/数据保留确认；
- 真实 HubSpot 字段映射与启用写入的授权。

在这些输入到位前，Claude 可以完成只读核验、mock、schema/接口契约和不使用真实资料的测试；不得猜测真实内容或开启外部服务。
