# LITUBO 实施契约、数据字典与决策登记册 V1

**定位：** 本文件把系统蓝图变成可实施、可测试的契约。它定义目标逻辑模型与边界；Claude 在 S0 前不得把它直接当作数据库迁移脚本。实际 collection 名称、既有字段、索引与权限必须先以仓库为准做差异核验。

## 1. 不可混淆的三层状态

这是整个系统最重要的统一约定。

| 层 | 字段/对象 | 用途 | 是否决定公开 |
|---|---|---|---|
| 正式版本状态 | `product_revision.status` | 唯一发布生命周期：`draft → review → published → archived`。 | **是** |
| 工作流步骤 | `product_revision.workflow_step` | 当前 Draft 的资料、AI、人工处理进度。 | 否 |
| 完整度/问题 | `readiness`、`validation_issues` | 计算出的缺失、冲突、来源和发布门槛。 | 否 |

因此，`imported`、`source_ready`、`ai_suggestions_ready`、`human_reviewing`、`review_ready`、`needs_correction`、`needs_source`、`blocked_by_conflict` 都是 `workflow_step` 或 Issue，不是第二套 Revision status。`approved` 是一次审核决定/审计事件，不是长期正式状态。

### 1.1 发布、撤回、回滚的精确定义

| 动作 | 允许条件 | 原子结果 | 公开站结果 |
|---|---|---|---|
| 首次发布 | Draft 已通过 Review，Publisher 有权限，门槛全通过。 | 当前 Revision `review → published`。 | 该 Revision 成为唯一公开版本。 |
| 替换已发布版本 | 同一 Product 的新 Revision 已通过 Review。 | 新 Revision 变 `published`；旧 Published Revision 变 `archived`，记录 `superseded_by`。 | 公开 DTO 在一次切换后只读新版本。 |
| 撤回（无替代版本） | Publisher 明确操作。 | 当前 Published Revision `published → archived`，记录 `withdrawn_reason`。 | 产品页/资源从公开 API、sitemap 退出；已知 URL 返回受控 410 或按用户决定的替代页。 |
| 回滚 | 存在历史 Archived Revision 且重新审核通过。 | 被选旧 Revision 作为新一次发布对象；可复制为新的 Revision 以保留不可变历史。 | 公开站切至通过审核的回滚版本。 |

不得用“编辑已发布记录”实现回滚或替换。缓存、sitemap、OG 和公开搜索索引的刷新是发布事务的后续任务，失败必须可重试并被监控。

## 2. 目标数据模型与关键约束

### 2.1 产品与版本

| 逻辑对象 | 必要字段 | 关系 | 约束/索引 |
|---|---|---|---|
| `product_families` | `id`, `family_code`, `name`, `shared_source_policy` | 1:N products | `family_code` 唯一；共享资料须显式授权。 |
| `products` | `id`, `product_code`, `family_id?`, `created_at`, `created_by` | 1:N revisions | `product_code` 全局唯一、不可由 AI 推测；不把公开事实直接放此表。 |
| `product_revisions` | `id`, `product_id`, `revision_no`, `status`, `workflow_step`, `schema_version`, `version`, `based_on_revision_id?` | 1:N product fields/specs/modules/relations | `(product_id, revision_no)` 唯一；每 Product 最多一个 `published`；`version` 用于乐观锁。 |
| `product_truth_fields` | `revision_id`, `field_path`, `value_json`, `confirmed_at?`, `confirmed_by?`, `locked` | N:1 revision | `(revision_id, field_path)` 唯一；被锁字段不可被 AI 写。 |
| `specifications` | `revision_id`, `group_key`, `spec_key`, `value`, `unit`, `sort`, `visibility` | N:1 revision | `(revision_id, group_key, spec_key)` 唯一；unit 必须在单位字典中。 |
| `page_modules` | `revision_id`, `module_key`, `enabled`, `sort`, `content_json` | N:1 revision | `module_key` 必须在固定模块字典；禁止任意 HTML 页面模块。 |

`Product Truth` 指 `product_truth_fields`、规格、固定页面模块等**经人工确认的结构化数据**；不等于 AI 原始输出、不等于附件文本、不等于客户项目数据。

### 2.2 Media、资源、关系与来源

