// 平台新增：免登录存活探针。
//
// proxy.ts 的 matcher 只覆盖 `/`、`/login`、`/api/:path*`，所以这条路由不经过鉴权——
// 这是刻意的：容器探针与 cops 的健康门禁不该需要密码。
// 它只说明"进程活着"，不碰组件目录、不碰 provider。
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
