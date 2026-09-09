# MEDIA-LIBRARY-CLOUD-WORKSPACE-V1-BLUEPRINT

状态：Approved planning baseline — code implementation remains separately gated

## 1. 产品定位

Media Library 不再仅作为“图片上传图库”，而定义为：

> **Cloud-like Business Asset Workspace**

它是 LITUBO 后台企业业务原始资料的统一资产入口，为以下模块提供同一 Media UUID / ID：

- Product Center
- AI Source
- 未来 Content Center
- Settings / Branding
- 产品图片、PDF、证书、页面内容图等业务资产

它提供“像文件管理器一样方便”的操作体验，但不建设完整 Google Drive。

## 2. 长期原则：D-023（已登记，2026-09-09）

**状态：Confirmed。** 已由 `ML-CLOUD-GOV-01` 写入 `docs/project/08-decision-log.md`，并在 `MEDIA-AND-PRODUCT-DATA-GOVERNANCE.md` 决策 #9 展开为可执行的判定规则。

登记标题：

**D-023 — Media Library Cloud-like Business Asset Workspace**

Media Library is the single business-asset workspace for LITUBO. Protected system folders provide stable business classification, while customer-managed subfolders may be created, renamed, moved and archived for day-to-day organization. Files and downstream content reference stable Media UUID/ID values, so renaming or moving files/folders must not break Product, Content, Branding or AI Source references. Delete actions default to recoverable Trash/Archive; permanent deletion remains unavailable in V1 and requires global reference protection. Folder names are organization aids, not authoritative product facts.

Status: Confirmed（2026-09-09 登记，编号在登记时确认可用）。

**安全修正（ML-CLOUD-GOV-01 补充，优先级高于本节概述）：**

`unknown` **不等于** customer-managed。把「不在受保护清单中」直接视为客户可管，会把现有 fail-closed 安全模型全局反转。正确判定顺序为：

1. `ambiguous` → FAIL-CLOSED
2. `legacy-read-only` / `conflict-frozen` → 继续冻结
3. 精确命中 Protected System Folder → Protected
4. 已声明 customer-manageable zone 内的合法动态后代 → Customer-managed
5. 其余一切 → `unknown` → **FAIL-CLOSED**

完整规则见 `MEDIA-AND-PRODUCT-DATA-GOVERNANCE.md` 决策 #9。

## 3. 两类文件夹

### 3.1 Protected System Folders

用于稳定业务分类，例如：

- products
- products/xray
- products/metal-detection
- products/checkweigher
- products/combination
- products/conveyor
- resources
- company
- applications
- home

规则：
- 普通客户操作不可 Rename
- 不可 Move
- 不可 Trash
- 可以进入、浏览
- 根据既有 policy 决定是否允许文件直接落入
- **是否允许客户在其下建立子目录，必须逐节点明确指定，不得由「不在受保护清单中」推断**

### 3.2 Customer-managed Folders

客户在允许区域自行建立，例如：

- products/xray/LT-180C
- products/xray/LT-180C/manuals
- products/xray/LT-180C/photos
- resources/2026-expo

规则：
- Create
- Rename
- Move
- Move to Trash / Archive
- Restore（如 V1 采用 folder archive）
- 不得移动到自己或自己的后代节点
- 不得破坏系统目录边界

文件夹名称只是整理工具：
**不得成为型号、参数、语言、file role 或 AI truth 的唯一来源。**

正因为如此，customer-managed 区域内**允许**按型号整理（`products/xray/LT-180C`）——这与治理文档决策 #2 原本「不以型号作为文件夹层级」的表述冲突，已由决策 #9 明确修订：该限制现只适用于 Protected System Folder。

## 4. V1 文件功能

### 已有能力继续复用
- Media UUID
- Upload
- Search
- type filter
- multi-select
- Batch Move
- File Details
- single-file Archive / Restore
- Used in / References
- title / description / folder metadata

### 本 V1 补齐
- Rename file（用户可见/下载文件名；底层 UUID 不变）
- Batch Archive / Move to Trash
- Duplicate detection
- Drag & Drop files
- Folder upload / folder drop：若无需明显扩大范围则实现
- Broken thumbnail fallback
- 卡片排版与详情面板精修

