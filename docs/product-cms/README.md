# LITUBO 产品 CMS 与详情页后台工程档案包

本档案包用于在 LITUBO 新官网中建设可复用的产品详情页、人工上架后台与未来 AI 产品资料导入助手。

## 安装位置

将 `docs/product-cms/` 整个文件夹复制到：

```text
D:\LITUBO-Website\docs\product-cms\
```

将 `private-product-source/` 放在项目根目录：

```text
D:\LITUBO-Website\private-product-source\
```

该资料目录必须加入 `.gitignore`，不能 push 到 GitHub。真实图片、PDF、Excel、Word 和工厂资料只保存在此处及 Directus 媒体库。

## Claude 工作顺序

1. 先读 `00-READ-ME-FIRST.md` 和现有项目档案；
2. 做只读核对，报告实际差异；
3. 按 `08-IMPLEMENTATION-AND-ACCEPTANCE.md` 分模块实施；
4. 每模块完成构建、浏览器、375px 手机端、SEO 验收；
5. 本地 commit，等待单独授权才 push。

## 当前第一模块

先完成“人工上产品 + 可组合产品详情页”。AI 的字段、审计记录和接口位置同步预留，但不连接任何真实 API Key，不创建假产品，也不自动发布。
