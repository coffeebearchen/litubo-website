# MEDIA-LIBRARY-CLOUD-WORKSPACE-V1-IMPLEMENTATION-PLAN

状态：Controlled implementation plan

## 总控规则

一次只推进一个模块。
每个模块：
盘点 → 实施 → 测试 → 1440/375 → git status → commit → CURRENT-STATE → STOP。

未经单独授权不得自动进入下一模块。

AI checkpoint `4bbc838...` 全程冻结。

---

## ML-CLOUD-GOV-01 — Governance + Dynamic Folder Policy ✅ COMPLETED（2026-09-09）

**成果：** D-023 已登记；`MEDIA-AND-PRODUCT-DATA-GOVERNANCE.md` 新增决策 #9（文件夹治理双层模型），并就地标注决策 #2 中被修订的两条 v0.1 规则；分支 `review/ml-cloud-workspace-v1` 已从 AI checkpoint `4bbc838` 隔离创建。**零 runtime 代码改动。**

### 目标
先解决现有“文件夹必须写死登记”与“客户可自行建立子文件夹”的治理冲突。

### 只做
- 阅读当前 Folder Registry、Media Governance、Decision Log、CURRENT-STATE
- 登记 D-023（若编号仍可用）
- 更新 `MEDIA-AND-PRODUCT-DATA-GOVERNANCE.md`
- 更新 `CURRENT-STATE.md`
- 必要时最小同步 MASTER-ROADMAP
- 写清 Protected System Folder vs Customer-managed Folder
- 设计现有 Folder Registry 如何演进，避免把每个客户目录写进代码常量

### 不做
- 不写业务功能代码
- 不创建 folder
- 不修改 Directus schema
- 不碰 AI

### 验收
文档与当前真实架构不冲突，后续代码有明确边界。

---

## ML-CLOUD-01 — Customer Folder Foundation ✅ COMPLETED（2026-09-09）

**成果：** `FolderManagement` 维度与 `PolicyState` 分离；五个产品类目根声明为 customer-manageable zone；customer folder 继承 zone 根的文件内容策略；新增 folder create / rename / move 端点与前端动作；面包屑复用既有实现。顺带修复既有上传 bug（Directus multipart 字段顺序导致目标文件夹被静默丢弃）。

**Folder Trash / Restore = P1 deferred** —— 只读确认：文件级归档依赖专门的 lifecycle collection，Directus folder 无等价字段，实现需新数据结构保存 trash state 与 original parent（schema 改动），按业务校准不阻塞本模块。文件级 Archive / Restore 保持现状。

### 目标
让客户在受控区域真正管理自己的文件夹。

### 功能
- New folder
- Rename customer folder
- Move customer folder —— **只能在其所属的 declared customer zone 内移动**（D-023）；跨 zone → 422 `FOLDER_ZONE_MISMATCH`
- Move customer folder to Trash / Archive（如果现有 Directus 能安全实现）
- Protected System Folder 拒绝 Rename / Move / Archive
- Folder path UI
- customer folder 在 sidebar / main view 正确显示

### 关键约束
- 不新增第二套文件系统
- 使用 Directus folder UUID
- 不把客户目录硬编码到 `FOLDER_POLICY`
- folder rename/move 不影响 file UUID / business refs
- descendant cycle 必须拒绝

### 必须遵循的治理产物（ML-CLOUD-GOV-01 产出）
- **判定优先级五级**（ambiguous → legacy/conflict → protected → customer-managed zone → unknown）见 `MEDIA-AND-PRODUCT-DATA-GOVERNANCE.md` 决策 #9.3
- **`unknown` 继续 FAIL-CLOSED**，不得因为「不在受保护清单中」而开放（决策 #9.4）
- **文件夹治理维度与文件写入维度必须分离**（决策 #9.5）——具体运行时类型如何演进属于本模块的实现范围，但不得用一个状态值同时承担两个职责
- Protected System Folder 是否允许客户在其下建子目录，必须**逐节点明确指定**，不得推断

### 验收
1440/375；
创建→进入→改名→移动→仍可浏览其文件；
系统目录不能被改坏。

---

## ML-CLOUD-02 — File Operations + Duplicate Protection ✅ COMPLETED（2026-09-09）

**成果：** File Rename（`filename_download`，UUID / storage object / MIME / 引用均不变）；Duplicate Warning（same folder + same normalized filename + same filesize，仅提醒，Cancel / Upload anyway 由人决定）；Batch Archive（复用单文件 Archive 的引用保护，逐文件判定与报告）。既有 File Move / Batch Move / Multi-select / Search / Filter 回归通过。

**既有 `products_files` 403 已关闭，且不是权限问题：** 根因是我们自己的查询请求了 `products` 上不存在的 `name` 字段（该表只有 `name_en`），Directus 对「字段不存在」也返回 403。改用 `name_en` 后 References 与 Archive 恢复，**未改动任何 Directus 权限或 schema** —— 因此 Batch Archive 得以在本模块实现而非 deferred。

**Duplicate 前置只读核对结论：** `directus_files` 共 27 列，**不存在** checksum / hash / digest / etag，故按施工单采用简单启发式，未新增 schema。


### 功能
- Rename file
- Batch Archive / Move to Trash
- Restore 继续可用
- Batch Move 继续可用
- duplicate detection
- duplicate warning
- Used in / references 不退化
- UUID stability 验证

### Rename
优先修改用户可见 filename_download；
不得改动 UUID；
不得复制物理文件。

### Duplicate

**开工前强制前置（ML-CLOUD-GOV-01 确立）：** 在动手实现 duplicate detection 之前，必须先**只读**确认 Directus 中是否已存在可安全复用的 `hash` / `checksum` / `content digest` 字段或机制，并在报告中写明结论。本轮（GOV-01）**未**查询 Directus production schema，因此该确认仍未完成。

