#!/usr/bin/env sh
# 容器冒烟：第一版镜像的验收，也是"重启可以接受、重启不能丢东西"那条硬要求的唯一证据。
#
#   1. 免登录探针可用（/livez、/healthz、/readyz）
#   2. 未登录访问页面被挡到 /login
#   3. 登录后页面可用
#   4. 容器内基线校验通过（pin、版本、skill 非符号链接）
#   5. 重启容器：平台内写的 skill 还在（卷兜住）
#   6. 基线被本地改过的文件：重启后保留，并记进 conflicts.json
#
# 用法：IMAGE=model-agent:dev platform/docker/smoke.sh

set -eu

IMAGE=${IMAGE:-model-agent:dev}
PORT=${PORT:-13041}
PASSWORD=${PASSWORD:-smoke-password}
NAME=${NAME:-model-agent-smoke}
WAIT_SECONDS=${WAIT_SECONDS:-180}

WORK=$(mktemp -d)
DATA="$WORK/data"
COOKIES="$WORK/cookies.txt"
mkdir -p "$DATA"

fail() {
  echo "冒烟失败：$1" >&2
  exit 1
}

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  # 容器以 root 跑，写进 bind mount 的文件归 root：用一个一次性容器自己收尾，
  # 否则宿主机上的 rm 会因权限不足失败。
  docker run --rm --entrypoint sh -v "$WORK:/w" "$IMAGE" -c 'rm -rf /w/data /w/cookies.txt' >/dev/null 2>&1 || true
  rm -rf "$WORK" 2>/dev/null || true
}
trap cleanup EXIT

start() {
  docker run -d --name "$NAME" \
    -v "$DATA:/data" \
    -e "PI_WEB_PASSWORD=$PASSWORD" \
    -p "127.0.0.1:$PORT:30141" \
    "$IMAGE" >/dev/null
}

restart() {
  docker rm -f "$NAME" >/dev/null
  start
  wait_ready
}

wait_ready() {
  i=0
  while [ "$i" -lt "$WAIT_SECONDS" ]; do
    if [ "$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/livez" 2>/dev/null || true)" = "200" ]; then
      return 0
    fi
    sleep 2
    i=$((i + 2))
  done
  echo "--- 容器日志 ---" >&2
  docker logs "$NAME" >&2 || true
  fail "等待 /livez 超过 ${WAIT_SECONDS}s"
}

code() {
  curl -sS -o /dev/null -w '%{http_code}' "$@"
}

echo "== 1. 起容器 =="
start
wait_ready

echo "== 2. 免登录探针 =="
for path in /livez /healthz /readyz; do
  [ "$(code "http://127.0.0.1:$PORT$path")" = "200" ] || fail "$path 不是 200"
done
curl -sS "http://127.0.0.1:$PORT/readyz" | grep -q '"status":"ok"' || fail "/readyz 不 ok"

echo "== 3. 未登录被挡 =="
location=$(curl -sSi "http://127.0.0.1:$PORT/" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}')
case "$location" in
  */login*) ;;
  *) fail "未登录访问 / 没有被引到 /login（Location=$location）" ;;
esac

echo "== 4. 登录后页面可用 =="
[ "$(code -X POST -H 'Content-Type: application/json' \
  -d "{\"password\":\"$PASSWORD\"}" -c "$COOKIES" \
  "http://127.0.0.1:$PORT/api/web-auth")" = "200" ] || fail "登录失败"
[ "$(code -b "$COOKIES" "http://127.0.0.1:$PORT/")" = "200" ] || fail "登录后 / 不是 200"

echo "== 5. 卷上的基线校验 =="
docker exec "$NAME" node /app/platform/seed/verify.mjs >/dev/null || fail "容器内基线校验未通过"
docker logs "$NAME" 2>&1 | grep -q '\[reconcile\]' || fail "启动没跑对账"

echo "== 6. 平台内写的东西活过重启 =="
docker exec "$NAME" sh -c 'mkdir -p /data/agent-home/skills/e2e-probe && printf -- "---\nname: e2e-probe\ndescription: 冒烟用\n---\n" > /data/agent-home/skills/e2e-probe/SKILL.md'
restart
docker exec "$NAME" test -f /data/agent-home/skills/e2e-probe/SKILL.md || fail "重启后平台内写的 skill 丢了"

echo "== 7. 被本地改过的基线文件不被静默覆盖 =="
docker exec "$NAME" sh -c 'echo "<!-- local edit -->" >> /data/agent-home/skills/skill-creator/SKILL.md'
restart
docker exec "$NAME" sh -c 'grep -q "local edit" /data/agent-home/skills/skill-creator/SKILL.md' \
  || fail "重启后本地改动被静默覆盖了"
docker exec "$NAME" sh -c 'grep -q "skill-creator/SKILL.md" /data/overrides/conflicts.json' \
  || fail "冲突没有记进 conflicts.json"

echo "冒烟通过：$IMAGE"
