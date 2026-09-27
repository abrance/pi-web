// 平台新增：就绪探针。与 /livez 的区别是它真的去碰组件目录：
// 组件目录存在、可写、且启动对账留下的 manifest 在——三者缺一就 503。
// 这样"对账没跑成"不会被一个永远 200 的探针盖住。
import { accessSync, constants, existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const dynamic = "force-dynamic";

export function GET() {
  const agentHome = resolve(process.env.PI_CODING_AGENT_DIR || "/data/agent-home");
  const overrides = resolve(process.env.OVERRIDES_DIR || "/data/overrides");
  const checks: Record<string, string> = {};

  try {
    accessSync(agentHome, constants.W_OK);
    checks.agentHome = agentHome;
  } catch {
    checks.agentHome = `${agentHome} 不存在或不可写`;
  }

  const manifest = join(overrides, "baseline-manifest.json");
  if (existsSync(manifest)) {
    checks.manifest = manifest;
  } else {
    checks.manifest = `${manifest} 不存在（启动对账没跑成）`;
  }

  const failed = Object.entries(checks).filter(([, value]) => value.includes("不存在"));
  const body = { status: failed.length === 0 ? "ok" : "unavailable", checks };
  return Response.json(body, {
    status: failed.length === 0 ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
