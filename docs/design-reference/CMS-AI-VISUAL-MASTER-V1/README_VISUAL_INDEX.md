# LITUBO Visual Master Index V1

**用途：** 此索引是 Claude 的视觉唯一入口。每个页面必须同时拥有已确认的 1440px 与 375px 母版；没有对应 `CONFIRMED` 图，不得开始该页面正式代码施工。

## 状态定义

- `DRAFT`：GPT 生成的候选设计，等待用户确认。
- `REVIEW`：用户提出修订，正在调整。
- `CONFIRMED`：用户明确确认，Claude 必须严格遵循。
- `SUPERSEDED`：已被新版本取代，禁止继续参考。
- `EXISTING-CONFIRMED-SOURCE-NEEDED`：此前已确认，但原始 PNG 尚未复制到本包。

## 当前图纸

| ID | 页面 | 桌面 1440 | 手机 375 | 状态 | 不可改变 |
|---|---|---|---|---|---|
| ADM-02 | 产品中心 / Product Center | `admin/desktop-1440/LITUBO_CMS_ADM-02_Product-Center__default__desktop-1440__v01.png` | `admin/mobile-375/LITUBO_CMS_ADM-02_Product-Center__default__mobile-375__v01.png` | DRAFT | 总表不提供批量 AI 填表或批量发布；AI 仅是单型号入口、导入入口、完整度检查与审核队列。 |
| ADM-04–08 | 单型号 Product Dossier | `logic-references/01_single_product_dossier_workbench.png` | 待单独设计 | DRAFT（流程参考） | 一个 Draft + 一个冻结资料快照；证据、人工接受、字段锁定、固定网页模块。 |
| ADM-09–11 | 多型号导入与逐项审核队列 | `logic-references/02_multi_model_import_ai_review_queue.png` | 待单独设计 | DRAFT（流程参考） | 导入建立多个 Draft；AI 按型号逐个工作，不能混合或批量发布。 |
| PUB-00–09 | 公开官网页面组 | 现有 `docs/design-reference` 中已确认母版 | 现有 `docs/design-reference` 中已确认母版 | EXISTING-CONFIRMED-SOURCE-NEEDED | 保留原路径和文件名；以此前用户确认的官网视觉母版为唯一参考，不从后台图推测。 |

## 后续出图顺序

1. ADM-02 产品中心（本批：桌面 + 手机，等待确认）；
2. ADM-03 新建单型号 Draft；
3. ADM-04/05 Dossier 总览与资料范围；
4. ADM-06/07 AI 证据审核与官网模块预览；
5. ADM-08 Review / Revision / 发布；
6. ADM-09/10 多型号导入与字段映射；
7. ADM-11/14/15 队列、AI 指挥台与任务详情；
8. ADM-12/13 Media Library 与引用保护；
9. ADM-16/17 询盘与技术匹配；
10. ADM-18/19 设置、Schema、权限、AI Policy；
11. 补齐/归档 PUB-00–09 的此前确认官网母版与必要系统状态图。

每次只让用户确认一个页面组的桌面+手机版，避免 Claude 在多个未确认视觉方向之间选择。
