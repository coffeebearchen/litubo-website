# 审查修复证据 —— b169d97 报告

证据日期：2026-11-17
基线：work/c-refined-v1 @ b169d97（实际施工时 HEAD 已推进到 e33dea9）

## A01 —— Insights 详情：503 不再被改成 404

**修法**：改用既有 `publicPageStatus(error, hasData)`。

**故障注入验证**（停掉 Directus 容器制造上游故障）：

| 场景 | 修复前 | 修复后 | 期望 |
|---|---|---|---|
| Directus 停止 | 404 | **503** | 503 ✅ |
| 不存在的 slug | 404 | 404 | 404 ✅ |
| 正常 | 200 | 200 | 200 ✅ |

## A02 —— 称重分类：API 故障不再返回 200 + 0 型号

**修法**：取出 `error`，SSR 用 `publicPageStatus` 抛 503；客户端显示故障卡 + Try again，保留筛选条件。

| 场景 | 修复前 | 修复后 | 期望 |
|---|---|---|---|
| Directus 停止 | 200「All series 0 models」 | **503** | 503 ✅ |
| Directus 停止 + series 参数 | 200 + 0 型号 | **503** | 503 ✅ |
| 不存在的产品 slug | 404 | 404 | 404 ✅ |
| 正常 | 200 | 200 | 200 ✅ |

**复现命令**

```powershell
docker stop litubo-cms-directus-1
Invoke-WebRequest 'http://localhost:3000/products/checkweighers'   # → 503
Invoke-WebRequest 'http://localhost:3000/resources/insights/how-x-ray-inspection-works'  # → 503
docker start litubo-cms-directus-1
```

## 待办

其余问题（A03–A15、Blog 封面映射）见 `01-report/01-ISSUES.csv`。
