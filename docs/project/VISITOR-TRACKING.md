# 访客追踪（Live Visitors）

匿名页面访问记录 + 后台实时看板 + 可选的企业微信逐条推送。

## 组成

| 层 | 文件 | 作用 |
|---|---|---|
| 前端埋点 | `plugins/visitor-track.client.ts` | 每次路由切换发一次浏览信标；离开页面时补发停留时长 |
| API | `server/api/track.post.ts` | 校验路径、解析国家/来源、写入 Directus、可选推送。**永远返回 204**，追踪故障不影响访客 |
| 后台 API | `server/api/admin/visitors.get.ts` | 汇总在线人数 / Top 页面 / 国家 / 来源 / 最近明细 |
| 后台页面 | `pages/admin/visitors.vue` | `/admin/visitors`，30 秒自动刷新 |
| 推送 | `server/utils/wecomNotify.ts` → `sendWecomVisit()` | 配置 `WECOM_WEBHOOK_URL` 后，每次浏览推一条 |

## 数据结构（Directus，必须存在，否则追踪写入 403）

集合 `visitor_events`：

| 字段 | 类型 | 说明 |
|---|---|---|
| `path` | string(255) | 页面路径，不含查询串 |
| `referrer` | string(512) | 来源网址原文 |
| `source` | string(40) | 归类：Direct / Google / Bing / Baidu / WeChat / LinkedIn / YouTube / Facebook / B2B marketplace / Referral / Internal |
| `country` | string(8) | 两位国家码；无 CDN 头时为 `XX` |
| `duration_ms` | integer | 停留毫秒数，先写 0，离开页面时更新 |
| `session_id` | string(64) | 随机会话 ID（sessionStorage），**不写 cookie** |
| `created_at` | timestamp | 默认 `$NOW`，只读 |

## 权限（Directus 12 用 policy，不是 role）

`nuxt-server` 角色需要**额外挂一个 policy**：

| policy | 名称 | 权限 |
|---|---|---|
| `visitor-events-write` | 只负责访客记录 | `visitor_events` 的 **create + read + update**，`fields = ['*']`，`permissions = {}` |

挂载方式：`POST /access { role: <nuxt-server 角色 id>, policy: <visitor-events-write policy id> }`

> 只读 policy（`site-readonly-policy`）不能满足写入；缺 create 会 403，缺 read/update 会导致停留时长更新失败并退化成每条浏览两行记录。

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `WECOM_WEBHOOK_URL` | 否 | 企业微信群机器人地址。留空则只记录、不推送 |

## 隐私边界

- 不存 IP、不写 cookie、不采集个人身份
- 只记录页面路径、来源域名、国家码、停留时长
- `/admin` 下的访问不记录
- 网站隐私政策发布前应补一段"匿名访问统计"的说明

## 验证方法

```powershell
# 1) 写入一条浏览
Invoke-WebRequest -Uri http://localhost:3000/api/track -Method Post `
  -Headers @{ 'cf-ipcountry' = 'DE'; 'Content-Type' = 'application/json' } `
  -Body '{"path":"/products/x-ray-inspection","referrer":"https://www.google.com/","sessionId":"t1","durationMs":0}'

# 2) 补停留时长（应更新同一条，不新增）
Invoke-WebRequest -Uri http://localhost:3000/api/track -Method Post `
  -Headers @{ 'cf-ipcountry' = 'DE'; 'Content-Type' = 'application/json' } `
  -Body '{"path":"/products/x-ray-inspection","referrer":"https://www.google.com/","sessionId":"t1","durationMs":47000}'
```

打开 `/admin/visitors` 应看到 1 条记录、时长 47s。

## 已知限制

- **国家**依赖 CDN 头（`cf-ipcountry` / `x-vercel-ip-country` / `x-country-code`）。本地直连时为 `XX`；上线后需要 Cloudflare、Vercel 或 Nginx 注入该头，否则国家恒为 unknown。
- **实时推送**是"每次浏览一条"。流量变大后若嫌吵，把 `sendWecomVisit` 的调用条件改成只推产品详情页/联系页。
