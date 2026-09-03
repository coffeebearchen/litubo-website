# 00｜范围与强制规则

## 目标

建设一套“统一视觉系统 + 类别预设 + 可选模块 + 真实产品内容”的产品 CMS。前台路由继续使用 `/products/[category]/[slug]`；后台继续以 Directus 为核心。

## 本期做什么

- 人工创建与维护产品 Draft；
- 使用结构化模块组合详情页；
- 管理真实图片、PDF、规格、FAQ、SEO；
- 保留未来 AI 导入所需的来源、审核、状态和 Provider 接口位置。

## 本期不做什么

- 不连接 OpenAI、DeepSeek 或任何真实 API Key；
- 不创建假产品、假参数、假认证、假案例；
- 不自动发布产品；
- 不做自由拖拽网页编辑器；
- 不 push、部署、改生产环境或 HubSpot 配置。

## 不可破坏的既有约束

- 保留 products、products_files、product_categories；
- 保留当前 Header、Footer、MobileConversionBar、i18n 与 SEO 基础；
- Directus 不得直接暴露公网；
- 英文一期公开，西/葡语保留结构，只有真实审核翻译才发布。
