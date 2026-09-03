# 04｜前端与 CMS 接口契约

## 保留前端边界

保留路由 `/products/[category]/[slug]`。Nuxt Server 层继续作为 Directus 适配层；页面组件不直接依赖杂乱的 Directus 原始字段。

## 渲染方式

前端建立“模块注册表”：每个允许的 `product_sections.type` 对应一个固定 Vue/Nuxt 组件。未知类型、disabled 模块、无有效资料模块一律不渲染，并写日志供后台检查。

```text
CMS product_sections.type  →  Frontend section component
overview                   →  ProductOverviewSection
image_text                 →  ProductImageTextSection
benefits                   →  ProductBenefitsSection
working_principle          →  ProductWorkingPrincipleSection
...
```

## 数据适配规则

- 适配层统一输出 `ProductPageViewModel`；
- `ProductPageViewModel` 必须包含 hero、quickFacts、sections、specGroups、media、downloads、faqs、relatedProducts、seo；
- 新模块必须同步新增：Directus 定义、适配器校验、前端组件、测试，四项缺一不可；
- 旧基础字段应有兼容 fallback，避免未来旧产品页面失效。

## SEO

产品 name 自动为 H1；模块标题为 H2；规格组为 H3。Title、description、canonical、OG、Twitter、html lang、robots 与现有 SEO 基础统一使用。
