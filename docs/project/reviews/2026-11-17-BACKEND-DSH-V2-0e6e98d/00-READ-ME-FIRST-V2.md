# 新版唯一施工入口：BACKEND-DSH-V2-0e6e98d

日期：2026-11-17。依据：业主本次上传的DSH完整指令，原文保存在`00-DSH-SOURCE-AS-RECEIVED.txt`。

**业主已明确：前一版后端方案暂不采用。本包是重新整理的V2，不得与c963115版的UI、API建议或施工指令混用。**

唯一Drive入口：
https://drive.google.com/drive/folders/1HROQkTEOH6pavE58VNXwizmI7AOiw3_p

## 给DSH的读取顺序

1. 核对`CURRENT-PLAN.json`的plan_id为`BACKEND-DSH-V2-0e6e98d`。
2. 完整读`01-BACKEND-DESIGN-V2.md`，包括A/B/C/D/E/F。
3. 对照`ui/`的UI-01至UI-05五组设计参考图与`08-UI-SPECS-V2.md`。
4. 读`02-PAGE-CORRESPONDENCE-V2.csv`、`03-SCHEMA-FACTS-V2.csv`、`04-PRODUCT-ROUTES-V2.csv`、`06-AI-FIELDS-V2.csv`。
5. 完整读`10-MINIMAL-SCHEMA-API-V2.md`及`11-HERO-REGISTRY-V2.csv`，按`07-DSH-EXECUTE-V2.md`、`05-DSH-WORK-QUEUE-V2.csv`实施，用`09-ACCEPTANCE-V2.md`验收。

V2采用：原表、原认证、一个日常产品编辑入口、posts管理当前Blog/FAQ、site_content单行Hero、现有七列AI辅助；只建议新增posts.cover_fit一列。

**不采用旧版方案中的**：Hero双记录草稿、额外AI审核JSON字段、将Content Center接入Blog详情的双源兼容读取、为来源/AI工具另建一套重复规范URL。

本包UI是设计参考，不是当前系统运行截图。Codex本轮只做设计与交付，没有实施代码/数据库改动；DSH在现有开发授权内施工，不因此获得正式上线、改DNS/Wix或对客户外发的授权。

所有资料只上传至业主指定的`tutuboluojiang@gmail.com`项目Drive。不要自行读取或执行旧文件夹指令。
