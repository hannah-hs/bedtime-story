"use client";

import { useEffect, useState } from "react";
import { listStories } from "@/lib/db";
import type { FirebaseServices } from "@/lib/firebase";
import { deleteStory } from "@/lib/stories";
import { pageKey, type SavedStory } from "@/lib/types";

type Props = {
  fb: FirebaseServices;
  uid: string;
  refreshKey: number; // 바뀌면 책장을 다시 읽어요 (새로 저장했거나 지웠을 때)
  activeId: string | null;
  disabled: boolean; // 동화를 쓰는 중에는 다른 책을 못 열어요
  onOpen: (story: SavedStory) => void;
  onDeleted: (storyId: string) => void;
};

/** 나의 동화 책장: 저장한 동화를 다시 열거나 지워요 */
export function Library({ fb, uid, refreshKey, activeId, disabled, onOpen, onDeleted }: Props) {
  const [stories, setStories] = useState<SavedStory[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listStories(fb.db, uid)
      .then((list) => alive && (setStories(list), setFailed(false)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [fb, uid, refreshKey]);

  async function remove(story: SavedStory) {
    if (!confirm(`"${story.title}"을(를) 지울까요?\n그림과 목소리 파일도 함께 지워져요.`)) return;
    setBusyId(story.id);
    try {
      await deleteStory(fb, uid, story);
      setStories((s) => s?.filter((x) => x.id !== story.id) ?? null);
      onDeleted(story.id);
    } catch {
      alert("지우지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="sheet library">
      <p className="bookplate-head">나의 동화 책장</p>
      {failed ? (
        <p className="library-empty">책장을 불러오지 못했어요.</p>
      ) : stories === null ? (
        <p className="library-empty twinkle">책장을 여는 중…</p>
      ) : stories.length === 0 ? (
        <p className="library-empty">아직 꽂힌 동화가 없어요. 첫 동화를 지어 보세요!</p>
      ) : (
        <ul className="shelf">
          {stories.map((s) => {
            const cover = s.images?.[pageKey(0)]?.url;
            const date = s.createdAt?.toDate?.().toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
            return (
              <li key={s.id} className={`shelf-item ${s.id === activeId ? "on" : ""}`}>
                <button type="button" className="shelf-open" onClick={() => onOpen(s)} disabled={disabled || busyId === s.id}>
                  <span className="shelf-cover">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {cover ? <img src={cover} alt="" loading="lazy" /> : <span aria-hidden>✦</span>}
                  </span>
                  <span className="shelf-text">
                    <span className="shelf-title">{s.title}</span>
                    <span className="shelf-meta">
                      {s.input?.name} · {s.pages?.length ?? 0}장{date ? ` · ${date}` : ""}
                    </span>
                  </span>
                </button>
                <button type="button" className="link-btn shelf-delete" onClick={() => remove(s)} disabled={disabled || busyId === s.id}>
                  {busyId === s.id ? "지우는 중…" : "지우기"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
