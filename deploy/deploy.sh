#!/usr/bin/env bash
# LITUBO 发布脚本（草案，未执行过）
#
# 它做的事：本地构建 → 打包 → 上传 → 服务器上解包到新 release → 切换软链 → 重启 → 健康检查。
# 它不做的事：不碰数据库、不迁移上传文件、不改 DNS、不动 Nginx 配置。
#
# 需要你提供/确认的三个变量（脚本不接受默认值）：
#   LITUBO_HOST   服务器地址
#   LITUBO_USER   SSH 用户（用 key 登录，不要密码）
#   LITUBO_PATH   服务器上的根目录（例如 /srv/litubo）
#
# 用法：
#   LITUBO_HOST=... LITUBO_USER=... LITUBO_PATH=/srv/litubo ./deploy/deploy.sh

set -euo pipefail

: "${LITUBO_HOST:?LITUBO_HOST 未设置}"
: "${LITUBO_USER:?LITUBO_USER 未设置}"
: "${LITUBO_PATH:?LITUBO_PATH 未设置}"

cd "$(dirname "$0")/.."

# 0) 必须干净：不允许把未提交的代码发上去
if [ -n "$(git status --porcelain)" ]; then
  echo "工作树不干净，先提交或清理：" >&2
  git status --short >&2
  exit 1
fi

REV="$(git rev-parse --short HEAD)"
PKG="litubo-${REV}.tar.gz"
echo "== 发布 ${REV}"

# 1) 本地生产构建
export NODE_ENV=production
npm ci
npm run build

# 2) 只打包运行所需（不含 node_modules / .env / 源码文档）
tar czf "${PKG}" .output package.json

# 3) 上传
ssh "${LITUBO_USER}@${LITUBO_HOST}" "mkdir -p ${LITUBO_PATH}/releases"
scp "${PKG}" "${LITUBO_USER}@${LITUBO_HOST}:${LITUBO_PATH}/releases/"

# 4) 服务器上解包、切换、重启、健康检查
ssh "${LITUBO_USER}@${LITUBO_HOST}" bash -s <<REMOTE
set -euo pipefail
cd ${LITUBO_PATH}/releases
rm -rf ${REV} && mkdir -p ${REV}
tar xzf ${PKG} -C ${REV}
ln -sfn ${LITUBO_PATH}/releases/${REV} ${LITUBO_PATH}/current
sudo systemctl restart litubo
sleep 2
curl -fsS http://127.0.0.1:3000/ >/dev/null && echo "app up on ${REV}"
REMOTE

rm -f "${PKG}"
echo "== 完成。回滚：见 deploy/README.md"
