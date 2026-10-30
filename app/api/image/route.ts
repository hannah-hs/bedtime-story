import OpenAI from "openai";

// 그림 한 장은 오래 걸리면 1~2분까지 걸릴 수 있어요
export const maxDuration = 120;

// 옛날 이솝 우화 · 고전 동화책 그림 느낌
const STYLE =
  "Classic early 20th century fable and fairy tale book illustration: fine sepia ink linework with delicate cross-hatching, softly washed muted watercolor (sage green, ochre, faded rose, dusty blue), aged cream paper tones. Gentle bedtime mood, warm lantern or moonlight, cute and friendly characters. No text, no letters.";

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
