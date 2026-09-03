# 03｜Directus 数据模型目标

## 保留并扩展

保留：`products`、`products_files`、`product_categories`。实施前先以实际 schema 为准做快照和差异报告。

## 建议新增结构

| 集合/结构 | 关键字段/关系 | 用途 |
|---|---|---|
| product_page_presets | code、name、category、default_modules、active | 类别默认组合 |
| product_sections | product、type、title、eyebrow、body、image、layout_variant、sort、enabled | 可组合内容模块 |
| product_quick_facts | product、label、value、sort、enabled | 简短事实 |
| product_spec_groups | product、title、sort、enabled | 参数组 |
| product_spec_items | group、label、value、unit、note、sort、source_status | 参数行 |
| product_faqs | product、question、answer、sort、enabled、source_status | 专属 FAQ |
| product_media_roles | product、file、role、alt_text、caption、sort、enabled | 图片角色和显示顺序 |
| product_source_records | product、source_file、source_locator、fact_key、status、note | AI/人工来源追溯 |
| product_import_jobs | provider、model、status、input_manifest、result_summary、reviewer | 未来 AI 导入审计 |

## 产品基础字段

products 至少应支持：name、model_or_series、category、slug、short_description、hero_media、status、page_preset、seo_title、seo_description、og_image、published_at、review_notes。

## 媒体角色

允许：hero、overview、application、detail、gallery、video_poster。每条媒体都需 alt_text、排序、是否公开。PDF 增加 file_type、language、version、published_date。

## 状态

对来源事实使用：`confirmed`、`needs_review`、`missing`、`conflict`。不允许 AI 将 needs_review/conflict 内容直接作为公开事实。
