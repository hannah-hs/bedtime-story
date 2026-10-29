"use client";

import { useEffect, useRef, useState } from "react";

type Page = { scene: string; text: string; sceneDone: boolean };
type ImageState = { status: "loading" | "done" | "error"; src?: string };

// Claude가 보내는 글(제목:/주인공:/===/그림:)을 그림책 페이지로 나눠요
function parseStory(raw: string) {
  const [head, ...chunks] = raw.split(/^===\s*$/m);
  const title = head.match(/^제목:\s*(.*)$/m)?.[1]?.trim() ?? "";
  const heroMatch = head.match(/^주인공:\s*(.*)\n/m);
  const pages: Page[] = chunks.map((chunk) => {
    const m = chunk.match(/^\s*그림:\s*(.*)(\n?)/);
    // "그림:" 줄(또는 아직 덜 온 "그림" 글자)은 본문에서 빼요
    const isSceneLine = (line: string) => {
      const t = line.trim();
      return t.length > 0 && (t.startsWith("그림:") || "그림:".startsWith(t));
    };
    return {
      scene: m?.[1]?.trim() ?? "",
      sceneDone: Boolean(m?.[2]), // 그림 줄 끝에 줄바꿈이 왔으면 그림 설명이 다 온 것
      text: chunk.split("\n").filter((l) => !isSceneLine(l)).join("\n").trim(),
    };
  });
  return { title, hero: heroMatch?.[1]?.trim() ?? "", pages };
}

export default function Home() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("5");
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

  const { title, hero, pages } = parseStory(raw);
  const page = pages[pageIndex];

  // 페이지를 떠나면 읽어주기도 멈춰요
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

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
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  async function makeStory(e: React.FormEvent) {
    e.preventDefault();
    stopSpeaking();
    setRaw("");
    setError("");
    setImages({});
    setPageIndex(0);
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
  function speakFrom(i: number) {
    const synth = window.speechSynthesis;
    if (!synth || !speakingRef.current || i >= pages.length) {
      stopSpeaking();
      return;
    }
    setPageIndex(i);
    const utter = new SpeechSynthesisUtterance(i === 0 ? `${title}. ${pages[i].text}` : pages[i].text);
    utter.lang = "ko-KR";
    utter.rate = 0.85; // 잠자리용으로 천천히
    utter.onend = () => speakFrom(i + 1);
    utter.onerror = () => stopSpeaking();
    synth.speak(utter);
  }

  function toggleSpeak() {
    if (!window.speechSynthesis) {
      setError("이 브라우저는 읽어주기를 지원하지 않아요.");
      return;
    }
    if (speaking) return stopSpeaking();
    speakingRef.current = true;
    setSpeaking(true);
    speakFrom(pageIndex);
  }

  function goTo(i: number) {
    if (speaking) stopSpeaking();
    setPageIndex(i);
  }

  const img = images[pageIndex];
  const started = raw.length > 0;

  return (
    <main>
      <h1>🌙 우리 아이 잠자리 동화</h1>
      <p className="subtitle">이름과 좋아하는 것을 알려주면 그림이 있는 3분 동화책을 만들어 드려요.</p>

      <form className="card" onSubmit={makeStory}>
        <div className="field">
          <label htmlFor="name">아이 이름</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="예: 하윤" required />
        </div>
        <div className="field">
          <label htmlFor="age">나이</label>
          <select id="age" value={age} onChange={(e) => setAge(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}살</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="likes">좋아하는 것</label>
          <input id="likes" value={likes} onChange={(e) => setLikes(e.target.value)} maxLength={100} placeholder="예: 공룡, 딸기, 비행기" required />
        </div>
        <div className="field">
          <label htmlFor="today">오늘 있었던 일 <span className="optional">(선택)</span></label>
          <input id="today" value={today} onChange={(e) => setToday(e.target.value)} maxLength={100} placeholder="예: 처음으로 자전거를 탔어요" />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "동화를 쓰고 있어요…" : "동화 만들기"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      {started && (
        <article className="card book">
          <h2>{title || "제목을 짓고 있어요…"}</h2>

          <div className="picture">
            {img?.status === "done" && img.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.src} alt={page?.scene ?? ""} />
            ) : img?.status === "error" ? (
              <span className="picture-msg">🌙<br />그림을 불러오지 못했어요</span>
            ) : (
              <span className="picture-msg twinkle">✨<br />그림을 그리고 있어요…</span>
            )}
          </div>

          <p className="page-text">{page?.text || "이야기를 쓰고 있어요…"}</p>

          <nav className="pager">
            <button className="btn btn-round" type="button" onClick={() => goTo(pageIndex - 1)} disabled={pageIndex === 0} aria-label="이전 장">◀</button>
            <span className="page-num">{pages.length ? `${pageIndex + 1} / ${loading ? "…" : pages.length}` : ""}</span>
            <button className="btn btn-round" type="button" onClick={() => goTo(pageIndex + 1)} disabled={pageIndex >= pages.length - 1} aria-label="다음 장">▶</button>
          </nav>

          {!loading && pages.length > 0 && (
            <div className="actions">
              <button className="btn btn-secondary" type="button" onClick={toggleSpeak}>
                {speaking ? "⏹ 그만 읽기" : "🔊 읽어주기"}
              </button>
            </div>
          )}
        </article>
      )}
    </main>
  );
}
