// 平台新增：健康探针，口径与 /livez 相同（不碰组件目录）。
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
