#!/usr/bin/env node
// 校验镜像能力基线（v1）。
//
// 三件事，缺一件就失败：
//   1. settings.json 里每个包都必须带字面版本（没 pin 的会随上游漂）；
//   2. 已安装的版本必须与 pin 的完全一致（构建脚本改坏了要当场发现）；
//   3. 基线 skill 必须存在、带 SKILL.md、且不是符号链接（符号链接进镜像会断）。
//
// 用法：
//   node platform/seed/verify.mjs                     # 校验 platform/seed/agent-home
//   node platform/seed/verify.mjs /data/agent-home     # 校验指定目录
//   PI_CODING_AGENT_DIR=/data/agent-home node ...      # 或用环境变量（镜像内冒烟走这条）
//
// 优先级：命令行参数 > 环境变量 > 本目录的 agent-home。
// 环境变量可能是外部注入的（例如宿主 harness 会设 PI_CODING_AGENT_DIR），
// 所以目标目录一定会打印出来，免得静默校验了别的目录。

import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const source = process.argv[2]
  ? "命令行参数"
  : process.env.PI_CODING_AGENT_DIR
    ? "环境变量 PI_CODING_AGENT_DIR"
    : "默认（本目录的 agent-home）"
const agentHome = resolve(process.argv[2] || process.env.PI_CODING_AGENT_DIR || join(here, "agent-home"))
const problems = []

console.log(`校验目标：${agentHome}（来自${source}）`)

let settings
try {
  settings = JSON.parse(readFileSync(join(agentHome, "settings.json"), "utf8"))
} catch (error) {
  console.error(`读取 ${join(agentHome, "settings.json")} 失败：${error.message}`)
  process.exit(1)
}

const packages = settings.packages ?? []
const skills = settings.skills ?? []

for (const entry of packages) {
  const spec = typeof entry === "string" ? entry : entry?.source
  if (typeof spec !== "string") {
    problems.push(`清单里有无法识别的条目：${JSON.stringify(entry)}`)
    continue
  }
  const match = /^npm:(@?[^@]+)@(.+)$/.exec(spec)
  if (!match) {
    problems.push(`未 pin 或非 npm 条目：${spec}（必须写成 npm:<名>@<字面版本>）`)
    continue
  }
  const [, name, version] = match
  const pkgFile = join(agentHome, "npm", "node_modules", name, "package.json")
  if (!existsSync(pkgFile)) {
    problems.push(`未安装：${name}@${version}`)
    continue
  }
  const actual = JSON.parse(readFileSync(pkgFile, "utf8")).version
  if (actual !== version) {
    problems.push(`版本不符：${name} 清单 ${version}，实际 ${actual}`)
  }
}

for (const dir of skills) {
  const path = resolve(agentHome, dir)
  if (!existsSync(path)) {
    problems.push(`skill 不存在：${dir}`)
    continue
  }
  if (lstatSync(path).isSymbolicLink()) {
    problems.push(`skill 是符号链接（进镜像会断）：${dir} → ${realpathSync(path)}`)
  }
  if (!existsSync(join(path, "SKILL.md"))) {
    problems.push(`skill 缺少 SKILL.md：${dir}`)
  }
}

if (problems.length > 0) {
  console.error(`基线校验未通过（${problems.length} 处）：`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(`基线校验通过：${packages.length} 个包、${skills.length} 个 skill（组件目录 ${agentHome}）`)