# platform/seed —— model-agent 镜像的能力基线（v1）

这个目录是**镜像出厂基线**的唯一来源：镜像构建时把这里装好、烘进只读种子目录，运行期再由
启动对账复制到卷上的组件目录（卷覆盖基线，见 modelman 仓库的 `docs/platform.md` P1 / P7）。

## 唯一机器可读来源

`agent-home/settings.json` 的 `packages` 与 `skills` 两个数组。别在别处再抄一遍清单——
本文件只写"为什么"，不写"有哪些"。

## v1 基线清单

| 包 | pin 的版本 | 为什么必须在基线里 |
|---|---|---|
| `pi-mcp-adapter` | 2.34.0 | 接模型能力的唯一通道；以后接 modelman 的小模型服务靠它 |
| `pi-hermes-memory` | 0.9.9 | 跨会话记忆与会话搜索，落点在组件目录（卷） |
| `pi-cost` | 0.1.1 | 成本可见：一次回答能看出花了多少 |
| `pi-web-access` | 0.30.0 | 联网搜索、抓取、PDF、转录（注意：内容会发给云端 provider） |
| `@dietrichgebert/ponytail` | 4.10.0 | 写 extension 本质是写代码，需要工程纪律 |
| `@narumitw/pi-lsp` | 0.49.8 | 写 TypeScript extension 时的类型与诊断 |

| skill | 来源 | 为什么必须在基线里 |
|---|---|---|
| `skill-creator` | Apache-2.0，来自 Anthropic 的 skill-creator，随本目录带上 `LICENSE.txt` | "在平台内写新 skill"是工作台的核心动作 |

镜像里 pin 的 Pi 本体版本：**与应用的 lockfile 一致**（当前 0.87.1）。构建期有一条断言：全局 CLI 的版本必须等于应用依赖的版本，不一致就当场失败——否则"平台里看到的 Pi"和"会话里跑的 Pi"会不是一回事。

## 排除项与触发条件

基线越小越好：基线是要 review、要跟上游 merge、每次重建都要验的东西；其余能力走卷按需加。

| 不带 | 原因 | 什么时候加 |
|---|---|---|
| `pi-agent-browser-native` | 容器要装 chromium 与 ffmpeg，镜像涨几百 MB | 真出现页面自动化需求 |
| `pi-subagents` | 编排复杂度，单用户不值 | 出现可并行的独立子任务 |
| `@narumitw/pi-usage` | 与 `pi-cost` 重叠 | 要看 provider 账户额度时 |
| `pi-desktop-ui` / `@narumitw/pi-btw` / `@narumitw/pi-file-context` | 桌面版冲突；后两个是交互便利而非能力 | 随时 |
| `@firstpick/pi-extension-grill-me` | 属开发流程 | 不用 |
| 本机 `rtk.ts`（bash 重写） | 依赖宿主机的一个二进制；省 token 发生在 bash 密集的编码会话 | 工作台真变成编码场景时 |
| `pi-caveman` | 纯输出风格，不是能力 | 想在工作台里也用这种风格时 |
| 开发机与内网工作流类 skills | 运行时用不上，且带内网依赖 | 不用 |

## 安装（构建期，不在运行期）

```bash
# 构建期需要外网（与 modelman 构建期下载预编译归档同理）；
# 运行期不开安装动作：PI_OFFLINE=1。
export PI_CODING_AGENT_DIR=<seed 中的 agent-home 副本>
for spec in $(node -e 'for (const p of require("./agent-home/settings.json").packages) console.log(p)'); do
  pi install "$spec"
done
```

装完会得到 `agent-home/npm/` 与其中的 lockfile；一并当作基线的一部分烘进镜像。

## 校验

```bash
node platform/seed/verify.mjs                                   # 校验 seed 目录
PI_CODING_AGENT_DIR=/data/agent-home node platform/seed/verify.mjs   # 校验运行期组件目录
```

校验三件事：每条都带了字面版本、已安装版本与 pin 完全一致、skill 存在且不是符号链接。
镜像冒烟里跑一次，少一个包或多一个版本就失败。

在开发机上直接跑会报"未安装"——这是预期的：安装发生在构建期。

## 改这个清单

1. 改 `agent-home/settings.json`（连同版本号），补本文件的理由表。
2. 本地装一遍并跑 `verify.mjs`。
3. 走 PR —— 改基线等于改镜像的能力边界，与模型仓库改契约基线同级。

## 已知依赖

`skill-creator` 的脚本是 Python（`init_skill.py`、`package_skill.py`、`quick_validate.py`），
所以基线镜像需要带 `python3`。新增 skill 时要同样检查它引用的脚本与资源。
