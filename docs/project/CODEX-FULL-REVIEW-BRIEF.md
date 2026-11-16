# Codex 全站审查说明（第一初稿收尾）

日期：2026-11-16　｜　给：Codex　｜　来自：DSH（实现方）

---

## 1. 你在看什么

```
仓库：git@github.com:coffeebearchen/litubo-website.git
分支：work/c-refined-v1
提交：5f6a3c4
```

**这是一个外贸企业站的第一初稿**（LITUBO，食品/包装检测设备，昆山，客户在海外）。

技术栈：

```
Nuxt 3.21.11 + Vue 3.5 + TypeScript strict
Directus 12.3.1 + PostgreSQL 16（Docker，本地 127.0.0.1:8055）
Nitro SSR
```

**当前状态：本地开发环境可运行，未部署，未发布，Wix 旧站仍在线上。**

---

## 2. 最近改了什么（你需要知道的上文）

按时间倒序，最近的提交：

| 提交 | 内容 |
|---|---|
| `5f6a3c4` | 状态文档 |
| `c9d7e61` | 语言收窄为 en / es / ar（其余 5 种移除入口） |
| `27e09c1` | 9 个首页固定块的西语 |
| `2a689de` | 37 个产品的西语摘要 |
| `c25410f` | 37 个产品的西语名称 |
| `d5a218c` | Resources 菜单接通 Insights，去掉假文章标题 |
| `3fa2b20` | 新建 `/resources/insights` 列表页（之前不存在） |
| `5a2d863` | 西语 UI 92 键 |
| `4fba2d8` | 产品页打印数据表 |
| `32a47f2` | JSON-LD + /llms.txt + 全仓 0 类型错误 |
| `49808b8` | 首页固定块后台化（site_content） |
| `a4cf306` | 方案C：首页 + 详情页改造 |

更早的内容见 `docs/project/` 下的报告。

---

## 3. ⚠️ 请忽略的部分

**多语言的其余 5 种语言（pt / zh / ja / ru / fr）请直接忽略。**

- 它们的代码还在（`i18n/*.json`、`nuxt.config.ts` 的 locales 数组）
- 但入口已从语言选择器移除
- **这不是问题，不用提，不用改，回头再说**

**当前只关心三种：English（主）/ Español / العربية。**

西语已完成：UI 92 键、导航、分类 5/5、产品名 37/37、产品摘要 37/37、首页块 9/9。
阿语只有 RTL 骨架，内容为空——**已知缺口，不用重复报告**。

---

## 4. 你要做什么

### 任务 A：逐页审查完整性

看 `pages/` 下的**所有公开页面**（不是 `pages/admin/*`），逐个回答：

1. 这个页面是否完整？（有没有空板块、占位符、写死的假数据）
2. 有没有明显问题？（布局错、文案缺失、逻辑不通）
3. 与同类页面相比，有没有漏掉的内容模块？

公开页面清单（30 个）：

```
/                                   首页
/products                           产品总览
/products/[category]                分类页
/products/[category]/[slug]         产品详情
/applications                       应用总览
/applications/[slug] ×8             应用详情
/resources                          资源总览
/resources/insights                 文章列表（新建）
/resources/insights/[slug]          文章详情
/resources/downloads                下载
/resources/videos                   视频
/support                            支持总览
/support/faq                        常见问题
/support/technical-support          技术支持
/support/manual-request             说明书申请
/support/request-spare-parts        备件申请
/support/service-training           服务培训
/support/send-product-test          寄样检测
/support/[requestType]              通用表单
/company/about                      关于我们
/company/quality-manufacturing      质量制造
/company/global-service             全球服务
/company/become-a-partner           成为伙伴
/contact                            联系
/technical-matching                 技术选型
/find-a-distributor                 找经销商
/privacy-policy                     隐私政策
/terms-of-use                       使用条款
/[slug]                             旧 URL 兼容（301）
404 / 503
```

### 任务 B：图片审查

1. 哪些页面/卡片**没有图片**（空占位框）？列出具体页面和位置。
2. 图片尺寸/比例是否一致？有没有拉伸、裁切主体、模糊？
3. 已知：5 个分类主图 + 8 个产品主图缺失。请核实是否还有别的。

### 任务 C：文章审查

1. `/resources` 和 `/resources/insights` 的文章是否完整（标题、摘要、封面、正文）？
2. 25 篇已发布文章里，多少有封面？多少缺 SEO 标题/描述？
3. 文章分类/标签模型是否缺失？（目前只有 `content_type`，无分类无标签）

### 任务 D：后台审查

1. `pages/admin/*` 的功能是否完整？（产品、内容、询盘、设置、访客）
2. 后台能编辑的字段，是否覆盖前台展示所需？
3. 有没有"前台显示了但后台改不了"的内容？

### 任务 E：给出方案

**输出一份完整的问题清单 + 解决方案**，格式建议：

| # | 问题 | 页面/文件 | 严重度 | 建议方案 | 工作量 |
|---|---|---|---|---|---|

严重度分级：🔴 阻塞上线 / 🟠 影响体验 / 🟡 优化项

最后给一个**收尾计划**：要让这个站达到"可以部署"的状态，还需要做哪些事、按什么顺序。

---

## 5. 已知问题（不用重复报告，但可以核实）

| 问题 | 状态 |
|---|---|
| 5 个分类主图缺失 | 已知，等素材 |
| 8 个产品主图缺失 | 已知，等素材 |
| 输送与剔除分类 0 个已发布产品 | 已知，等业主决策 |
| Case Studies 菜单项指向 `/resources` | 已知，因为 0 篇案例 |
| 阿语内容为空 | 已知，RTL 骨架已完成 |
| 隐私政策未法务审 | 已知 |
| 37 个产品是 `noindex` | 有意为之，等 Wix 切换后再放开 |
| 文章封面是橙色品牌占位图 | 已知，与"冷绿光"规范冲突 |

---

## 6. 约束

- **不要改前端代码**，只出审查报告和方案
- 不要新增付费服务
- 不要编造事实：不确定的写"需业主确认"
- 输出中文，技术名词保留英文
- 不要评论多语言那 5 种语言

---

## 7. 相关文档（建议先读）

```
docs/project/CURRENT-STATE.md                      当前状态与任务台账
docs/project/C-REFINED-V1-PHASE1-REPORT.md         第一阶段报告
docs/project/C-REFINED-V1-T1-FIELD-AUDIT.md        真实 schema 核对
docs/project/待补素材清单.csv                       13 张缺失图片
docs/project/translations/                         西语译文存档
CLAUDE.md                                          仓库约定
```

---

## 8. 目标

**把整个网站的第一初稿做完整**，然后才谈：

```
部署 → 加语言 → 内容运营
```

所以你的审查重点是：**还有哪些地方没做完、哪里看着像半成品。**

看完后给业主一份"还差什么"的清单，由业主决定优先级。