同内容 → 阻止重复资产。
同名不同内容 → 警告，V1 不静默覆盖。

如果可靠 dedupe 必须新增 **Directus schema / DB migration / collection field**：
**STOP → 单独取得用户授权。** 不得在 ML-CLOUD-02 中顺手迁移 schema。

摘要（SHA-256 或等价）只在服务端使用，**不得成为浏览器业务数据**。

### 验收
- rename 后 Product reference 仍有效
- move 后 reference 仍有效
- duplicate 不产生第二份
- batch archive 可恢复
- 被引用资产不发生不可恢复破坏

---

## ML-CLOUD-03 — Drag & Drop + UX Polish ✅ COMPLETED（2026-09-09）

**成果：** Drag & Drop 上传（与上传按钮共用同一条 pipeline，不绕过 folder policy / duplicate warning / 格式校验）；Broken thumbnail fallback（固定尺寸盒子，布局不跳动）；Upload folder 以 `webkitdirectory` 极简实现（扁平导入，不重建本地目录树）；卡片以文件名为主标题、Title 降为次级；面包屑新增 `↑ Up` 与系统目录锁标；选择摘要条；按空态原因分支的 empty state；上传错误逐文件报告失败原因。

**修复本模块引入的 375px 回归：** 移动端放开上传下拉 `max-width` 后，`<select>` 由最宽 `<option>` 决定固有宽度，把工具栏顶到 506px；需容器 `min-width: 0` + select `min-width: 0` 与 `width: 0` 三处协同。


### 功能
- Drag & Drop files
- Upload files
- Upload folder / folder drop：**P1 / cost-dependent，不是 V1 封板的 P0**。不得因为视觉母版出现该能力就扩大范围
- 上传状态清楚
- duplicate / unsupported 明确
- broken image fallback
- 文件名/缩略图不重叠
- card spacing / selection states / details panel 对齐视觉母版
- mobile bottom sheet / usable actions

### Visual master
严格阅读：
`docs/design-reference/approved/admin-media-library-cloud-workspace-v1/00-VISUAL-MASTER-RULES.md`

### 不做
不因视觉图出现而实现：
Storage quota、Owner、Tags、Download selected 新模块、Permanent Delete、Share、AI Workspace、Reports、billing。

### 验收
1440：
- 无 horizontal overflow
- 文件树清楚
- cards clean
- multi-select toolbar
- details
- drag/drop
- broken thumbnail fallback

375：
- 无 horizontal overflow
- 浏览
- 选择
- 上传
- Move
- Trash/Archive
- Details 可用

Console clean。

---

## ML-CLOUD-UI-CLEANUP-01 — Information Architecture + Visual Cleanup ✅ COMPLETED（2026-09-10）

**成果：** Sidebar 由平铺 21 项重构为 9 项三分区一级导航（Library / Folders / System，System 默认 collapsed）；二级及以下目录只出现在主内容 Folder Browse；Breadcrumb 成为当前位置唯一事实源并移除右上角 Current Folder 下拉；工具栏正常状态只保留 `+ New folder` 与 `Upload ▾`；New folder 改为显式声明 Location 的 modal；Rename / Move 改为文件夹 tile 的 `⋯` contextual 操作；`Select folder` 更名为 `Upload folder contents`；常驻拖放横幅改为仅拖拽时出现；主内容分 `FOLDERS` / `FILES`；file grid 由 6 窄列改为 4 列并允许文件名两行；File Details 默认不占宽度。

**未改动：** Folder Governance、folder backend semantics、Media UUID、references、duplicate algorithm、archive lifecycle、Directus schema / permission、AI runtime。

**下一步：`PWS-AI-MULTI-SOURCE-REAL-BETA-01` — AUTHORIZED BUT PAUSED / NOT STARTED，等待 UI 验收。**

---

## ML-CLOUD-V1-FINAL — 封板验收 ✅ COMPLETED / SEALED（2026-09-09）

**结论：MEDIA-LIBRARY-CLOUD-WORKSPACE-V1 = COMPLETED / SEALED。** 七个 Gate 全部通过；Gate 1 的 stray upload 经静态调用链 + 运行时双哨兵观察判定 `NOT REPRODUCIBLE / NO AUTOMATIC UPLOAD PATH FOUND`；Gate 7 发现并修复一个真实 P0 —— Search 此前受当前 folder 过滤而变成局部搜索，违反「Search = global Media Library search」，已改为搜索激活时不附加 folder 过滤并加提示。1168 测试通过、typecheck / lint / build 全绿、1440 四状态与 375 全部无横向溢出。AI runtime 自 `4bbc838` 起改动 0 个文件。

**下一步：`PWS-AI-MULTI-SOURCE-REAL-BETA-01` — NOT STARTED，等待授权。不得先进入其他 AI / Content 模块。**


只验收，不扩功能。

确认：
1. Customer folder CRUD（按 V1 范围）
2. Protected folders
3. File rename / move / archive / restore
4. multi-select / batch move / batch archive
5. duplicate protection
6. drag/drop
7. thumbnail fallback
8. references stable
9. 1440/375
10. full Node 22 gate
11. CURRENT-STATE updated
12. master 未动
13. 无 deploy

封板后：

**下一模块不是 Content Center，不是 PDF/Image AI。**

必须恢复：
`PWS-AI-MULTI-SOURCE-REAL-BETA-01`

执行：
3 TEST ONLY TXT → 1 real DeepSeek Analyze → 验证 normal facts / conflict / unknown / source summary。

完成 AI V1 正式签收后，再重新排下一阶段。
