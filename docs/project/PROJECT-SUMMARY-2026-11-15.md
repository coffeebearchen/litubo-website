# LITUBO 独立站项目总结报告

**日期：** 2026-11-15
**阶段：** 初稿完成，未部署
**执行：** DSH（DeepSeek Harness）
**代码位置：** `D:\LITUBO-website`，分支 `work/litubo-dsh-local`
**远程仓库：** `git@github.com:coffeebearchen/litubo-website.git` — 分支 **已推送**（2026-11-15，241 个提交）

---

## 一、项目概况

LITUBO 原站基于 Wix（Editor X），本次任务是搭建一个**独立于 Wix** 的新站（Nuxt 3 + Directus），把 Wix 的真实产品资料迁移过来，并把设计标准对齐参考站 `anyivalves.com`。

**当前状态：** 结构完整、内容真实、主要页面可用。**但视觉质感仍偏工程化，缺少"人性化/生动"的感受**——这是下一阶段的主要课题。

**重要前提：** Wix 生产站仍在线，未被修改；新站未部署、未切换域名。

---

## 二、已完成的工作

### 2.1 数据迁移与入库

| 项目 | 数量 | 说明 |
|---|---|---|
| 产品（已发布） | 37 条 | 全部含简介、分类、规格、内容段落 |
| 产品（归档） | 4 条 | 早期测试残留 |
| 有主图 / 无主图 | 30 / 11 | 无图的 8 个已核实 **Wix 源头即无图** |
| 产品分类 | 5 个 | X-Ray / Metal Detection / Checkweighers / Combination / Conveyors |
| 规格项 | 672 项 | 分 52 个规格组 |
| 产品内容段落 | 373 段 | 含概述、要点、应用、检测目标、工作原理等 |
| 产品级 FAQ | 9 条 | 仅 LT-180C 有 |
| 文章 | 33 篇 | Insight 12 / FAQ 18 / 案例 1 / 新闻 1 / 技术指南 1 |
| 媒体文件 | 109 个 | 53 张图片，50 个已公开 |
| 询盘 | 22 条 | 来自网站表单 |

### 2.2 前台页面

**已上线可访问的页面类型：**

| 页面 | 路径 | 状态 |
|---|---|---|
| 首页 | `/` | ✅ |
| 产品总览 | `/products` | ✅ |
| 产品分类 | `/products/{5 个分类}` | ✅ |
| 产品详情 | `/products/{分类}/{型号}` | ✅ |
| 应用列表 | `/applications` | ✅ |
| 应用详情 | `/applications/{8 个行业}` | ✅ |
| 资源 | `/resources` | ✅ |
| 文章详情 | `/resources/insights/{slug}` | ✅ |
| FAQ | `/support/faq` | ✅ |
| 支持 | `/support` | ✅ |
| 公司 | `/company/{about,quality-manufacturing,global-service,become-a-partner}` | ✅ |
| 联系 | `/contact` | ✅ |
| 技术选型 | `/technical-matching` | ✅ |
| 找经销商 | `/find-a-distributor` | ✅ |
| 隐私/条款 | `/privacy-policy`、`/terms-of-use` | ✅（内容待法律审核） |
| 后台访客看板 | `/admin/visitors` | ✅ |

### 2.3 首页结构（对齐 anyivalves.com）

```
图标分类条（5 类）
  ↓
Hero（真实车间照片 + 深绿渐变 + 金黄标题 + 双按钮）
  ↓
About LITUBO（左：标题/正文/3 个特性；右：产线照片）
  ↓
Find inspection systems（5 张产品分类卡）
  ↓
Inspection by application（8 张行业卡）
  ↓
Latest from LITUBO（All / Insights / Technical Guides / Case Studies 标签页）
  ↓
Questions about your line（FAQ 摘要）
  ↓
CTA 带（Talk to the team who understands your line）
  ↓
Connect with an Expert（表单）
  ↓
页脚
```

### 2.4 产品详情页结构（对齐 anyivalves.com）

```
面包屑
  ↓
居中标题 + 型号
  ↓
图左（画廊：主图 + 缩略图 + 左右箭头 + 点击放大） | 文右（简介 + 2 按钮 + Print/Save PDF）
  ↓
技术规格表（斑马纹）+ 技术线图占位
  ↓
Product Configurator（标准配置 + "按项目确认"说明）
  ↓
Company catalogue（诚实空态：暂无经批准的目录）
  ↓
FAQ（如有）
  ↓
Documents & Downloads（如有）
  ↓
Related Products
```

### 2.5 导航与页脚

- **顶部导航**：Logo + 主导航 + 5 类图标分类条（全站生效）
- **大菜单**：产品/应用/资源/支持/公司五组，含 8 个行业入口
- **页脚**：
  - 品牌区（Logo + 标语 + 简介）
  - 联系方式（电话/邮箱/地址）
  - **Follow LITUBO 社交图标行**
  - 5 栏链接（Products / Applications 双栏 / Support / Resources / Company）
  - 底部法律条（公司名、版权、隐私政策、使用条款）

### 2.6 SEO 与旧链接

- **37 条 Wix 旧产品 URL 的 301 重定向已启用**，全部目标页验证为 200
- 支持 Wix 的编码路径（如 `%C2%B7`、`%2C`）
- sitemap.xml / robots.txt / canonical 已配置
- ES/PT 语言通过中间件返回 404（不索引）

### 2.7 后端功能

