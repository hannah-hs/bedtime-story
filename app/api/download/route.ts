// Storage 에 있는 그림·목소리를 "내려받기"로 받게 해 주는 길이에요.
// (Storage 주소를 그대로 열면 새 탭에서 보이기만 하고 저장이 안 돼서, 우리 서버가 대신 받아서 넘겨줘요)
// 우리 Firebase Storage 의 파일만 받아요. 다른 주소는 거절해요.

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const raw = params.get("url") ?? "";
  const name = (params.get("name") ?? "download").replace(/[\\/:*?"<>|\r\n]/g, "").slice(0, 120) || "download";

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("잘못된 주소예요.", { status: 400 });
  }
  const ours =
    Boolean(BUCKET) &&
    target.protocol === "https:" &&
    target.hostname === "firebasestorage.googleapis.com" &&
    target.pathname.startsWith(`/v0/b/${BUCKET}/o/`);
  if (!ours) return new Response("이 파일은 받을 수 없어요.", { status: 403 });

  const upstream = await fetch(target, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) return new Response("파일을 찾지 못했어요.", { status: 404 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
