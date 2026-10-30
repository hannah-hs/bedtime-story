import OpenAI from "openai";

// 그림 한 장은 오래 걸리면 1~2분까지 걸릴 수 있어요
export const maxDuration = 120;

// 꿈꾸는 동화 나라 수채화 느낌 (사이트 장식과 같은 화풍)
const STYLE =
  "Dreamy fairy tale storybook watercolor illustration: soft pastel periwinkle, lavender, blush pink, dusty teal and cream, delicate fine ink details, gentle glow of moonlight or lantern light, enchanted and cozy bedtime mood, cute and friendly characters. No text, no letters.";

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY 가 없어요." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { hero?: unknown; scene?: unknown } | null;
  const hero = String(body?.hero ?? "").trim().slice(0, 300);
  const scene = String(body?.scene ?? "").trim().slice(0, 300);
  if (!scene) return Response.json({ error: "장면 설명이 없어요." }, { status: 400 });

  try {
    const client = new OpenAI(); // .env 의 OPENAI_API_KEY 를 자동으로 읽어요
    const result = await client.images.generate({
      model: "gpt-image-2.5-flare",
      prompt: `${STYLE}\nMain character (keep the same look): ${hero}\nScene: ${scene}`,
      size: "1024x1024",
      quality: "medium",
      output_format: "jpeg",
      output_compression: 80,
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("no image data");
    return Response.json({ image: `data:image/jpeg;base64,${b64}` });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "그림을 만들지 못했어요." }, { status: 502 });
  }
}
