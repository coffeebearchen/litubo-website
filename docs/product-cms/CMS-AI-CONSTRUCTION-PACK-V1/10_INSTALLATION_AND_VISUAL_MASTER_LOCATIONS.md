# LITUBO 文件安装位置与视觉母版交付规则 V1（修正版）

## 1. 已有目录保持不动

你的项目当前已有以下正确目录：

```text
D:\LITUBO-website\docs\content\
D:\LITUBO-website\docs\design-reference\
D:\LITUBO-website\docs\product-cms\
D:\LITUBO-website\docs\project\
D:\LITUBO-website\private-product-source\
```

**它们均不改名、不覆盖、不移动。** 特别是 `docs/project/` 的项目状态文件、`docs/product-cms/` 的已有 CMS 文档、`docs/design-reference/` 的已确认官网母版，都比本包优先。

## 2. 本包的正确安装位置

本包 00–10 的 Markdown 文件进入一个新的、独立的叶子目录：

```text
D:\LITUBO-website\docs\product-cms\CMS-AI-CONSTRUCTION-PACK-V1\
```

新增的 CMS/AI 平面图进入现有设计目录下的独立叶子目录：

```text
D:\LITUBO-website\docs\design-reference\CMS-AI-VISUAL-MASTER-V1\
```

最终结构：

```text
D:\LITUBO-website\
├─ CLAUDE.md                                      ← 已有，绝不覆盖
├─ docs\
│  ├─ content\                                    ← 已有，不动
│  ├─ project\                                    ← 已有，不动
│  ├─ product-cms\                                ← 已有，不覆盖旧文件
│  │  └─ CMS-AI-CONSTRUCTION-PACK-V1\             ← 新增：00–10 施工文件
│  └─ design-reference\                           ← 已有，不移动原官网母版
│     └─ CMS-AI-VISUAL-MASTER-V1\                 ← 新增：CMS/AI 图与视觉索引
│        ├─ README_VISUAL_INDEX.md
│        ├─ logic-references\
│        └─ admin\
│           ├─ desktop-1440\
│           ├─ mobile-375\
│           └─ components-and-states\
└─ private-product-source\                        ← 已有且正确；真实 PDF/Excel/图片/工厂资料，必须 .gitignore
```

不要创建此前误写的：

```text
docs\design\
docs\product-cms\construction-handoff-v1\
```

## 3. 可直接解压的安装包

使用名为 `LITUBO_CMS_AI_REPO_INSTALL_V1.zip` 的安装包时，直接解压到：

```text
D:\LITUBO-website\
```

它只会新增上面两个独立叶子目录，不会覆盖任何已有文件。

若使用旧版“施工总包 ZIP”，不要整包直接覆盖 `docs`；必须先解压到临时目录，再分别复制：

| 内容 | 目标目录 |
|---|---|
| `00...10` Markdown 文件 | `docs\product-cms\CMS-AI-CONSTRUCTION-PACK-V1\` |
| `visual-references`、`visual-masters` 中的图与索引 | `docs\design-reference\CMS-AI-VISUAL-MASTER-V1\` |

## 4. 不同资料的唯一位置

| 文件/资料 | 唯一位置 | 是否进 Git | 说明 |
|---|---|---:|---|
| 本施工包 00–10 | `docs/product-cms/CMS-AI-CONSTRUCTION-PACK-V1/` | 是 | 新增独立档案；仓库事实仍优先。 |
| 新 CMS/AI 平面图、两张流程参考图、视觉索引 | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/` | 是 | 新设计的唯一入口。 |
| 原已确认的官网视觉母版 | 当前 `docs/design-reference/` 既有位置 | 是 | 不移动、不改名、不覆盖。 |
| `CLAUDE.md`、`CURRENT-STATE.md`、`MASTER-ROADMAP.md` | 现有根目录 / `docs/project/` | 是 | 真实项目状态优先。 |
| 真实产品 PDF / Excel / Word / 原图 / 客户资料 | `private-product-source/`，之后进入 Directus Media Library | **否** | 默认私有，不能随设计图或代码提交。 |
| 前台实际显示的生产媒体 | Directus Media Library | 否 | 业务对象只能通过 Media UUID 引用。 |

## 5. Claude 的固定读取顺序

```text
1. D:\LITUBO-website\CLAUDE.md
2. D:\LITUBO-website\docs\project\CURRENT-STATE.md
3. D:\LITUBO-website\docs\project\MASTER-ROADMAP.md
4. D:\LITUBO-website\docs\product-cms\CMS-AI-CONSTRUCTION-PACK-V1\00_READ_ME_FIRST.md
5. 当前模块对应的 01–10 文件
6. D:\LITUBO-website\docs\design-reference\CMS-AI-VISUAL-MASTER-V1\README_VISUAL_INDEX.md
7. 当前页面对应的 1440px 与 375px、且状态为 CONFIRMED 的平面图
```

任一视觉图缺失、与项目事实冲突或只有文字没有确认母版时，Claude 必须停下报告，不能自行设计。

## 6. 全套视觉母版范围

只有已标记 `CONFIRMED` 的图，才可进入相应页面的正式前端施工。

| 页面范围 | 必须图 |
|---|---|
| 公开官网 PUB-00–PUB-09 | 每个页面组 1440 + 375，另含菜单、表单、错误/成功状态。 |
| 中文后台 ADM-00–ADM-19 | 每个页面组 1440 + 375，覆盖 Dossier、AI 证据、导入、Media、Review、询盘、设置。 |
| 共用组件与状态 | Token、按钮、表格/卡片、发布/撤回/归档 Modal、来源选择 Drawer、empty/loading/error/conflict/stale。 |

图片命名：

```text
LITUBO_{PUB|CMS}_{PAGE-ID}_{PAGE-SLUG}__{STATE}__{VIEWPORT}__v{NN}.png
```

示例：

```text
LITUBO_CMS_ADM-06_AI-Field-Evidence__scope-locked__desktop-1440__v01.png
LITUBO_CMS_ADM-06_AI-Field-Evidence__scope-locked__mobile-375__v01.png
```

每张图必须在 `README_VISUAL_INDEX.md` 登记为 `DRAFT / REVIEW / CONFIRMED / SUPERSEDED`；`SUPERSEDED` 图不准继续作为 Claude 参考。

## 7. 当前图纸与禁止事项

当前已有两张 CMS/AI 流程参考图，以及 ADM-02 产品中心的 1440 与 375 候选图。它们进入新建的 `CMS-AI-VISUAL-MASTER-V1`，不会动你以前的官网图。

硬禁止：

- 不用文字描述替代确认的页面母版；
- 不用 AI 图中的占位型号、参数、证书或客户资料作为真实内容；
- 不把设计 PNG 放进网站 `public/` 当生产媒体；
- 未确认的图不能变成正式代码；
- 手机端不缩小整张桌面表格，必须重新排版。

