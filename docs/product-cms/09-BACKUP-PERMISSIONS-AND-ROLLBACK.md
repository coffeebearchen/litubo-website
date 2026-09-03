# 09｜备份、权限与回滚

## 备份

每次 schema 变更前：导出 Directus schema 快照、完成 PostgreSQL 备份并记录时间。媒体文件应有独立备份策略。验证备份文件可读取。

## 权限

内容编辑者：创建/编辑 Draft、上传资料、提交 Review；审核者：批准发布；管理员：管理 schema、全站设置、AI Provider；AI 服务账户：只能创建 Draft 和来源记录，不能 Published。Directus 只可经本地回环/SSH 管理，不公开暴露。

## 回滚

产品误改：恢复前一发布版本或 Archived 版本；schema 问题：按 schema 快照和数据库备份回退；前端问题：回退到上一稳定本地 Git commit。任何破坏性回滚前必须先报告目标与影响并取得授权。