| 逻辑对象 | 必要字段 | 关键约束 |
|---|---|---|
| `media_assets` | `id(UUID)`, `storage_key`, `sha256`, `version`, `access_level`, `display_approval`, `download_approval`, `lifecycle_state` | 业务对象只存 `id`；`storage_key` 不下发前台；同 hash 只允许按明确策略去重。 |
| `media_relations` | `media_id`, `owner_type`, `owner_id`, `role`, `sort`, `alt_text`, `public_override?` | `(owner_type, owner_id, media_id, role)` 受控；role 为 Hero/Gallery/PDF/Certificate 等枚举。 |
| `resources` | `id`, `resource_type`, `title`, `media_id`, `approval_state`, `locale` | 公开资源须同时满足内容审批和媒体下载规则。 |
| `content_items` | `id`, `type(application/case_study/insight)`, `status`, `locale` | 一期若没有受控编辑入口，只允许产品 Revision 以只读关系使用已发布内容。 |
| `source_bindings` | `revision_id`, `media_id`, `scope_type`, `scope_json`, `usage_permission`, `bound_by` | PDF 必须带页码范围；Excel 带 Sheet/单元格范围；不明范围不可进入 snapshot。 |
| `source_snapshots` | `id`, `revision_id`, `revision_version`, `schema_version`, `manifest_json`, `frozen_at`, `hash` | 冻结后不可改；内容变化建立新 snapshot。 |

**访问规则不是一个布尔值：** `access_level`（谁可看原件）、`display_approval`（可否显示在网站）、`download_approval`（可否公开下载）分别校验。物理删除必须先核验无引用、无保留期、无审计/法务限制；V1 默认归档而非物理删除。

### 2.3 AI、导入、审核与客户数据

| 逻辑对象 | 必要字段 | 关键约束 |
|---|---|---|
| `import_profiles` | `id`, `template_version`, `mapping_json`, `unit_rules_version` | 映射变更有版本，不隐式影响旧批次。 |
| `import_batches` | `id`, `workbook_media_id`, `status`, `profile_id`, `idempotency_key`, `created_by` | 预览阶段只写 staging；工作簿本身默认私有。 |
| `import_staging_rows` | `batch_id`, `sheet`, `row_no`, `raw_json`, `normalized_json`, `issues_json` | `(batch_id, sheet, row_no)` 唯一；不直接成为产品事实。 |
| `batch_draft_items` | `batch_id`, `product_revision_id`, `product_code`, `queue_order`, `summary_status` | 每项指向独立 Revision Draft；队列不能成为多产品 AI 上下文。 |
| `ai_runs` | `id`, `revision_id`, `source_snapshot_id`, `allowed_module_paths`, `provider_config_version`, `status`, `idempotency_key`, `cost_metadata` | 单次 run 只绑定一个 Revision+Snapshot；同一 Revision 同时最多一条活跃 run。 |
| `ai_suggestions` | `id`, `run_id`, `field_path`, `candidate_json`, `confidence`, `status`, `suggestion_version` | 只能生成候选，不能写 Truth；过期 snapshot 的建议不能接受。 |
| `suggestion_evidence` | `suggestion_id`, `media_id`, `media_version`, `locator_json`, `excerpt_hash?` | 每条可接受事实建议至少一条可定位证据。 |
| `human_decisions` | `subject_type`, `subject_id`, `action`, `actor_id`, `comment`, `before_json`, `after_json` | 接受/编辑/拒绝/解锁都必须审计。 |
| `inquiries` / `projects` | 客户字段、产品兴趣/Revision snapshot、隐私级别 | 只能引用产品；绝不反写 Product Truth。 |
| `integration_outbox` | `event_type`, `payload_ref`, `status`, `attempts`, `next_attempt_at` | HubSpot 同步幂等、可重试；客户提交先落库。 |

### 2.4 所有受治理对象的共通字段

每个主要对象应有：`id`、`created_at/by`、`updated_at/by`、`version`（可变对象）、`archived_at/by?`、`tenant/organization_id`（一期可仅预留）、`audit_event_id?`。前台永不收到操作者、内部评论、private locator、provider 详情或原始 storage key。

## 3. API 与并发契约

### 3.1 API 分层

| 类别 | 前缀 | 用途 | 规则 |
|---|---|---|---|
| Public Read | `/api/public/*` | 官网、SEO、sitemap。 | 只返回 Published DTO；无后台字段。 |
| Admin Query | `/api/admin/*` | 中文后台读取。 | 按角色/资源范围过滤；私有数据不靠前端隐藏。 |
| Admin Command | `/api/admin/*` 的 `POST` 命令端点 | 创建/绑定/提交/发布/AI/导入。 | 每个动作用专门命令，不提供任意表 PATCH。 |
| Internal Worker | `/internal/*` 或队列消费者 | 解析、AI、缓存、Outbox。 | 服务身份认证；不可被浏览器调用。 |

