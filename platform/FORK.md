# platform/FORK.md —— 这个仓库是什么，以及我们改了上游哪里

## 这个仓库是什么

**model-agent：单用户、自托管的能力工作台。**一个入口进去，能聊天（云端大模型）、能调自建的
小模型服务、能在平台里写新能力（skill / extension）、能把会话与产物归档带走。不做多租户，
不做能力市场，服务对象就是一个人。

它是 [pi-web](https://github.com/agegr/pi-web) 的 **fork**：会话、provider 与模型配置、
skills 与插件面板这些直接复用上游；我们只加平台需要的那部分——出厂基线与卷的两段式、
启动对账、免登录探针、物料归档、extension 的发布与回退。

| 想知道 | 去哪看 |
|---|---|
| 产品形态、分层、决策记录与理由 | modelman 仓库的 `docs/platform.md`（**权威**） |
| 工作台骨架：卷布局、对账规则、端点、切片顺序 | modelman 仓库的 `docs/agent-design.md` |
| 出厂能力基线怎么改、怎么校验 | `platform/seed/README.md` |
| 在这里怎么构建、怎么验 | `platform/docker/`（Dockerfile 与冒烟） |
| 上游 pi-web 本身的用法 | 上游 `README.md` 与 `docs/` |

下面这张表只管一件事：**我们动了上游哪些文件**。没有登记就说明不该有改动。

## 分叉登记表

这个仓库是 pi-web 的 fork，**任何改动上游文件的地方都登记在这张表里**：
上游发版 merge 时按表逐个处理。

校验方式：`git diff --stat upstream/main...main` 应该与下面的表一致；
多出来的文件说明有人改了上游却没登记。上游 remote 是 `upstream`（见 `git remote -v`）。

## 一、我们的目录（新增，完全不碰上游）

| 路径 | 作用 |
|---|---|
| `platform/seed/` | 出厂能力基线：唯一机器可读清单 + 校验脚本 + 理由 |
| `platform/runtime/` | 启动对账（种子 → 卷）与容器入口 |
| `platform/docker/` | Dockerfile 与容器冒烟 |

## 二、新增的文件（放在上游目录结构里）

| 文件 | 原因 |
|---|---|
| `app/livez/route.ts`、`app/healthz/route.ts`、`app/readyz/route.ts` | 免登录探针，上游没有。上游 `proxy.ts` 的 matcher 只覆盖 `/`、`/login`、`/api/:path*`，这三个路径天然不过鉴权——正是"探针不该要密码"需要的 |
| `.dockerignore` | 构建上下文瘦身（node_modules 与 .next 由构建期生成） |

## 三、改动的上游文件

| 文件 | 改动 | 原因 |
|---|---|---|
| `app/layout.tsx` | 等宽字体从 `next/font/google` 换成自托管的 `@fontsource/noto-sans-mono` | `next/font/google` 会在**构建期**访问 fonts.googleapis.com：境内构建机取不到，构建直接失败。自托管同时满足"运行期不引 CDN" |
| `package.json`、`package-lock.json` | 新增依赖 `@fontsource/noto-sans-mono` | 同上 |

除以上三条，平台不修改任何上游文件。

## 四、合并上游

```bash
git fetch upstream
git merge upstream/main
# 冲突只可能落在第三节那三个文件上
```

merge 之后跑一遍容器的冒烟（`platform/docker/smoke.sh`），冒烟会连带校验基线清单。

## 五、何时重新评估

出现下列信号之一时，回头评估要不要脱离 pi-web 自建：

- 上游的形态（会话组织方式、路由与鉴权模型）与平台需求持续冲突，只能靠改上游解决；
- 第三节的表格长到比平台代码还大；
- 上游长期停滞或方向分叉。

因为我们的东西都在第一、二节，真要脱离时把 `platform/` 与那几个新文件搬走即可。