## 5. Rename 规则

### File Rename
允许修改人类可见的下载文件名。
必须：
- UUID 不变
- Directus 引用不变
- Product / Content / AI Source 引用不失效
- 不通过 rename 创建第二份文件

### Folder Rename
仅 customer-managed folder。
系统目录拒绝。

文件夹改名后：
- folder UUID 不变
- 内部文件引用不变
- 子文件夹关系不变

## 6. Move 规则

文件与 customer-managed folder 可在允许区域移动。

必须服务端校验：
- 目标存在
- 目标不是被冻结/legacy/ambiguous/system-disallowed 节点
- folder 不可移动到自己
- folder 不可移动到自己的 descendant
- 不允许破坏 Protected System Folder

## 7. Trash / Archive

V1 的“删除”统一为可恢复：

User Delete / Move to trash
→ Archive / Trash
→ 可 Restore

V1 不做：
- Permanent Delete UI
- 物理删除
- cascade delete

仍被 Product / Content / Branding / AI Source 引用的文件：
- 不允许出现不可恢复的数据破坏
- 保持现有全局引用保护原则

## 8. Duplicate Detection

第一版目标：

### 内容完全相同
不同 filename 也视为 duplicate。
→ 提醒 / 阻止再次保存第二份。

### 同 filename、内容不同
→ 警告，不静默覆盖。
→ V1 可采用“取消 / 改名后上传”最简单流程。
→ 不要求版本历史。

实现优先：
- SHA-256 或同等稳定内容摘要
- 摘要不得成为浏览器业务数据
- 不为此新建复杂资产版本系统

若现有 Directus metadata 能安全复用则优先复用；
若必须引入 schema migration，Claude 必须先 STOP 报告，由用户单独授权。

## 9. Upload UX

V1 推荐：

- Upload files
- Drag files into library
- 选择目标文件夹
- 批量结果清楚显示：
  - uploaded
  - duplicate
  - unsupported / failed

Folder drop / Upload folder：
- 可以读取整个本地文件夹
- **不得自动把 Windows 本地层级原样复制为业务目录树**
- 默认导入到用户当前选定的 Media Library folder
- 若保留目录层级会扩大实现，V1 可只扁平导入并报告

## 10. Visual / UX

以：
`docs/design-reference/approved/admin-media-library-cloud-workspace-v1/`
为唯一视觉方向。

但功能范围以本文为最高优先级。

核心体验：
- 像文件管理器一样直觉
- 不做完整云盘
- 右侧详情可读
- 多选操作集中
- broken thumbnail 不污染布局
- 1440px 完整
- 375px 可用

## 11. 明确不做

- physical Copy
- Share links
- collaboration
- per-user file permissions
- storage billing / quota product
- version history
- file diff
- Office online editing
- desktop sync
- Google Drive integration
- OneDrive / Dropbox integration
- COS migration
- AI auto-foldering
- complex tags
- permanent delete

## 12. AI 主线冻结检查点

AI 一键填入没有结束。

冻结点：
`4bbc838529b6f6d4a25cb3f330e86945692a0aef`

状态：
**Code Complete / Real Multi-source Beta Pending**

Media Library Cloud Workspace V1 施工期间：
不得修改 AI Source Intake / Engine / Target / Review / Apply / provider / prompt。

Media Library V1 封板后：
项目下一动作必须恢复：
**2–3 TEST ONLY sources → 1 real DeepSeek Analyze → Multi-source Conflict Beta acceptance**

之后才能签收 AI 一键填入 V1。

## 13. P0 / P1 / P2

执行 FD-004。

P0：
- Rename/Move 破坏已存在引用
- 系统目录可被误删/改坏
- Trash 导致不可恢复资产丢失
- 跨产品/跨业务错误引用
- 文件覆盖造成原资产丢失

P1：
- 真正阻碍日常文件管理 V1 的操作错误
- broken thumbnail 严重影响使用
- duplicate 造成明显重复资产污染

P2：
- Grid/List 完美一致
- 高级排序
- 键盘快捷键
- 右键菜单完整度
- 大规模云盘优化
- 版本历史
- 外部云盘连接

P2 不阻塞。
