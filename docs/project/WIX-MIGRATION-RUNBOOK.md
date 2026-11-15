# Wix → 独立站迁移操作说明（初稿）

本轮采用「真实资料先落盘 → 确定分类 → 生成计划 → 隔离后台草稿 → 图片关联 → 预览」路径。不改Wix、不自动发布、不覆盖人工修订。首期以英文检测设备为主。

## 数据位置与实际范围

所有工作数据放在被Git忽略的 `private-product-source/`，不能提交到当前公开的应用仓库。

| 目录 | 内容 |
|---|---|
| `wix/` | 实际集合schema、Import124/126分页原始产品、category-map.json |
| `wix-inventory/` | Import114旧检测产品37条、Import123过滤设备11条的选定字段盘点；Import127的6条FAQ |
| `wix-media/` | 原始产品图片文件和URI/URL/哈希清单；相同字节按哈希去重 |
| `migration-plan/` | 草稿计划、缺料/复核项、执行结果 |
| `scratch/` | 新测试后台配置，含新测试凭证：不提交、不随迁移资料包分发 |

注意：Import114/123目前是**选定字段盘点**，不是完整正文导出。新版Import124/126共37条为完整原始记录。本轮不宣称已导出Wix所有CMS、全部媒体文件夹、历史版本或客户数据。

## 字段与结构

| 实际Wix字段 | 新后台结构 | 处理 |
|---|---|---|
| productNameEn | products.name_en | 不使用伪造名称填空 |
| shortDescriptionEn | products.summary_en | 去除HTML，保留来源含义 |
| lituboModel | model_or_series / product_code | 去除Model:前缀；不符合代码格式时仅保留型号原文 |
| categoryNameEn | category_id | 经显式映射查找已有分类，不把字符串直接写外键 |
| slug | products.slug | 保留有效来源slug；异常则标记 |
| overviewEn等10组段落 | product_sections | 使用原文，清理HTML为文本，不执行网页指令 |
| technicalSpecificationsHtml | product_spec_groups/items | 清晰两列表格保留单位；合并/多型号行需复核，不猜列 |
| mainImage / mediaGallery | 媒体导入清单 → Media Library | 先保存原图和哈希，再上传并关联 |
| 原集合/记录ID、内容哈希 | product_source_records | needs_review，保留追溯 |

第一版复用现有模型，无需为了迁移重写数据库结构。所有产品创建为draft、seo_noindex=true，不复制Wix的公开状态。旧目录重复型号、新旧资料有出入、未确认规格和缺图均集中记录，不自动合并。

## 运行命令

使用项目Node22.22.2。初次安装后先 `npx nuxt prepare`。

```sh
node scripts/wix-migration.mjs \
  --input-dir private-product-source/wix \
  --output-dir private-product-source/migration-plan \
  --categories private-product-source/wix/category-map.json
```

默认dry-run：不读取凭证、不连接数据库。先检查summary的分页完整性和plan内错误。业务复核项不自动变成技术阻断。

真正执行只接受显式loopback测试端口，并要求再次匹配目标；令牌由运行环境注入`WIX_MIGRATION_ISOLATED_TOKEN`，不要写进命令或文档：

```sh
node scripts/wix-migration.mjs \
  --input-dir private-product-source/wix \
  --output-dir private-product-source/migration-plan \
  --categories private-product-source/wix/category-map.json \
  --apply-isolated http://127.0.0.1:18057 \
  --confirm-target http://127.0.0.1:18057
```

导入器只创建、不PATCH已有产品、不删除、不发布。相同源快照重复运行会核对现有记录，缺少的子记录可以续做；人工修订、非draft、来源哈希变化、型号/slug冲突会保留现状并报conflict。操作中断可能留下部分草稿，使用同一源快照重跑。仍是串行REST过程，不承诺数据库事务，也不允许多个不同工具并发修改同一批记录。

图像文件保存和产品文本入库是不同步骤；summary明确记录mediaTransferred，不能把保存原图当作Media Library上传已完成。Directus Core隔离试验不等于OIG生产权限已验证，不使用现有license key。

## 最低验收

先抽看一份产品的名称、型号、分类、段落、规格与图片，再导入剩余资料；同一批重跑不增加重复。桌面和手机浏览一份详情，点询盘能保留产品来源。参数是否最终适用仍由公司人员和客户确认。

可浏览初稿与可正式上线分开：SMTP、HubSpot、访客AI客服、隐私文本、真实服务权限和正式切流未验证时明确记OPEN，继续完成不依赖它们的页面。
