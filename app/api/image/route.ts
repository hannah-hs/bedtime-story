import OpenAI, { toFile } from "openai";
import { IMAGE_MODEL } from "@/lib/models";

// 그림 한 장은 오래 걸리면 1~2분까지 걸릴 수 있어요
export const maxDuration = 120;

// 옛날 이솝 우화 · 고전 동화책 그림 느낌 (선과 붓질은 같게, 색과 빛은 책마다 달라요)
const STYLE =
  "Classic early 20th century fable and fairy tale book illustration: fine sepia ink linework with delicate cross-hatching and softly washed watercolor on cream paper. Warm, gentle and friendly, cute characters, rich storybook detail. No text, no letters.";
// 화풍을 못 받았을 때 쓰는 기본 색감
const DEFAULT_ART = "muted sage green, ochre, faded rose and dusty blue, soft natural daylight";

const MAX_REFERENCE_BYTES = 4 * 1024 * 1024;

/*
  두 가지 그림을 그려요.
  - kind: "sheet" → 등장인물 설정화: 주인공과 등장인물을 한 줄로 세운 그림 (책마다 한 번)
  - kind: "page"  → 장면 그림. 설정화(reference)를 함께 받으면 그걸 보고 인물을 똑같이 그려요
*/
export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY 가 없어요." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const text = (key: string, max: number) => String(body?.[key] ?? "").trim().slice(0, max);
  const kind = body?.kind === "sheet" ? "sheet" : "page";
  const hero = text("hero", 300);
  const art = text("art", 300) || DEFAULT_ART;
  const cast = text("cast", 1500).replace(/^none\.?$/i, "");
  const scene = text("scene", 400);
  const reference = parseReference(body?.reference);
  if (kind === "page" && !scene) return Response.json({ error: "장면 설명이 없어요." }, { status: 400 });

  const look = [
    `Color palette and light for this whole book: ${art}`,
    `Main character: ${hero}`,
    cast ? `Other recurring characters (always exactly this look): ${cast}` : "",
  ].filter(Boolean);

  try {
    const client = new OpenAI(); // .env 의 OPENAI_API_KEY 를 자동으로 읽어요
    let b64: string | undefined;

    if (kind === "sheet") {
      const result = await client.images.generate({
        model: IMAGE_MODEL,
        prompt: [
          STYLE,
          ...look,
          "Draw a CHARACTER REFERENCE SHEET for this picture book: every character listed above (main character first, then the others in the listed order) standing side by side in a row, full body, facing the viewer, clearly separated, on a plain warm cream paper background with no scenery. Show each one's species, face, body shape, colors, clothes and accessories very clearly.",
        ].join("\n"),
        size: "1536x1024",
        quality: "medium",
        output_format: "jpeg",
        output_compression: 85,
      });
      b64 = result.data?.[0]?.b64_json;
    } else {
      const prompt = [
        STYLE,
        ...look,
        reference
          ? "The attached image is this book's character reference sheet. Every character who appears in this scene must look exactly like in the reference sheet: same species, face, body shape, colors, clothes and accessories. Do not copy the sheet's row layout or its blank background; draw a full illustrated scene."
          : "",
        `Scene (follow its time of day, light and camera framing): ${scene}`,
      ]
        .filter(Boolean)
        .join("\n");
      const common = { model: IMAGE_MODEL, prompt, size: "1024x1024", quality: "medium", output_format: "jpeg", output_compression: 80 } as const;
      const result = reference
        ? await client.images.edit({ ...common, image: await toFile(reference.bytes, `reference.${reference.ext}`, { type: reference.type }) })
        : await client.images.generate(common);
      b64 = result.data?.[0]?.b64_json;
    }

    if (!b64) throw new Error("no image data");
    return Response.json({ image: `data:image/jpeg;base64,${b64}` });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "그림을 만들지 못했어요." }, { status: 502 });
  }
}

/** 화면이 보내 준 설정화(data:image/...;base64,...)를 파일로 바꿔요 */
function parseReference(value: unknown) {
  if (typeof value !== "string") return null;
  const m = value.match(/^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const bytes = Buffer.from(m[3], "base64");
  if (bytes.length === 0 || bytes.length > MAX_REFERENCE_BYTES) return null;
  return { bytes, type: m[1], ext: m[2] === "jpeg" ? "jpg" : m[2] };
}
