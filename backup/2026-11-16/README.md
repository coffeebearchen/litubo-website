# 内容备份 / Content backup

日期：2026-11-16。仓库是**公开**的，所以这里只放**不含个人信息和凭据**的内容数据。

---

## 这里有什么

| 文件 | 条数 | 说明 |
|---|---|---|
| `products.json` | 41 | 产品（含西语 `name_es` / `summary_es`） |
| `product_categories.json` | 5 | 分类 |
| `product_sections.json` | 373 | 产品详情页的分段内容 |
| `product_spec_groups.json` | 52 | 规格组 |
| `products_files.json` | 67 | 产品与媒体的关联关系（只有 ID，不含文件） |
| `posts.json` | 33 | 文章（含正文、SEO、封面引用） |
| `site_content.json` | 9 | 首页固定块 |
| `site_settings.json` | 8 | 站点设置 |
| `site_social_links.json` | 2 | 社交链接 |

**全部为 Directus REST 导出**（`/items/<collection>?limit=-1`），可直接作为恢复源。

---

## 这里**故意没有**什么

| 排除项 | 原因 |
|---|---|
| `inquiries`（22 条） | **真实客户姓名、邮箱、电话、留言**。仓库公开，提交即泄露，违反 GDPR。 |
| `visitor_events`（372 条） | 访客追踪数据，含 IP 派生信息。 |
| `litubo_cms.sql` | 全库 dump 含 `directus_users`（**密码哈希**）、`directus_sessions`、`directus_revisions`。提交等于公开后台凭据。 |
| `uploads/`（273 个文件，28 MB） | 媒体文件本身可重新上传；体积会让仓库膨胀。 |
| `directus_users` / `directus_roles` / `directus_policies` | 身份与权限结构，属敏感配置。 |

**需要这些时，从本地 `D:\LITUBO-backup-20261116.zip` 恢复，不要入库。**

---

## 本地完整备份在哪

```
D:\LITUBO-backup-20261116.zip        28.3 MB
├── litubo_cms.sql                   数据库全量（含用户表）
├── content/                         13 个集合（含 inquiries、visitor_events）
└── uploads/                         273 个媒体文件，28.3 MB
```

**这个 zip 只应放在本机或私有存储，不要上传到任何公开位置。**

---

## 如何恢复

**只恢复内容（安全）：**
```bash
# 对每个集合，以管理员身份 POST 回 Directus
curl -X POST http://127.0.0.1:8055/items/products \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d @products.json
```

**完整恢复（含用户和询盘）：** 使用 `litubo_cms.sql`：
```bash
docker exec -i litubo-cms-postgres-1 psql -U litubo -d litubo_cms < litubo_cms.sql
```

---

## 注意

- 备份是**时间点快照**，不含此后新增的内容
- 媒体文件不在仓库里，恢复内容后需要单独上传图片，否则图片引用会断
- 这份数据**没有经过加密**，因为它只包含公开网站上本来就展示的内容