### 3.2 命令请求共同要求

所有可重复或改变状态的请求包含：

```json
{
  "idempotency_key": "uuid",
  "expected_version": 12,
  "request_reason": "optional human explanation"
}
```

- `expected_version` 不一致返回 `409 VERSION_CONFLICT`，包含当前 version 和安全的重新加载提示；不得静默覆盖。
- `idempotency_key` 在同一 actor + 端点 + 适当有效期内只执行一次，重复请求返回原结果。
- 写命令统一返回操作 ID、最新 revision version、审计事件 ID、下一允许动作；长任务返回 Job ID。
- 客户表单使用服务端幂等/速率控制，但不把后台 `expected_version` 暴露给访客。

### 3.3 必须稳定的错误码

| HTTP | 机器码 | 前端处理 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | 字段级高亮；不丢失用户输入。 |
| 401 | `AUTH_REQUIRED` | 登录或会话过期处理。 |
| 403 | `FORBIDDEN` | 隐藏敏感细节，说明无权限。 |
| 404 | `NOT_FOUND` | 公共站按页面规则；后台提示对象不存在/无权可见。 |
| 409 | `VERSION_CONFLICT` / `STATE_CONFLICT` / `ACTIVE_RUN_EXISTS` | 刷新/比较，不自动重试写入。 |
| 422 | `SOURCE_SCOPE_INVALID` / `READINESS_BLOCKED` / `SUGGESTION_STALE` | 显示缺少证据、资料范围或审核门槛。 |
| 429 | `RATE_LIMITED` / `BUDGET_LIMITED` | 显示等待时间/预算被阻止；不可偷偷改走更贵模型。 |
| 502/503 | `PROVIDER_UNAVAILABLE` / `INTEGRATION_RETRYING` | 保留 Draft/Inquiry，显示稍后重试状态。 |

### 3.4 关键命令的语义

| 命令 | 前置条件 | 成功结果 | 不可做的事 |
|---|---|---|---|
| `POST /product-revisions/:id/source-snapshots` | Draft、来源归属明确、范围完整。 | 冻结 hash/manifest。 | 不能扫描全库。 |
| `POST /product-revisions/:id/ai-runs` | snapshot 有效、字段/模块允许、无 active run。 | 返回 queued run。 | 不直接写 Truth/发布。 |
| `POST /suggestions/:id/accept` | 建议未过期、有证据、字段未锁或操作者显式解锁。 | 写入 Draft Truth + decision 审计。 | 不能改 Published Revision。 |
| `POST /product-revisions/:id/submit-review` | readiness 通过，Editor 有权限。 | `status: draft → review`。 | 不等于发布。 |
| `POST /product-revisions/:id/publish` | Review 已批准，Publisher 有权限，publish checklist 通过。 | 原子发布/替换、缓存任务。 | AI 或 Editor 不可调用。 |
| `POST /import-batches/:id/create-drafts` | preview 已确认、校验无 blocker。 | 只创建 Draft 和队列项。 | 不跑 AI、不发布。 |

## 4. 角色、权限与职责矩阵

真实账户映射必须由用户在 S2 前确认；以下为最小角色模型。

| 动作 | Editor | Reviewer | Publisher | Media Steward | Import Operator | AI Operator | CRM Operator | Visitor |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 创建/编辑 Draft | ✓ | 只读 | 只读 | 只读 | 只读 | 只读 | 否 | 否 |
| 绑定私有来源 | ✓（范围内） | 只读 | 只读 | ✓ | 否 | 只读 | 否 | 否 |
| 上传/归档 Media | 否 | 否 | 否 | ✓ | 否 | 否 | 否 | 否 |
| 发起/取消 AI run | ✓（自己的范围） | ✓ | ✓ | 否 | 否 | ✓ | 否 | 否 |
| 接受/编辑/拒绝建议 | ✓ | ✓ | ✓ | 否 | 否 | ✓（仅建议操作，不可越权确认） | 否 | 否 |
| 提交 Review | ✓ | 否 | ✓ | 否 | 否 | 否 | 否 | 否 |
| 审核通过/打回 | 否 | ✓ | ✓ | 否 | 否 | 否 | 否 | 否 |
| 发布/撤回/回滚 | 否 | 否 | ✓ | 否 | 否 | 否 | 否 | 否 |
| 导入预览/创建 Draft | 否 | 只读 | 只读 | 只读 | ✓ | 否 | 否 | 否 |
| 查看/重试 HubSpot outbox | 否 | 否 | 否 | 否 | 否 | 否 | ✓ | 否 |
| 查看公开产品 | ✓（按权限） | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