| 功能 | 状态 | 说明 |
|---|---|---|
| 表单 → Directus 询盘 | ✅ 已通 | Contact / Expert / Technical Matching / Distributor |
| 企业微信询盘通知 | ⏳ 代码就绪 | 缺 `WECOM_WEBHOOK_URL` |
| 访客追踪 | ✅ 已上线 | 匿名记录页面/国家/来源/停留时长 |
| 实时访客看板 | ✅ 已上线 | `/admin/visitors`，30 秒刷新 |
| 企业微信访客通知 | ⏳ 代码就绪 | 同上，缺 Webhook |
| AI 客服 | ⏳ 代码就绪 | `VISITOR_AI_ENABLED` 未开启 |
| HubSpot 同步 | ⏳ 代码就绪 | 缺 Private App token |
| 邮件通知 | ⏳ 代码就绪 | 缺 SMTP 授权码 |

### 2.8 访客追踪系统（本期新增）

**记录内容：** 页面路径、来源渠道（Google/Bing/百度/微信等）、国家代码、停留时长、时间
**不采集：** IP、cookie、任何个人身份信息
**看板指标：** 在线人数（5 分钟）、24 小时浏览量、Top 页面、国家分布、来源分布、访问明细

---

## 三、关键决策记录

以下决策由业主拍板，是本阶段的执行前提：

| # | 决策 | 内容 |
|---|---|---|
| D1 | 设计参照 | 严格参照 `anyivalves.com` 的结构与设计语言 |
| D2 | 品牌色 | 以 `litubo.com` 为准：**金黄 `#D99200` + 叶绿 `#2F6B3A/#1B4224`** |
| D3 | 图片策略 | 缺图用**品牌化占位**，**不得用无关产品图顶替** |
| D4 | 字号 | 全站原始字号 **+38%** |
| D5 | 列表简介 | 不超过 5 行，后端同步简化 |
| D6 | 详情图 | 主图不缩放；下方缩略图放大 80%（72→130px） |
| D7 | 列表图 | 不缩放、加宽卡片（3 列），避免裁切 |
| D8 | 配色配比 | 减少绿、增加暖橙 |
| D9 | 后台 | 必须与前台同步，不能只做画皮 |
| D10 | 上线 | **未授权**，Wix 保持在线 |

---

## 四、已知问题与风险

### 4.1 需要业主提供资料

| 问题 | 影响 | 需要 |
|---|---|---|
| 8 个产品无实拍图 | 只能显示占位图 | 产品照片 |
| 隐私政策待法律审核 | 上线前必须完成 | 法务确认 |
| 无真实信任数字 | 首页无法展示"20 年经验"等 | 真实数据（不得编造） |

### 4.2 技术风险

| 风险 | 说明 | 应对 |
|---|---|---|
| 国家识别依赖 CDN 头 | 本地直连时为 unknown | 上线时用 Cloudflare/Vercel，或 Nginx 注入 |
| 媒体资源缓存 | 已从"一年不可变"改为 1 小时可复验 | 换图后需带版本参数 |
| 访客追踪表会持续增长 | 长期需要归档 | 建议按季度清理 |

### 4.3 内容边界（不可越线）

- 不编造参数、认证、案例、价格、交期、客户名、统计数字
- 不用无关产品图顶替
- 决策以业主为准

---

## 五、待办清单

### 5.1 需要业主决策/提供

| # | 事项 | 类型 |
|---|---|---|
| 1 | 企业微信群机器人 Webhook 网址 | 配置 |
| 2 | SMTP 邮箱 + 授权码 | 配置 |
| 3 | 是否开启 AI 客服 | 决策 |
| 4 | HubSpot Private App Token | 配置 |
| 5 | 8 个产品的实拍图 | 素材 |
| 6 | 真实信任数字（经验年限、服务国家数） | 素材 |
| 7 | 旧产品 37 条是否导入（建议不导） | 决策 |
| 8 | 部署方案（服务器/托管） | 决策 |

### 5.2 需要执行

| # | 事项 | 负责 |
|---|---|---|
| 1 | 视觉人性化改造 | Codex 给方案 → DSH 执行 |
| 2 | Google Search Console + 统计 | DSH |
| 3 | 部署预览站 | DSH（需授权） |
| 4 | 域名切换 | 需业主批准 |

---

## 六、自评（诚实版）

### 做得好的

- **结构与内容完整**：14 类页面全部可访问，无断链
- **后端同步**：数据、权限、重定向、追踪都落到了后端
- **修了一批真实 bug**：大菜单透明/误关、缩略图被裁、页脚失衡、`min-height` 顶飞页脚、FAQ 折叠不严、图片缩放裁切、媒体缓存不可变

### 做得不好的

- **视觉判断多次出错**：放大图导致裁切、页脚第一版失衡、品牌色一开始用错——都是靠业主截图纠正
- **审美层面缺乏主动权**：只能照搬 ANYI 结构，做不出"有温度"的设计
- **正是因此，下一阶段需要 Codex 在设计层面给方向**

---

## 七、下一步建议

```
1. Codex 给设计整改方案（人性化/生动化）
        ↓
2. 业主确认方案
        ↓
3. DSH 执行视觉改造
        ↓
4. 业主提供配置（Webhook / SMTP / 图片 / 数字）
        ↓
5. 接通通知与 AI
        ↓
6. GSC + 统计
        ↓
7. 部署预览站 → 验收 → 域名切换
```

---

## 附录：如何访问代码

**本地：** `D:\LITUBO-website`（分支 `work/litubo-dsh-local`，240 个提交）

**远程：** `git@github.com:coffeebearchen/litubo-website.git`（**尚未 push**）

**交付方式（需业主批准）：**

| 方式 | 命令 | 说明 |
|---|---|---|
| push 分支 | `git push -u origin work/litubo-dsh-local` | 推荐，保留完整历史 |
| git bundle | `git bundle create litubo.bundle work/litubo-dsh-local` | 单文件离线交付 |
| zip | 排除 `node_modules/.nuxt/.env/private-product-source` | 最简单，无历史 |
