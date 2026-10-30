import OpenAI from "openai";

export const maxDuration = 60;

// 목소리를 바꾸고 싶으면 여기만 고치면 돼요: marin, coral, sage, shimmer, nova ...
const VOICE = "sage";

const INSTRUCTIONS = `You are reading a Korean bedtime picture book aloud to a young child.
Speak natural, native Korean with warm, gentle intonation — like a kind mom reading in a dim bedroom.
Soft, calm and slow. Smile in your voice. Pause briefly between sentences.
Give quoted lines a light, friendly character voice, but never loud or scary.
Toward sleepy moments, get quieter and slower.`;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY 가 없어요." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = String(body?.text ?? "").trim().slice(0, 1500);
  if (!text) return Response.json({ error: "읽을 글이 없어요." }, { status: 400 });

  try {
    const client = new OpenAI();
    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: VOICE,
      input: text,
      instructions: INSTRUCTIONS,
      response_format: "mp3",
    });
    return new Response(speech.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "목소리를 만들지 못했어요." }, { status: 502 });
  }
}
