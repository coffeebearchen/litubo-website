# 内容备份 / Content backup

日期：2026-11-16（**修订 2**，含 Checkweighers 系列字段）。仓库是**公开**的，所以这里只放**不含个人信息和凭据**的内容数据。

> 修订 1 是在给 `products` 增加称重系列字段**之前**导出的。修订 2 重新导出，包含新字段与 12 个型号的系列归属。

---

## 这里有什么

| 文件 | 条数 | 说明 |
|---|---|---|
| `products.json` | 41 | 产品，**含 `checkweigher_series` / `checkweigher_configuration` / `checkweigher_l_series`** 及西语字段 |
| `product_categories.json` | 5 | 分类（含 Conveyors & Reject Systems） |
| `product_sections.json` | 373 | 产品详情页分段内容 |
| `product_spec_groups.json` | 52 | 规格组 |
| `products_files.json` | 67 | 产品与媒体的关联（只有 ID，不含文件） |
| `posts.json` | 33 | 文章（正文、SEO、封面引用） |
| `site_content.json` | 9 | 首页固定块 |
| `site_settings.json` | 8 | 站点设置 |
| `site_social_links.json` | 2 | 社交链接 |
| `_schema-products.json` | 34 字段 | `products` 表结构，便于恢复字段定义 |
| `_summary.json` | — | 每集合条数 |

全部为 Directus REST 导出（`/items/<collection>?limit=-1`）。

---

## 称重系列的当前归属

对应 `products.json` 里 12 个 Checkweighers：

| 系列 | 型号 |
|---|---|
| `compact` | LT-150 / LT-150L / LT-150LR / LT-150LRH |
| `standard` | LT-220 / LT-220L / LT-220LR |
| `medium-range` | LT-300 / LT-300L |
| `extra-large` | LT-400 / LT-450 / LT-600 |
| `pharmaceutical` | 暂无型号（咨询入口） |

`LT-300L` 与 `LT-400` 的归属由业主在 2026-11-16 明确确认。

---

## 这里**故意没有**什么

| 排除项 | 原因 |
|---|---|
| `inquiries`（22 条） | **真实客户姓名、邮箱、电话、留言**。公开仓库不能放。 |
| `visitor_events`（372 条） | 访客追踪，含 IP 派生信息。 |
| `litubo_cms.sql` | 含 `directus_users` **密码哈希**、`directus_sessions`。提交等于公开凭据。 |
| `uploads/`（273 个文件，28 MB） | 媒体可重新上传；体积会让仓库膨胀。 |
| `directus_users` / `roles` / `policies` | 身份与权限结构。 |

**需要这些时，从本地 `D:\LITUBO-backup-20261116.zip` 恢复，不要入库。**

---

## 本地完整备份

```
D:\LITUBO-backup-20261116.zip        28.3 MB
├── litubo_cms.sql                   数据库全量（含用户表）
├── content/                         13 个集合（含 inquiries、visitor_events）
└── uploads/                         273 个媒体文件
```

⚠️ **这个 zip 只应放在本机或私有存储**，不要上传到任何公开位置。

**注意**：该 zip 是修订 1 时生成的，**不含**称重系列字段。需要完整快照时请重新执行导出。

---

## 如何恢复

**恢复内容：**
```bash
curl -X POST http://127.0.0.1:8055/items/products \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d @products.json
```

**恢复字段定义**（新环境需要先有 `checkweigher_*` 三列）：
```bash
# 参考 _schema-products.json，三个字段均为 nullable
# checkweigher_series        string  select: compact|standard|medium-range|extra-large|pharmaceutical
# checkweigher_configuration string  select: online|left-right
# checkweigher_l_series      boolean
```

**完整恢复（含用户与询盘）：**
```bash
docker exec -i litubo-cms-postgres-1 psql -U litubo -d litubo_cms < litubo_cms.sql
```

---

## 注意

- 备份是**时间点快照**，不含此后新增内容
- 媒体文件不在仓库里，恢复内容后需单独上传图片，否则图片引用会断
- 这份数据**未加密**，因为它只包含公开网站上本来就展示的内容
