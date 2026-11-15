# LITUBO 独立站 · 续作入口（先读本文件，勿重新摸底）

> 给任何接手方（Codex / GPT / DSH）的第一入口。读完本文件即可开工，不必重读全部代码和文档。
> 最后更新：2026-11-15 20:20（DSH 本地推进后）

## 一句话状态

**37 条真实产品已导入并全部发布，前台目录可看；产品数据链路已端到端跑通。** 剩余是非产品页面、询盘/邮件/HubSpot/AI 联调、SEO、部署。

## 基线（关键标识，别猜）

| 项 | 值 |
|---|---|
| 仓库 | coffeebearchen/litubo-website（私有） |
| 本地工作分支 | `work/litubo-dsh-local` |
| 当前提交 | `9e334d4`（888d4d2 重建 + RESUME.md + wix-media-upload.mjs） |
| 本地代码目录 | `D:\LITUBO-website`（唯一目录，已收拢 worktree） |
| 开发 Directus | `http://127.0.0.1:8055`（OIG 授权、license.source=env，未消耗新激活） |
| 产品数据 | `private-product-source/`（git-ignored） |
| push 状态 | **未 push**（等负责人授权） |

## 已完成（T00–T04，证据在）

- 产品导入：37 条草稿 → **全部发布**（幂等 verified：重跑 `resumed:37`）
- 图片：39 张入媒体库、29 hero + 48 gallery、**全部 `is_public=true`**
- 测试遗留：4 条（3 test-only + 1 test）已归档
- 前台：`http://localhost:3000/products` 4 分类全部 200、真实数据真实图
- 复核项：25 项已整理 → `private-product-source/migration-plan/review-items.md`
- 迁移脚本：`scripts/wix-migration.mjs`（导入）、`scripts/wix-media-upload.mjs`（图片，本轮 DSH 新写）

## 下一步（精确，勿重新规划）

> 已核实：非产品页面（About/Quality/Applications/Resources/Contact/隐私/条款/FAQ）**已有真实英文内容**，无 TODO/DEMO 占位（实测 0 命中）。产品页已填真实产品+图。所以**不是"补文案"，而是"验证功能闭环"**。

1. **询盘闭环验证**：表单 → Directus inquiries 入库 → 后台可见 → 邮件/HubSpot（代码底座在，端到端未实测）
2. **AI 客服**：`VISITOR_AI_ENABLED` 默认关，需知识库 + 正式模型 + 联调
3. **SEO/旧链接**：Wix 旧 URL 301 映射（`scripts/wix-redirects.mjs` 已建，映射表待完整化）
4. **部署**：生产切换单独授权，不在本轮

## 已知缺口（发布前需人工，不阻断流程）

- 8 个产品无 hero 图（`MISSING_HERO`）
- 8 个产品规格含"待配置"未确认值（`SOURCE_SPEC_UNCONFIRMED`）
- 6 个多型号合并规格表（`SPEC_TABLE_REVIEW`）
- 3 个型号代码格式不符（`INVALID_MODEL_CODE`）
- 老产品 9 组重复型号（`legacy-product-conflicts.csv`，首发用新版 37 条，老产品未导入）

## 一个待负责人确认的偏差

DSH 导入到**开发库 8055**（已授权、schema 齐全），而非 Codex 计划的隔离实例 18057。理由：本机开发库就绪、省重建 schema、不消耗 license 激活。**是否接受需确认。**

## 省算力规则（所有 agent 遵守）

1. 先读本文件 + `review-items.md`，**不重读** 13.9MB 代码和 100MB 设计图
2. 只改本次任务相关文件，不跑全量测试（除非该文件受影响）
3. 首期英文；ES/PT 后置
4. 凭证一律 shell/环境注入，**不读不打印 `.env` 密钥**
5. 未授权不 push、不部署、不真实外发、不消耗 license

## 详细状态

- 完整推进记录：`private-product-source/DSH-STATE.md`
- Codex 原文档（Drive）：LITUBO-01～10 + README（V0.4 系列）
