"use client";

import { useEffect, useRef, useState } from "react";

type Page = { scene: string; text: string; sceneDone: boolean; complete: boolean };
type ImageState = { status: "loading" | "done" | "error"; src?: string };

const EXPECTED_PAGES = 5;
// 소리 없는 아주 짧은 소리 파일 (휴대폰에서 소리 장치를 깨울 때 써요)
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

// Claude가 보내는 글(제목:/주인공:/===/그림:)을 그림책 페이지로 나눠요
function parseStory(raw: string, streamDone: boolean) {
  const [head, ...chunks] = raw.split(/^===\s*$/m);
  const title = head.match(/^제목:\s*(.*)$/m)?.[1]?.trim() ?? "";
  const heroMatch = head.match(/^주인공:\s*(.*)\n/m);
  const pages: Page[] = chunks.map((chunk, i) => {
    const m = chunk.match(/^\s*그림:\s*(.*)(\n?)/);
    // "그림:" 줄, 아직 덜 온 "그림" 글자, 덜 온 "===" 줄은 본문에서 빼요
    const isHidden = (line: string) => {
      const t = line.trim();
      return t.length > 0 && (t.startsWith("그림:") || "그림:".startsWith(t) || /^=+$/.test(t));
    };
    return {
      scene: m?.[1]?.trim() ?? "",
      sceneDone: Boolean(m?.[2]), // 그림 줄 끝에 줄바꿈이 왔으면 그림 설명이 다 온 것
      text: chunk.split("\n").filter((l) => !isHidden(l)).join("\n").trim(),
      // 다음 장이 시작됐거나 이야기가 다 끝났으면 이 장은 다 쓴 것
      complete: i < chunks.length - 1 || streamDone,
    };
  });
  return { title, hero: heroMatch?.[1]?.trim() ?? "", pages };
}