权限需要同时检查角色、组织/产品范围、对象状态和动作前置条件。Front-end 只用权限信息决定展示；后端仍须独立强制执行。

## 5. 前端联动与页面状态契约

| 页面 | 读什么 | 能触发什么 | 必须有的状态 |
|---|---|---|---|
| 公开产品详情 | Public DTO | 联系/技术匹配表单。 | loading、not found、archived、资源不可下载、媒体 fallback。 |
| 产品中心列表 | Admin Query 摘要 | 打开 Draft、创建产品、筛选。 | 无权限、空列表、发布/草稿标签、来源/完整度风险。 |
| 单型号 Product Dossier | 单 Revision + source bindings + issues + suggestions。 | 绑定资料、创建 snapshot、AI、接受建议、送审。 | 锁定字段、stale 建议、冲突、无来源、run 中、版本冲突。 |
| 多型号导入 | Batch、staging、mapping、issues、queue。 | 上传、映射、校验、预览确认、创建 Draft。 | parsing、mapping required、blocker、部分成功、不可写入预览。 |
| AI 队列 | `batch_draft_items` 摘要。 | 仅“打开下一单型号工作台”。 | 进度、阻塞、空队列、不能在队列页批量接受/发布。 |
| Review / 发布 | Revision / readiness / audit。 | 审核、发布、撤回、回滚。 | 缺项阻塞、权限不足、发布中、发布后结果。 |
| Media Library | assets + refs + visibility。 | 上传、关联、归档、批准公开。 | 引用保护、私有/公开差异、恢复。 |
| Inquiry / CRM | internal inquiry + outbox 摘要。 | 重试同步（授权角色）。 | 已收到、同步中、可重试失败、永久失败。 |

后台对每一项写入必须显示：影响对象、当前版本、来源/证据、操作人、成功/失败、是否需要重新加载。不能仅显示“AI 已完成”。

## 6. 真实 AI 前的安全、数据与预算契约

以下配置都必须显式记录到 `provider_config_version`，且由用户授权后才启用。

| 项目 | 默认 V1 | 真实试点前必须决定 |
|---|---|---|
| 训练使用 | 禁止把客户/私有资料用于模型训练。 | Provider 的数据保留/训练条款与地区。 |
| 输入范围 | 仅 frozen source snapshot。 | PDF/图片/OCR 是否可发往 Provider、是否需脱敏。 |
| 输出形式 | JSON schema 候选 + evidence locator。 | 模型版本、最大 token/文件数/页数。 |
| 费用 | 不调用真实 Provider。 | 每 run、每天、每月预算上限与告警人。 |
| 超时/重试 | 保留 Job，不影响 Truth。 | 最大重试次数、人工重试策略。 |
| 审计 | 记录输入 manifest hash、模型配置版本、耗时、token/成本、结果 hash。 | 是否/何时保留可读提示词、保留期。 |
| 数据删除 | Draft/证据按媒体保留规则；运行结果可审计。 | Provider 侧删除/保留确认方式。 |

Provider adapter 必须可替换；生产密钥仅由运行环境注入，绝不可进 Git、日志、截图或任务报告。

## 7. UAT、负向测试、恢复测试矩阵

