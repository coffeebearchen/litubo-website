# 06｜AI 产品资料导入规则

## 目标流程

用户上传一个真实产品资料文件夹 → AI 读取 PDF/Word/Excel/图片/旧资料 → 输出经 schema 校验的 Draft → 写入 Directus → 人工审核 → 发布。

## Provider 设计

使用 Provider Adapter，不绑定单一模型：OpenAI API（GPT）、DeepSeek API 及未来 Provider。密钥仅来自服务器环境变量，例如 `AI_PROVIDER`、`AI_MODEL`、`AI_API_KEY`；不得保存到 Directus、前端、日志或 Git。

## 三层 AI 指令位置

1. **核心安全规则（不可在后台直接改）**：`docs/product-cms/ai/01-CORE-SAFETY-RULES.md`；
2. **公司编辑规则（后台可改、需版本记录）**：未来 Directus `ai_settings.company_instructions`；
3. **单次导入备注（只影响本次任务）**：未来 `product_import_jobs.operator_notes`。

## AI 可以做

提取已有事实；建议类别和预设；整理图片用途；将参数分组；生成英文草稿、SEO、FAQ 草稿；标记缺失/冲突；创建 Draft。

## AI 不可以做

不得虚构性能、认证、材质、客户案例、测试条件；不得用竞品资料补充；不得自动发布；不得在冲突时自行裁决；不得把生成图冒充实拍产品图。

## 每条重要事实

需要记录来源文件、页码/表格位置/图片名、导入时间、Provider、模型、状态和审核人。没有来源时必须为空或 missing。
