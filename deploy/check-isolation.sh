#!/usr/bin/env bash
# 部署前隔离检查（只读）
#
# 目的：在动 LITUBO 之前，证明这次操作不会碰到 anyivalves.com 和 deploy 栈。
# 用法：ssh ubuntu@43.165.125.203 'bash -s' < deploy/check-isolation.sh
#
# 输出每一行的判定；出现 FAIL 时不要继续部署。

set -uo pipefail
fail=0
ok()  { printf '  OK    %s\n' "$*"; }
bad() { printf '  FAIL  %s\n' "$*"; fail=$((fail+1)); }
info(){ printf '  --    %s\n' "$*"; }

echo "== LITUBO 自己的东西"
[ "$(id -un)" = "ubuntu" ] && ok "以 ubuntu 登录" || info "当前用户 $(id -un)"
getent passwd litubo >/dev/null && ok "用户 litubo 存在（$(id -u litubo)）" || bad "用户 litubo 不存在"
[ -L /srv/litubo/current ] && ok "current 是软链 -> $(readlink -f /srv/litubo/current)" || bad "current 缺失"
[ -f "$(readlink -f /srv/litubo/current)/server/index.mjs" ] && ok "release 内有 server/index.mjs" || bad "release 不完整"
[ -f /etc/litubo/litubo.env ] && ok "env 存在，权限 $(stat -c '%a %U:%G' /etc/litubo/litubo.env)" || bad "env 缺失"
systemctl is-active --quiet litubo && ok "litubo.service 运行中" || bad "litubo.service 未运行"
ss -ltn 2>/dev/null | grep -q '127.0.0.1:3311 ' && ok "3311 在回环监听" || bad "3311 未监听"

echo "== 端口占用（部署不能碰这些）"
for p in 3322 8065 8080 18075 3311 8055; do
  line=$(ss -ltnp 2>/dev/null | grep ":$p " | head -1)
  who=$(printf "%s" "$line" | grep -oE 'users:\(\("[^"]+"' | sed -E 's/.*"([^"]+)"/\1/')
  [ -z "$who" ] && who="(监听中，进程不可见)"
  info "端口 $p -> ${who:-空闲}"
done

echo "== anyivalves 不该被碰"
systemctl is-active --quiet anyi-web && ok "anyi-web.service 运行中" || bad "anyi-web.service 不在运行"
curl -sk -o /dev/null -w '' --resolve anyivalves.com:443:127.0.0.1 https://anyivalves.com/ \
  && ok "anyivalves.com 可访问" || bad "anyivalves.com 不可访问"

echo "== 容器归属（LITUBO 只碰 litubo-new）"
# 注意：anyi-v2-staging-* 四个容器是 2026-10 用 docker run 起的历史遗留，没有 compose 归属，
# 与本项目无关；这里标 FAIL 是为了提醒"别碰、也别复用它们的名字和端口"。
for c in $(sudo -n docker ps --format '{{.Names}}' 2>/dev/null); do
  proj=$(sudo -n docker inspect "$c" --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null)
  case "$proj" in
    litubo-new) info "$c -> litubo-new（可动）" ;;
    "") bad "$c 无 compose 归属（孤儿容器，别碰也别复用名字）" ;;
    *)  info "$c -> $proj（不要动）" ;;
  esac
done

echo "== 资源余量"
avail=$(free -m | awk '/^Mem:/{print $7}')
[ "${avail:-0}" -ge 512 ] && ok "可用内存 ${avail} MB" || bad "可用内存仅 ${avail} MB，先腾出空间"
disk=$(df --output=avail / | tail -1 | tr -d ' ')
[ "${disk:-0}" -ge 5242880 ] && ok "根分区可用 $((disk/1024/1024)) GB" || bad "根分区可用不足 5 GB"

echo
[ "$fail" -eq 0 ] && echo "结论：可以部署（FAIL 0）" || echo "结论：有 $fail 项不满足，先解决"
exit 0