export default function Home() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [likes, setLikes] = useState("");
  const [today, setToday] = useState("");
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [images, setImages] = useState<Record<number, ImageState>>({});
  const [speaking, setSpeaking] = useState(false);
  const requested = useRef(new Set<number>());
  const speakingRef = useRef(false);
  const [waitingFor, setWaitingFor] = useState<number | null>(null); // 읽어주다가 다음 장을 기다리는 중
  const bookRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef(new Map<string, Promise<string>>()); // 글 → 만들어 둔 목소리
  const [voiceLoading, setVoiceLoading] = useState(false);

  const { title, hero, pages } = parseStory(raw, !loading);
  const page = pages[pageIndex];
  // 읽어주기가 다 읽은 뒤 최신 페이지를 보도록 ref 에도 담아 둬요
  const latest = useRef({ title, pages, loading, pageIndex });
  latest.current = { title, pages, loading, pageIndex };
  const [flip, setFlip] = useState<{ from: number; dir: "next" | "prev"; key: number } | null>(null);

  // 페이지를 떠나면 읽어주기도 멈춰요
  useEffect(() => () => audioRef.current?.pause(), []);

  // 첫 장이 나오면 그림책 쪽으로 화면을 내려 줘요
  const firstPageShown = pages.length > 0;
  useEffect(() => {
    if (firstPageShown) bookRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [firstPageShown]);

  // 읽어주다가 기다리던 장이 다 써지면 이어서 읽어요
  useEffect(() => {
    if (waitingFor === null || !speakingRef.current) return;
    if (pages[waitingFor]?.complete) speakFrom(waitingFor);
    else if (!loading) stopSpeaking(); // 이야기가 끝났으면 읽기도 끝
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, waitingFor, loading]);

  // 장면의 그림 설명이 다 오면 바로 그림을 주문해요 (여러 장을 동시에)
  useEffect(() => {
    pages.forEach((p, i) => {
      if (!p.sceneDone || !p.scene || requested.current.has(i)) return;
      requested.current.add(i);
      setImages((s) => ({ ...s, [i]: { status: "loading" } }));
      fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hero, scene: p.scene }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { image: string }) => setImages((s) => ({ ...s, [i]: { status: "done", src: d.image } })))
        .catch(() => setImages((s) => ({ ...s, [i]: { status: "error" } })));
    });
  }, [pages, hero]);

  function stopSpeaking() {
    speakingRef.current = false;
    setWaitingFor(null);
    setVoiceLoading(false);
    audioRef.current?.pause();
    setSpeaking(false);
  }

  // OpenAI 목소리로 한 장을 읽은 소리 파일을 받아요 (한 번 받은 건 다시 안 받아요)
  function fetchVoice(text: string) {
    let voice = audioCache.current.get(text);
    if (!voice) {
      voice = fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : Promise.reject()));
      voice.catch(() => audioCache.current.delete(text)); // 실패하면 다음에 다시 시도
      audioCache.current.set(text, voice);
    }
    return voice;
  }

  function pageSpeech(i: number) {
    const { title, pages } = latest.current;
    return i === 0 ? `${title}. ${pages[i].text}` : pages[i].text;
  }

  async function makeStory(e: React.FormEvent) {
    e.preventDefault();
    stopSpeaking();
    setRaw("");
    setError("");
    setImages({});
    audioCache.current.forEach((v) => v.then(URL.revokeObjectURL, () => {}));
    audioCache.current = new Map();
    setPageIndex(0);
    setFlip(null);
    requested.current = new Set();
    setLoading(true);
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, age: Number(age), likes, today }),
      });
      if (!res.ok || !res.body) {
        setError(await res.text());
        return;
      }
      // 글자가 오는 대로 바로바로 화면에 보여줘요 (스트리밍)
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setRaw((s) => s + decoder.decode(value, { stream: true }));
      }
    } catch {
      setError("인터넷 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  // 지금 페이지부터 읽고, 다 읽으면 다음 장으로 넘어가며 계속 읽어요
  async function speakFrom(i: number) {
    const { pages, loading } = latest.current;
    const audio = audioRef.current;
    if (!audio || !speakingRef.current) return stopSpeaking();
    if (!pages[i]?.complete) {
      // 다음 장을 아직 쓰는 중이면 기다렸다가 이어서 읽어요
      if (loading) setWaitingFor(i);
      else stopSpeaking();
      return;
    }
    setWaitingFor(null);
    turnTo(i);
    setVoiceLoading(true);
    try {
      const url = await fetchVoice(pageSpeech(i));
      if (!speakingRef.current) return;
      setVoiceLoading(false);
      audio.src = url;
      audio.onended = () => speakFrom(i + 1);
      await audio.play();
      // 이 장을 읽는 동안 다음 장 목소리를 미리 받아 둬요
      if (latest.current.pages[i + 1]?.complete) fetchVoice(pageSpeech(i + 1)).catch(() => {});
    } catch {
      if (!speakingRef.current) return;
      stopSpeaking();
      setError("목소리를 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    }
  }

  function toggleSpeak() {
    if (speaking) return stopSpeaking();
    // 휴대폰은 버튼을 누른 순간에만 소리를 켤 수 있어서, 지금 소리 장치를 깨워 둬요
    const audio = (audioRef.current ??= new Audio());
    audio.src = SILENCE;
    audio.play().catch(() => {});
    setError("");
    speakingRef.current = true;
    setSpeaking(true);
    speakFrom(pageIndex);
  }

  // 책장을 넘겨요: 넘어가는 장이 종이처럼 뒤집히는 애니메이션과 함께
  function turnTo(i: number) {
    const from = latest.current.pageIndex;
    if (i === from) return;
    setFlip({ from, dir: i > from ? "next" : "prev", key: Date.now() });
    setPageIndex(i);
  }

  function goTo(i: number) {
    if (speaking) stopSpeaking();
    turnTo(i);
  }

  // 손가락으로 옆으로 밀어도 책장이 넘어가요
  const touchX = useRef<number | null>(null);
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (dx < -50 && nextReady) goTo(pageIndex + 1);
    else if (dx > 50 && pageIndex > 0) goTo(pageIndex - 1);
  }

  function renderPage(i: number) {
    const p = pages[i];
    const im = images[i];
    const isEnd = !loading && i === pages.length - 1 && p?.complete;
    return (
      <div className="paper">
        <div className="picture">
          {im?.status === "done" && im.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={im.src} alt={p?.scene ?? ""} />
          ) : im?.status === "error" ? (
            <span className="picture-msg">그림을 불러오지 못했어요</span>
          ) : (
            <span className="picture-msg twinkle">그림을 그리고 있어요…</span>
          )}
        </div>
        {p?.text ? (
          // 큰 장식 첫 글자는 따옴표 같은 기호로 시작하는 장에는 넣지 않아요
          /^["'“‘(\[]/.test(p.text) ? (
            <p className="page-text">{p.text}</p>
          ) : (
            <p className="page-text">
              <span className="dropcap">{p.text[0]}</span>
              {p.text.slice(1)}
            </p>
          )
        ) : (
          <p className="page-text twinkle">이야기를 쓰고 있어요…</p>
        )}
        {isEnd ? <p className="the-end">{"❦\uFE0E 끝 ❦\uFE0E"}</p> : <p className="folio">· {i + 1} ·</p>}
      </div>
    );
  }

  const started = raw.length > 0;
  const nextReady = Boolean(pages[pageIndex + 1]?.complete);
  const writingNext = loading && !nextReady;
  const totalPages = loading ? Math.max(EXPECTED_PAGES, pages.length) : pages.length;

  return (
    <main>
      {/* 옛날 동화집의 표제지(첫 장)처럼 */}
      <section className="sheet title-page">
        <p className="kicker">— 오늘 밤, 우리 아이를 위한 —</p>
        <h1>잠자리 동화집</h1>
        <p className="ornament" aria-hidden>{"❦\uFE0E"}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="frontis" src="/images/frontis.webp" alt="" width={1536} height={1024} />
        <p className="subtitle">아이의 이름과 좋아하는 것을 적어 주시면<br />세상에 하나뿐인 그림 동화를 지어 드려요.</p>

      <form className="bookplate" onSubmit={makeStory}>
        <p className="bookplate-head">이 책의 주인공</p>
        <div className="field">
          <label htmlFor="name">아이 이름</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="예: 하윤" required />
        </div>
        <div className="field">
          <label htmlFor="age">나이</label>
          <div className="age-input">
            <input
              id="age"
              type="number"
              inputMode="numeric"
              min={1}
              max={12}
              value={age}
              onChange={(e) => setAge(e.target.value.slice(0, 2))}
              placeholder="5"
              required
            />
            <span>살</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="likes">좋아하는 것</label>
          <input id="likes" value={likes} onChange={(e) => setLikes(e.target.value)} maxLength={100} placeholder="예: 공룡, 딸기, 비행기" required />
        </div>
        <div className="field">
          <label htmlFor="today">오늘 있었던 일 <span className="optional">(안 써도 돼요)</span></label>
          <input id="today" value={today} onChange={(e) => setToday(e.target.value)} maxLength={100} placeholder="예: 처음으로 자전거를 탔어요" />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "이야기를 짓고 있어요…" : "이야기 시작하기"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
      </section>

      {started && (
        <section className="book-area" ref={bookRef}>
          {/* 하드커버 동화책: 파란 천 표지 위에 크림색 종이가 펼쳐져 있어요 */}
          <article className="book">
            <h2 className="book-title">{title || "제목을 짓고 있어요…"}</h2>

            <div
              className="pages"
              onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
              onTouchEnd={onTouchEnd}
            >
              {pages.length === 0 ? (
                <div className="paper opening">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/candle.webp" alt="" width={200} height={200} />
                  <p className="twinkle">옛날 옛적에…</p>
                </div>
              ) : (
                <>
                  {/* 진짜 책처럼: 앞으로 갈 땐 지금 장이 왼쪽으로 넘어가며 다음 장이 드러나고,
                      뒤로 갈 땐 앞 장이 왼쪽에서 넘어와 덮어요 */}
                  {renderPage(flip?.dir === "prev" ? flip.from : pageIndex)}
                  {flip && (
                    <div key={flip.key} className={`flipping ${flip.dir}`} onAnimationEnd={() => setFlip(null)} aria-hidden>
                      {renderPage(flip.dir === "next" ? flip.from : pageIndex)}
                    </div>
                  )}
                </>
              )}
            </div>
          </article>

          <nav className="pager">
            <button className="btn btn-round" type="button" onClick={() => goTo(pageIndex - 1)} disabled={pageIndex === 0} aria-label="이전 장">◀</button>
            <span className="page-dots" aria-label={pages.length ? `${pageIndex + 1}장 / ${totalPages}장` : undefined}>
              {Array.from({ length: totalPages }, (_, i) => (
                <span key={i} className={`dot ${i === pageIndex ? "on" : ""} ${pages[i]?.complete ? "ready" : ""}`} />
              ))}
            </span>
            <button className="btn btn-round" type="button" onClick={() => goTo(pageIndex + 1)} disabled={!nextReady} aria-label="다음 장">▶</button>
          </nav>

          {/* 지금 장을 보는 동안 뒤에서 다음 장을 쓰고 있어요 */}
          {writingNext && pages.length > 0 && (
            <p className="status twinkle">
              {waitingFor !== null ? "다음 장이 다 써지면 이어서 읽어 줄게요…" : "다음 장을 쓰고 있어요…"}
            </p>
          )}

          {page?.complete && (
            <div className="actions">
              <button className={`btn btn-read ${speaking ? "on" : ""}`} type="button" onClick={toggleSpeak}>
                {voiceLoading ? "목소리 준비 중… (누르면 멈춰요)" : speaking ? "■ 그만 읽기" : "♪ 소리 내어 읽어 주기"}
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
