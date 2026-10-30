import OpenAI from "openai";
import { IMAGE_MODEL } from "@/lib/models";

// 그림 한 장은 오래 걸리면 1~2분까지 걸릴 수 있어요
export const maxDuration = 120;

// 옛날 이솝 우화 · 고전 동화책 그림 느낌 (선과 붓질은 같게, 색과 빛은 책마다 달라요)
const STYLE =
  "Classic early 20th century fable and fairy tale book illustration: fine sepia ink linework with delicate cross-hatching and softly washed watercolor on cream paper. Warm, gentle and friendly, cute characters, rich storybook detail. No text, no letters.";
// 화풍을 못 받았을 때 쓰는 기본 색감
const DEFAULT_ART = "muted sage green, ochre, faded rose and dusty blue, soft natural daylight";

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY 가 없어요." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { hero?: unknown; scene?: unknown; art?: unknown } | null;
  const hero = String(body?.hero ?? "").trim().slice(0, 300);
  const art = String(body?.art ?? "").trim().slice(0, 300) || DEFAULT_ART;
  const scene = String(body?.scene ?? "").trim().slice(0, 300);
  if (!scene) return Response.json({ error: "장면 설명이 없어요." }, { status: 400 });

  try {
    const client = new OpenAI(); // .env 의 OPENAI_API_KEY 를 자동으로 읽어요
    const result = await client.images.generate({
      model: IMAGE_MODEL,
      prompt: `${STYLE}\nColor palette and light for this whole book: ${art}\nMain character (keep the same look): ${hero}\nScene (follow its time of day, light and camera framing): ${scene}`,
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
