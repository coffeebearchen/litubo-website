# V2最小schema与API施工规格

以下是建议接口，不声称仓库已经实现。先复用现有Admin认证/封装/错误格式/权限模型；如现有可复用API已满足，不重复创建。不得破坏原响应字段、公开URL和产品状态机。

## 数据库

唯一新增：posts.cover_fit，nullable string，允许null/contain/cover。可通过Directus字段管理创建、说明和dropdown元数据，测试库演练后执行；本报告不含可盲跑的生产SQL。迁移旧值只根据当前已核实清单，不新增索引/全表分类/历史审核模型。回退关闭新读写、保留列，不DROP。

其他全用原列：site_content 24列；products称重3列；inquiries现有7个AI列；product_categories现有名称/简介/图片；directus_files.title；site_settings联系方式。详见03真实type/nullable。category各语言列实际名称以schema为准，不发明字段。

## 候选接口边界

| 路径/动作 | 允许输入 | 输出/限制 |
|---|---|---|
| 原产品POST/PATCH | 现有白名单+漏接的既有3称重列；编码沿原锁定 | 返回原DTO；只有原允许状态可改 |
| GET /api/admin/posts | 分页/已允许内容类型/选中id | 管理员的实际posts白名单；无客户数据 |
| PATCH /api/admin/posts/:id | title/excerpt/body/cover_image/status/SEO等真实现有列+cover_fit | 字段名按真实schema映射；不接受任意对象/伪slug迁移 |
| GET /api/admin/page-content | 固定registry page_key/block_key | 允许页的当前行+批准默认+实际状态；草稿管理员可读 |
| PATCH /api/admin/page-content | page_key/block_key、白名单文本/CTA/hero_image、显式save_draft或publish | 服务器查registry；单行写；已发布行不接受隐式save_draft |
| GET/PATCH /api/admin/product-categories | 实际分类id和允许列 | 只改原category记录；不创建第六系列大类；不改slug/集合身份 |
| POST /api/admin/inquiries/:id/ai-proposal | 已认证询盘id；选定AI动作 | 临时候选及服务端签名或现有短期存储引用；不写inquiries |
| POST /api/admin/inquiries/:id/ai-confirm | 候选凭证+接受的允许项 | 校验绑定管理员/id/原文指纹/有效期；写被确认的现有AI列 |

暂不新增DELETE AI接口：Discard在浏览器丢候选；服务器短期状态有则清相应候选。候选不能只信任客户端填写的管理员/id/hash；可用既有服务端签名能力生成短期密封凭证或复用现有提案内存/存储机制。不要为此新增数据库表、Redis、队列或依赖新的付费服务。重放仅能写同一确认AI字段，不触发外发/分配；需严格一次性时优先已有提案机制，超出本轮另列，不虚报保证。

原home-content GET/PATCH维持当前调用语义。新Page Content对已发布行的publish操作是即时更新，不伪装存后台草稿。预览只是本地DTO送同一呈现组件；不开放公共草稿API。新数据只能由已授权服务器角色操作：不足权限在原角色新增最小集合/列能力，经测试库核实，不把nuxt-server升为Admin、不扩大Public读写、不把Admin token送浏览器。

公开Hero查询只取registry中published行的允许字段，故障走批准默认；媒体必须继续resolvePublicFiles等公开资格校验。不要把后台API直接用于公开读。站点未配置覆盖时不要求创建13条空行。

13页registry与现有默认组件见11表。首页content_key固定为现有home.hero；其他12个key是新建议命名，必须先检查是否有同用途旧行，存在则复用，不造重复。服务端registry控制page_key/section_key/content_key映射；现有公开服务角色未暴露page_key时，优先按已允许content_key精确筛选，不能假设新字段权限已开。新增字段读取能力按最小列核实。

title_en、eyebrow_en在快照中non-null；清空输入表示使用批准默认，写入前补足有效默认字符串或拒绝并说明，不发送null撞约束。body/图片/CTA按各自nullable处理。每个页面唯一受控key的查找/更新需防重复点击插入重复行；先核对已有唯一约束，没证明有约束时不能宣称已保证唯一。首次创建保持单一管理服务路径、检查重复；并发创建需要的最小唯一约束若真实不存在，另列schema差异供实施确认，不能悄悄把它算进“已经存在”。

所有写入服务器校验长度/类型/nullable/枚举，CTA只允许批准站内路径或明确允许的协议，不能协议相对、脚本或任意外站。输出富文本沿现有清洗链路。记录更新失败保留表单本地内容，显示可重试错误，不假成功；避免同时发布覆盖他人最新改动，可复用现有版本/更新时间校验，若真实表没有版本列则发布前重读对比允许字段，不新加列。

## 不增加的内容

无Hero双记录/草稿JSON，无ai_review_meta，无posts↔CC迁移/双源详情，无三套新的Workspace工具URL，无新认证/模型/全文检索服务。浏览器本地编辑不是持久草稿，现有ai_reviewed不是完整历史审计——UI和报告必须如实表述。
