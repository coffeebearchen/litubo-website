# 当前唯一施工入口：三语言 EN / ES / AR

业主最新更正：只有三种语言，English、Español、العربية。默认英文。此前四/五/六语言文件保留为历史，不再作为当前语言范围。中文、葡语、日语不属于本轮新增建设；已有pt等字段/记录保留，不因界面收缩而删除历史数据。

## DSH先做什么

先阅读本文件与01-IMPLEMENTATION.md，再打开本包两份可点击UI，对照截图实施。不要只读聊天指令、不看设计；也不要把旧报告中的语言数量、旧schema假设直接套到当前代码。

- header-ui.html：页头语言、搜索、Resources菜单、Blog列表和文章界面参考；语言选择已改EN/ES/AR。
- admin-ui.html：后台导航、询盘列表/详情、产品编辑界面参考；内容语言已改EN/ES/AR。
- assets：已确认的冷绿光机器插画。
- UI-01/02/03截图：设计方向参考，不是当前真实后台实测；包含明确标识的示例数据。

## 仍采用的设计方向

1. 前台主菜单顺序保持；右上搜索+语言入口，EN默认，AR支持RTL。手机保留可见语言入口。
2. 后台操作界面英文，内容语言EN/ES/AR，后台外壳LTR；阿语编辑/预览局部RTL，型号邮箱等LTR。
3. 后台导航按Overview / Sales / Website / System分组，询盘、访客、产品、内容、媒体、连接及公开资料各有清晰入口。
4. 产品一个主要编辑流程，Save draft / Preview / Publish分开。询盘突出客户需求与内部跟进，不把CRM未配置当成询盘丢失。
5. 手绘冷白底、淡绿光、灰绿线稿，不用橙色暖光；真实产品照片不统一套色。

## 截图状态

用户截图显示English、Español Preview、العربية Preview，可证明这个入口呈现了三个语言选项；不能据此证明后台整体已按设计改完，也不能把Preview称作正式公开。

当前顾问没有直接联系或唤醒DSH会话；Drive是共享交付入口。此前聊天指令已给出阅读链接，但“已上传”不等于“DSH已读取/已实施”。DSH接手请在自己的CURRENT-STATE记录本入口名称、实际HEAD、采用范围和执行进度。

## 历史详细参考（冲突时以本入口和业主最新指令为准）

- 页头/搜索/Blog详细施工：https://drive.google.com/drive/folders/1PdxPdwEr7wDjxCLMHmqgCT3YL2SQU7BL
- 后台操作体验：https://drive.google.com/drive/folders/1nJSqZ55osY9GWvul-5W8v_3n_A0oU5JB
- 旧六语言数据架构讨论：https://drive.google.com/drive/folders/13XyvSmGHHgFDp_VVUUj_oBLZF4bYJFyO

第三项仅保留API问题、内容归属、公开过滤和回退等分析参考，六语言建表/批量迁移方案不作为默认执行要求。三语言下先按当前真实schema核实最小增量，不为已经取消的语言建表/字段。
