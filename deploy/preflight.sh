#!/usr/bin/env bash
# LITUBO 部署前体检（只读，不改任何东西）
#
# 在目标服务器上运行：
#   bash deploy/preflight.sh
#
# 它只回答一个问题：这台机器现在能不能跑起这个站。
# 每一项输出 PASS / FAIL / WARN，不给建议、不动配置。

set -uo pipefail

pass=0; fail=0; warn=0
ok()   { printf '  PASS  %s\n' "$*"; pass=$((pass+1)); }
no()   { printf '  FAIL  %s\n' "$*"; fail=$((fail+1)); }
hmm()  { printf '  WARN  %s\n' "$*"; warn=$((warn+1)); }
head_() { printf '\n== %s ==\n' "$*"; }

head_ "系统"
printf '  %s\n' "$(uname -srm)"
if [ -r /etc/os-release ]; then . /etc/os-release; printf '  %s\n' "${PRETTY_NAME:-unknown}"; fi

head_ "Node.js（需要 22.22.2）"
if command -v node >/dev/null 2>&1; then
  v="$(node -v)"
  case "$v" in
    v22.22.*) ok "node $v" ;;
    v22.*)    hmm "node $v（同主版本，但项目锁定 22.22.2）" ;;
    *)        no "node $v（需要 22.22.2）" ;;
  esac
else
  no "未安装 node"
fi
command -v npm >/dev/null 2>&1 && ok "npm $(npm -v)" || no "未安装 npm"

head_ "反向代理"
if command -v nginx >/dev/null 2>&1; then
  ok "nginx $(nginx -v 2>&1 | sed 's/.*nginx\///')"
  nginx -t >/dev/null 2>&1 && ok "nginx 配置语法可读（nginx -t）" || hmm "nginx -t 需要 root，跳过"
else
  no "未安装 nginx"
fi

head_ "进程管理"
if command -v systemctl >/dev/null 2>&1; then
  ok "systemd 可用"
  systemctl list-unit-files 2>/dev/null | grep -q '^litubo\.service' && hmm "已存在 litubo.service（将覆盖）" || ok "尚无 litubo.service"
else
  no "无 systemd（本清单按 systemd 设计）"
fi

head_ "目录与权限"
for d in /srv /etc; do
  [ -d "$d" ] && ok "$d 存在" || no "$d 不存在"
done
if [ -d /srv/litubo ]; then
  hmm "/srv/litubo 已存在：$(ls -1 /srv/litubo | wc -l) 个条目"
else
  ok "/srv/litubo 尚未创建（部署时创建）"
fi
if [ -f /etc/litubo/litubo.env ]; then
  hmm "/etc/litubo/litubo.env 已存在（部署时确认，不覆盖）"
  perm="$(stat -c '%a' /etc/litubo/litubo.env 2>/dev/null || echo '?')"
  [ "$perm" = "640" ] || hmm "litubo.env 权限是 $perm（建议 640）"
else
  ok "/etc/litubo/litubo.env 尚未创建"
fi

head_ "端口"
if command -v ss >/dev/null 2>&1; then
  ss -ltnp 2>/dev/null | grep -q ':3000 ' && no "3000 已被占用（$(ss -ltnp 2>/dev/null | grep ':3000 ' | head -1)）" || ok "3000 空闲"
  ss -ltnp 2>/dev/null | grep -q ':80 ' && hmm "80 已被占用（nginx 在跑？）" || hmm "80 未监听"
  ss -ltnp 2>/dev/null | grep -q ':8055 ' && hmm "8055 已占用（Directus 在跑？）" || ok "8055 空闲"
else
  hmm "无 ss 命令，跳过端口检查"
fi

head_ "Docker（Directus 与 PostgreSQL 用）"
if command -v docker >/dev/null 2>&1; then
  ok "docker $(docker --version 2>/dev/null | sed 's/Docker version //;s/,.*//')"
  docker info >/dev/null 2>&1 && ok "docker 守护进程可访问" || no "docker 守护进程不可访问"
  docker compose version >/dev/null 2>&1 && ok "docker compose 可用" || hmm "docker compose 不可用"
  running="$(docker ps --format '{{.Names}}' 2>/dev/null | wc -l)"
  ok "运行中的容器 $running 个"
  docker ps --format '  {{.Names}}  {{.Status}}' 2>/dev/null | head -10
else
  no "未安装 docker"
fi

head_ "磁盘"
df -h /srv 2>/dev/null | tail -1 || df -h / | tail -1
avail_kb="$(df --output=avail /srv 2>/dev/null | tail -1 | tr -d ' ')"
if [ -n "${avail_kb:-}" ]; then
  avail_gb=$((avail_kb / 1024 / 1024))
  [ "$avail_gb" -ge 5 ] && ok "可用 ${avail_gb} GB" || no "可用仅 ${avail_gb} GB（构建与上传需要空间）"
fi

head_ "出网（Directus 与本机回环，不测外网）"
curl -fsS --max-time 3 http://127.0.0.1:8055/server/info >/dev/null 2>&1 \
  && ok "127.0.0.1:8055 有响应" || hmm "127.0.0.1:8055 无响应（Directus 未起或端口不同）"

printf '\n== 结论 ==\n  PASS %d · WARN %d · FAIL %d\n' "$pass" "$warn" "$fail"
[ "$fail" -eq 0 ] && printf '  可以继续部署（WARN 项需人工判断）\n' || printf '  有 FAIL 项，先解决再部署\n'
exit 0
