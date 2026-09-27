# model-agent 镜像：fork 的 pi-web + 出厂能力基线（见 platform/seed）。
#
# 构建期需要外网（npm 依赖、基线包、Pi 本体）；运行期不允许任何安装动作（PI_OFFLINE=1），
# 与 modelman"权重不在运行期下载"是同一条纪律。
#
# 构建：
#   docker build -f platform/docker/Dockerfile -t model-agent:dev .

FROM node:24-bookworm AS builder

# 原生依赖（node-pty 等）需要编译工具链；这些不进最终镜像
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential ca-certificates git python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 构建期外网：默认官方 registry（CI 在境外）；本地在境内可用
#   --build-arg NPM_REGISTRY=https://registry.npmmirror.com
# 覆盖。注册表只影响构建期，不进运行期。
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm config set registry "$NPM_REGISTRY"

# Pi 本体就是应用自己的依赖（lockfile 里 pin 死），不另装一份全局副本。
# 好处：镜像里只有一份 Pi，“平台里看到的 Pi”与“会话里跑的 Pi”结构上不可能不一致；
# 代价：少了 449 MB 的重复。
ARG PI_CLI=node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js

COPY package.json package-lock.json ./
# postinstall 会跑 bin/prepare-terminal.js，所以 bin 要先于 npm ci 进镜像
COPY bin ./bin
RUN npm ci

RUN node -e 'console.log("Pi 本体（来自 lockfile）：", require("./node_modules/@earendil-works/pi-coding-agent/package.json").version)'

COPY . .
RUN npm run build

# 出厂基线：装进种子目录。运行期由 entrypoint 对账到卷，卷覆盖基线。
# 这里直接用应用依赖里的 Pi CLI，不再另装全局副本。
RUN set -eux; \
  export PI_CODING_AGENT_DIR=/opt/agent-seed/agent-home; \
  mkdir -p "$PI_CODING_AGENT_DIR"; \
  cp -R platform/seed/agent-home/. "$PI_CODING_AGENT_DIR"; \
  for spec in $(node -e 'for (const p of require(process.env.PI_CODING_AGENT_DIR + "/settings.json").packages) console.log(p)'); do node "$PI_CLI" install "$spec"; done; \
  node platform/seed/verify.mjs "$PI_CODING_AGENT_DIR"

# 运行期不需要构建缓存与开发依赖
RUN npm prune --omit=dev && rm -rf .next/cache


FROM node:24-bookworm-slim AS runtime

# bash：Pi 的 bash 工具；git：版本操作；ripgrep：Pi 的 grep 工具；
# python3：基线 skill（skill-creator）的脚本依赖；ca-certificates：访问 provider API
RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git python3 ripgrep \
  && rm -rf /var/lib/apt/lists/*

# 不再另装全局 Pi：运行期的 pi 命令指向应用自己那份依赖的 CLI（同一份，不会漂移）
WORKDIR /app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/public ./public
COPY --from=builder /app/platform ./platform
COPY --from=builder /opt/agent-seed /opt/agent-seed

# 不另装全局 Pi：运行期的 pi 命令指向应用自己那份依赖的 CLI（同一份，不会漂移）。
# 必须放在 COPY node_modules 之后——wrapper 指向的文件得先存在。
ARG PI_CLI=node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js
RUN printf '#!/bin/sh\nexec node /app/%s "$@"\n' "$PI_CLI" > /usr/local/bin/pi \
  && chmod +x /usr/local/bin/pi \
  && pi --version

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=30141 \
  PI_CODING_AGENT_DIR=/data/agent-home \
  OVERRIDES_DIR=/data/overrides \
  SEED_DIR=/opt/agent-seed/agent-home \
  PI_OFFLINE=1 \
  PI_WEB_HOSTNAME=0.0.0.0 \
  PI_WEB_NO_OPEN=1 \
  PI_WEB_SKIP_VERSION_CHECK=1

# 部署侧必须再注入两个：PI_WEB_PASSWORD（入口密码，来自 cops secrets）、
# PI_WEB_ALLOWED_HOSTS（对外域名，逗号分隔）。
EXPOSE 30141
VOLUME ["/data"]

ENTRYPOINT ["node", "/app/platform/runtime/entrypoint.mjs"]