| 域 | 正向验收 | 必做负向/恢复验收 |
|---|---|---|
| Revision | Draft → Review → Published；新版本替换。 | 非法状态跳转/无权限发布被拒；撤回、回滚、缓存刷新失败可重试。 |
| Product Truth | 人工确认字段出现在私有预览/发布页。 | AI/导入不能覆盖锁定字段；过期建议不能接受。 |
| Media | UUID 引用、批准公开后展示/下载正确。 | 私有 URL/原件无法经公开接口取得；引用中删除被拦截；归档可恢复。 |
| 单型号 AI | 单一快照生成带证据候选。 | 跨型号 UUID、范围不明 PDF、source 修改、重复点击、Worker 重试均被安全处理。 |
| 多型号导入 | 预览、校验、创建多个 Draft、逐项队列。 | 预览不写库；缺 product_code/单位冲突/错媒体阻塞；不能批量 AI 接受或发布。 |
| 公开前台 | Published 内容、SEO、资源、CTA 正确。 | Draft/archived/preview/私有资源不公开；404/410 和 fallback 正确。 |
| CRM | Inquiry 先保存、Outbox 成功后标 synced。 | HubSpot 失败客户仍成功提交；重试幂等；无 PII 泄露到浏览器日志。 |
| 安全 | 角色/范围符合矩阵。 | 直接调用 Nitro/Directus、篡改 ID、CSRF、限流、越权下载均失败。 |
| 视觉 | 1440px 和 375px 核心路径可用。 | 无横向溢出、键盘可达、错误状态不被遮挡。 |
| 恢复 | 备份可恢复到隔离环境，恢复后关键 public/private 权限正确。 | 不用生产数据做未授权破坏性演练；记录 RPO/RTO 与缺口。 |

## 8. 环境、发布与备份边界

| 环境 | 允许 | 禁止 |
|---|---|---|
| local | fixtures、mock AI、模拟 CRM、可逆迁移演练。 | 使用真实生产凭据/客户敏感资料。 |
| staging | 受控测试数据、批准的集成测试。 | 未确认公开发布、绕过 UAT。 |
| production | 经审批的迁移、发布、监控、备份。 | 临时调试、未审核数据、无回滚点部署。 |

发布前必须有：数据库备份及恢复说明、媒体备份/版本策略、迁移回滚计划、部署版本号、环境变量清单（只列名称，不列值）、健康检查、负责人与观察窗口。生产数据库变更、media 批量操作、真实 AI/HubSpot 启用是独立授权项。

## 9. 未决决策登记册

默认策略均为 **停止/不公开/不调用外部服务**，直到用户确认。

| ID | 决策 | 影响阶段 | 默认 | 决策人 |
|---|---|---|---|---|
| D-01 | Product Truth 字段、单位与发布完整度门槛。 | S2/S4/S6 | 不发布缺项产品。 | 用户 |
| D-02 | 实际角色人员与权限范围。 | S2 | 拒绝高风险动作。 | 用户 |
| D-03 | Content Center/Resources 一期策略：受控编辑、只读关联或后置。 | S2/S6 | 不做空壳编辑页。 | 用户 |
| D-04 | 撤回后的 URL：410、替代系列页或重定向。 | S6/S12 | 受控 410。 | 用户 |
| D-05 | 公开资料展示/下载分级、保留期、媒体归档者。 | S3/S6 | 私有且不可下载。 | 用户 |
| D-06 | AI 试点型号、资料包、Provider、地区、保留/训练、费用限额。 | S9 | 不真实调用。 | 用户 |
| D-07 | 多 Sheet 模板最终字段、冲突策略、队列责任人。 | S10 | 只 staging，不创建 Draft。 | 用户 |
| D-08 | HubSpot 字段映射、真实写入时机、重试责任人。 | S11 | 仅 mock/outbox。 | 用户 |
| D-09 | 官网原始视觉母版、页面优先级、移动端断点细节。 | S4/S6 | 不猜测重画。 | 用户 |
| D-10 | 域名、部署、备份周期、上线/回滚授权人。 | S13/S14 | 不部署。 | 用户 |

## 10. Claude 在 S0 后须输出的差异表格式

| 契约项 | 本包目标 | 仓库事实与证据 | 结论 | 建议动作 | 是否需用户决定 |
|---|---|---|---|---|---|
| Revision status | 四态正式状态 | 文件/迁移/接口 | 已有/缺口/冲突 | 最小修复模块 | 是/否 |
| workflow_step | 与 status 分离 | 同上 | 同上 | 同上 | 是/否 |
| Published 唯一性 | 每 Product 一条 | 同上 | 同上 | 同上 | 是/否 |
| Media UUID/可见性 | 三层规则 | 同上 | 同上 | 同上 | 是/否 |
| Snapshot/AI | 单型号 immutable scope | 同上 | 同上 | 同上 | 是/否 |
| 公开 DTO | 只 Published | 同上 | 同上 | 同上 | 是/否 |
| CRM Outbox | 内部优先 | 同上 | 同上 | 同上 | 是/否 |

