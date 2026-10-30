"use client";

import { useEffect, useRef, useState } from "react";
import { AuthBar } from "@/components/AuthBar";
import { Library } from "@/components/Library";
import { createStory, getStory, newStoryId } from "@/lib/db";
import { downloadFile, downloadText, toBlob } from "@/lib/files";
import { getFirebase } from "@/lib/firebase";
import { attachFile } from "@/lib/stories";
import { pageKey, type FileKind, type PageFiles, type SavedStory, type StoryInput } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";

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

// 책장에서 다시 연 동화는 이미 다 쓴 상태예요
function fromSaved(s: SavedStory) {
  return { title: s.title, hero: s.hero, pages: s.pages.map((p): Page => ({ ...p, sceneDone: true, complete: true })) };
}

// 파일 이름에 쓸 수 없는 글자를 빼요
const safeName = (t: string) => t.replace(/[\\/:*?"<>|]/g, "").trim() || "동화";

type SaveState = "idle" | "saving" | "saved" | "error";

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
  const audioCache = useRef(new Map<number, Promise<string>>()); // 장 번호 → 목소리 주소
  const [voiceLoading, setVoiceLoading] = useState(false);

  // ── 저장 (Firebase) ──
  const fb = getFirebase(); // 설정이 없으면 null → 저장 없이 예전처럼 동작해요
  const auth = useAuth();
  const uid = auth.user?.uid ?? null;
  const [opened, setOpened] = useState<SavedStory | null>(null); // 책장에서 다시 연 동화
  const [storyId, setStoryId] = useState<string | null>(null); // 지금 보는 동화의 저장 번호
  const [files, setFiles] = useState<{ images: PageFiles; audio: PageFiles }>({ images: {}, audio: {} }); // Storage 에 올라간 파일들
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [libraryKey, setLibraryKey] = useState(0);
  const inputRef = useRef<StoryInput | null>(null); // 이 동화를 만들 때 적은 아이 정보
  const savingRef = useRef(false);
  const uploading = useRef(new Set<string>()); // 올리는 중이거나 다 올린 파일
  const voiceBlobs = useRef(new Map<number, Blob>()); // 아직 안 올린 목소리

  const { title, hero, pages } = opened ? fromSaved(opened) : parseStory(raw, !loading);
  const page = pages[pageIndex];
  // 읽어주기·저장이 끝난 뒤에도 최신 값을 보도록 ref 에도 담아 둬요
  const latest = useRef({ title, pages, loading, pageIndex, images, files, storyId, uid });
  latest.current = { title, pages, loading, pageIndex, images, files, storyId, uid };
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

  // 한 장을 읽은 목소리를 받아요.
  // 저장해 둔 목소리가 있으면 그걸 쓰고(요금 0원), 없으면 새로 만들어서 저장해 둬요.
  function fetchVoice(i: number) {
    let voice = audioCache.current.get(i);
    if (!voice) {
      const saved = latest.current.files.audio[pageKey(i)];
      voice = saved
        ? Promise.resolve(saved.url)
        : fetch("/api/speech", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: pageSpeech(i) }),
          }).then(async (r) => {
            if (!r.ok) throw new Error("speech failed");
            const blob = await r.blob();
            voiceBlobs.current.set(i, blob);
            uploadPending();
            return URL.createObjectURL(blob);
          });
      voice.catch(() => audioCache.current.delete(i)); // 실패하면 다음에 다시 시도
      audioCache.current.set(i, voice);
    }
    return voice;
  }

  // 아직 Storage 에 안 올린 그림·목소리를 올리고, 위치를 Firestore 에 적어요
  function uploadPending() {
    const { storyId, uid, images } = latest.current;
    if (!fb || !storyId || !uid) return;
    const upload = (kind: FileKind, i: number, getBlob: () => Promise<Blob>) => {
      const key = `${storyId}/${kind}/${i}`;
      if (uploading.current.has(key)) return;
      uploading.current.add(key);
      getBlob()
        .then((blob) => attachFile(fb, uid, storyId, kind, i, blob))
        .then((file) => {
          if (latest.current.storyId !== storyId) return;
          setFiles((f) => ({ ...f, [kind]: { ...f[kind], [pageKey(i)]: file } }));
          if (kind === "images" && i === 0) setLibraryKey((k) => k + 1); // 책장 표지 그림
        })
        .catch(() => uploading.current.delete(key)); // 다음에 다시 시도
    };
    Object.entries(images).forEach(([k, im]) => {
      if (im.status === "done" && im.src?.startsWith("data:")) upload("images", Number(k), () => toBlob(im.src!));
    });
    voiceBlobs.current.forEach((blob, i) => upload("audio", i, async () => blob));
  }

  // 그림이 새로 나오거나 동화가 저장되면 파일을 올려요
  useEffect(() => {
    uploadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, uid, images]);

  // 동화를 다 쓰면 Firestore 에 저장해요 (손님도 저장돼요)
  useEffect(() => {
    if (!fb || !uid || opened || loading || storyId || savingRef.current) return;
    if (!title || pages.length === 0 || !inputRef.current) return;
    savingRef.current = true;
    const id = newStoryId(fb.db, uid);
    setSaveState("saving");
    createStory(fb.db, uid, id, {
      title,
      hero,
      input: inputRef.current,
      pages: pages.map(({ text, scene }) => ({ text, scene })),
    })
      .then(() => {
        setStoryId(id);
        setSaveState("saved");
        setLibraryKey((k) => k + 1);
        history.replaceState(null, "", `?s=${id}`); // 주소를 저장해 두면 나중에 바로 이 책이 열려요
      })
      .catch(() => setSaveState("error"));
  }, [fb, uid, opened, loading, storyId, title, hero, pages]);

  // 주소에 ?s=책번호 가 있으면 그 책을 열어요
  const urlChecked = useRef(false);
  useEffect(() => {
    if (!fb || !uid || urlChecked.current) return;
    urlChecked.current = true;
    const id = new URLSearchParams(location.search).get("s");
    if (id) getStory(fb.db, uid, id).then((s) => s && openStory(s)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb, uid]);

  // 다른 사람으로 바뀌면(로그아웃 등) 보던 책을 덮어요
  const prevUid = useRef<string | null>(null);
  useEffect(() => {
    if (prevUid.current && uid !== prevUid.current) closeBook();
    prevUid.current = uid;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // 새 책을 펴기 전에 지금 책의 상태를 다 비워요
  function resetBook() {
    stopSpeaking();
    setError("");
    setImages({});
    audioCache.current.forEach((v) => v.then((u) => u.startsWith("blob:") && URL.revokeObjectURL(u), () => {}));
    audioCache.current = new Map();
    voiceBlobs.current = new Map();
    setPageIndex(0);
    setFlip(null);
    requested.current = new Set();
    setFiles({ images: {}, audio: {} });
    setStoryId(null);
    setSaveState("idle");
    savingRef.current = false;
  }

  function closeBook() {
    resetBook();
    setOpened(null);
    setRaw("");
    history.replaceState(null, "", location.pathname);
  }

  // 책장에서 고른 동화를 다시 펴요 (그림·목소리는 Storage 에서 불러와요)
  function openStory(s: SavedStory) {
    resetBook();
    setRaw("");
    setOpened(s);
    setStoryId(s.id);
    setSaveState("saved");
    const saved = { images: s.images ?? {}, audio: s.audio ?? {} };
    setFiles(saved);
    const shown: Record<number, ImageState> = {};
    Object.entries(saved.images).forEach(([k, f]) => {
      const i = Number(k.slice(1));
      shown[i] = { status: "done", src: f.url };
      requested.current.add(i); // 이미 있는 그림은 다시 안 그려요 (없는 그림만 새로 그려요)
    });
    setImages(shown);
    history.replaceState(null, "", `?s=${s.id}`);
    requestAnimationFrame(() => bookRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  // 내려받기
  function downloadPicture() {
    const src = images[pageIndex]?.src;
    if (src) downloadFile(src, `${safeName(title)}-${pageIndex + 1}.jpg`);
  }
  function downloadVoice() {
    const f = files.audio[pageKey(pageIndex)];
    if (f) downloadFile(f.url, `${safeName(title)}-${pageIndex + 1}.mp3`);
  }
  function downloadStoryText() {
    const body = pages.map((p, i) => `[${i + 1}]\n${p.text}`).join("\n\n");
    downloadText(`${title}\n\n${body}\n`, `${safeName(title)}.txt`);
  }

  function pageSpeech(i: number) {
    const { title, pages } = latest.current;
    return i === 0 ? `${title}. ${pages[i].text}` : pages[i].text;
  }

  async function makeStory(e: React.FormEvent) {
    e.preventDefault();
    closeBook();
    inputRef.current = { name: name.trim(), age: Number(age), likes: likes.trim(), today: today.trim() };
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
      const url = await fetchVoice(i);
      if (!speakingRef.current) return;
      setVoiceLoading(false);
      audio.src = url;
      audio.onended = () => speakFrom(i + 1);
      await audio.play();
      // 이 장을 읽는 동안 다음 장 목소리를 미리 받아 둬요
      if (latest.current.pages[i + 1]?.complete) fetchVoice(i + 1).catch(() => {});
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
        {isEnd ? <p className="the-end">{"✦ 끝 ✦"}</p> : <p className="folio">· {i + 1} ·</p>}
      </div>
    );
  }

  const started = raw.length > 0 || opened !== null;
  const guest = !auth.user || auth.user.isAnonymous;
  const nextReady = Boolean(pages[pageIndex + 1]?.complete);
  const writingNext = loading && !nextReady;
  const totalPages = loading ? Math.max(EXPECTED_PAGES, pages.length) : pages.length;

  return (
    <main>
      {/* 옛날 동화집의 표제지(첫 장)처럼 */}
      <section className="sheet title-page">
        <AuthBar auth={auth} />
        <p className="kicker">— 오늘 밤, 우리 아이를 위한 —</p>
        <h1>잠자리 동화집</h1>
        <p className="ornament" aria-hidden>{"✦ ✦ ✦"}</p>
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

          {/* 내려받기: 이 장의 그림 · 목소리, 동화 전체 글 */}
          {page?.complete && (
            <div className="downloads">
              {images[pageIndex]?.status === "done" && (
                <button type="button" className="link-btn" onClick={downloadPicture}>그림 내려받기</button>
              )}
              {files.audio[pageKey(pageIndex)] && (
                <button type="button" className="link-btn" onClick={downloadVoice}>목소리 내려받기</button>
              )}
              {!loading && (
                <button type="button" className="link-btn" onClick={downloadStoryText}>글 내려받기</button>
              )}
            </div>
          )}

          {/* 저장 상태 */}
          {saveState !== "idle" && (
            <p className="save-note">
              {saveState === "saving"
                ? "책장에 꽂는 중…"
                : saveState === "error"
                  ? "책장에 저장하지 못했어요."
                  : guest
                    ? "✓ 책장에 꽂아 두었어요 · 로그인하면 다른 기기에서도 볼 수 있어요"
                    : "✓ 나의 동화 책장에 꽂아 두었어요"}
            </p>
          )}
        </section>
      )}

      {/* 나의 동화 책장 (Firebase 연결 후) */}
      {fb && uid && (
        <Library
          fb={fb}
          uid={uid}
          refreshKey={libraryKey}
          activeId={storyId}
          disabled={loading}
          onOpen={openStory}
          onDeleted={(id) => id === storyId && closeBook()}
        />
      )}
    </main>
  );
}
