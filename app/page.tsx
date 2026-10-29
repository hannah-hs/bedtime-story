"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("5");
  const [likes, setLikes] = useState("");
  const [today, setToday] = useState("");
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);

  // 페이지를 떠나면 읽어주기도 멈춰요
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  async function makeStory(e: React.FormEvent) {
    e.preventDefault();
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setStory("");
    setError("");
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
        setStory((s) => s + decoder.decode(value, { stream: true }));
      }
    } catch {
      setError("인터넷 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSpeak() {
    const synth = window.speechSynthesis;
    if (!synth) {
      setError("이 브라우저는 읽어주기를 지원하지 않아요.");
      return;
    }
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(story);
    utter.lang = "ko-KR";
    utter.rate = 0.85; // 잠자리용으로 천천히
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    synth.speak(utter);
    setSpeaking(true);
  }

  const [title, ...rest] = story.split("\n");
  const body = rest.join("\n").trim();

  return (
    <main>
      <h1>🌙 우리 아이 잠자리 동화</h1>
      <p className="subtitle">이름과 좋아하는 것을 알려주면 3분짜리 동화를 지어 드려요.</p>

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

      {story && (
        <article className="card story">
          <h2>{title}</h2>
          <p>{body}</p>
          {!loading && (
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
