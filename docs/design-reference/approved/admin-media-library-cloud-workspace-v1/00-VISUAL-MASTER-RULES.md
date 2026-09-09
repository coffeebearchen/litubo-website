# Media Library Cloud Workspace V1 — Visual Master Rules

状态：Approved visual direction for V1 implementation

## 视觉文件

| 文件 | 权威级别 | 用途 |
|---|---|---|
| `01-desktop-library-overview.png` | PRIMARY（1440px） | 桌面主视图：文件树、文件卡片、详情侧栏 |
| `02-desktop-folder-management.png` | PRIMARY（1440px） | 桌面文件夹：新建、文件夹卡片、文件夹操作 |
| `03-desktop-batch-selection.png` | PRIMARY（1440px） | 桌面多选状态与批量工具栏 |
| `04-desktop-upload-dedup.png` | PRIMARY（1440px） | 拖拽上传、上传队列、重复提醒的视觉方向 |
| `07-mobile-layered-folder-navigation.png` | **PRIMARY（375px）** | **`/admin/media` 手机端主母版**：信息层级、分层文件夹导航、分组折叠、row / badge / touch target、空态 |
| `05-mobile-library-overview.png` | Supplementary mobile reference | 手机端文件浏览与选择 |
| `06-mobile-file-details.png` | Supplementary mobile reference | 手机端详情抽屉 / Bottom Sheet 与多选操作 |

### 手机端母版权威（ML-CLOUD-MOBILE-VISUAL-ALIGN-01，2026-09-10）

```text
07-mobile-layered-folder-navigation.png
=
PRIMARY visual master for /admin/media at 375px
```

`05` 与 `06` 保留，但降为 **Supplementary mobile references**：它们仍是文件卡片、多选栏与 File Details 抽屉的参考，**不再定义手机端的信息层级**。当 `05` / `06` 与 `07` 在页面结构、分组或导航层级上不一致时，以 `07` 为准。

两份 supplementary 图中出现而 V1 未授权的元素（底部 Tab Bar、通知铃铛、Owner、Download selected、视频资产等）仍按下方「图片中出现但 V1 明确不授权的内容」处理 —— 升级 `07` 不改变任何功能授权范围。

## 母版优先级

这些图片定义：
- 布局节奏
- 留白
- 卡片比例
- 文件夹树层级
- 选中状态
- 详情面板形式
- 拖拽上传的视觉表达
- 1440px 与 375px 响应式方向

**功能范围以 Blueprint / Implementation Plan 为准。**
如果图片中出现超出 V1 的功能，不得因为图片存在就自行实现。

## V1 允许从视觉中实现

- New folder
- Upload files
- Upload folder / folder drop（仅在本轮实现成本合理时）
- Drag & Drop
- Grid / List（List 若成本明显扩大可后置，不阻塞）
- Search / basic filter
- File details
- Rename
- Move
- Move to Trash / Archive
- Restore
- Multi-select
- Batch Move
- Batch Archive
- Duplicate warning
- Used in / References
- clean thumbnail fallback

## 图片中出现但 V1 明确不授权的内容

以下即使出现在母版图，也**不要实现**：

- Storage quota / Upgrade Storage
- Owner
- Add tags
- Download selected 作为新业务模块
- Permanent Delete
- Share / collaboration
- AI Workspace 新导航或新 AI 功能
- Reports 新模块
- 云盘套餐 / billing
- 文件版本历史
- 权限共享
- 在线 Office 编辑
- COS 迁移
- 桌面同步客户端

### Delete 的解释

母版中的 `Delete` / `Delete selected` 在 V1 一律解释为：
**Move to Trash / Archive，可恢复。**

不开放物理永久删除。

## 视觉约束

- 延续现有 LITUBO Admin：英文为主。
- 保持现有冷白、浅蓝灰、深绿、小面积橙色警示。
- 不引入独立 SaaS 风格的新导航体系。
- 业务文件名必须与缩略图区域物理分离，不允许 broken image alt text 与卡片正文重叠。
- 文件名必须截断/换行可控。
- 1440px 优先完成完整工作台。
- 375px 重点保证可浏览、选择、上传、移动、归档、查看详情；不强塞桌面所有列。
- 不为了像 Google Drive 而复制 Google Drive。
- 目标是：**文件管理器的易用性 + CMS 的引用安全。**
