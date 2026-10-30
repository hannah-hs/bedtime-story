import type { Timestamp } from "firebase/firestore";

/*
  저장 구조 한눈에 보기

  ┌ Firestore (데이터: 글자·숫자·날짜) ───────────────────────────────┐
  │ users/{uid}                     → UserProfile                      │
  │ users/{uid}/stories/{storyId}   → StoryDoc (제목·본문·입력값·파일 위치) │
  └────────────────────────────────────────────────────────────────────┘
  ┌ Storage (파일: 내려받을 수 있는 그림·소리) ─────────────────────────┐
  │ users/{uid}/stories/{storyId}/images/page-{n}.jpg  ← 장면 그림     │
  │ users/{uid}/stories/{storyId}/audio/page-{n}.mp3   ← 읽어 주는 목소리 │
  └────────────────────────────────────────────────────────────────────┘
  Firestore 문서에는 파일 자체가 아니라 파일의 위치(StoredFile)만 적어 둬요.
*/

/** 아이 정보 (입력칸에 적은 그대로) */
export type StoryInput = {
  name: string;
  age: number;
  likes: string;
  today: string;
};

/** 동화 한 장의 글 */
export type StoryPage = {
  text: string; // 한국어 본문
  scene: string; // 그림 AI에게 보낸 장면 설명 (영어)
};

/** Storage 에 올린 파일 한 개의 정보 */
export type StoredFile = {
  path: string; // Storage 안의 위치 (지울 때 써요)
  url: string; // 화면에 보여 주거나 내려받을 때 쓰는 주소
  contentType: string; // image/jpeg, audio/mpeg
  size: number; // 바이트
};

export type FileKind = "images" | "audio";

/** 장 번호 → 파일. 키는 "p0", "p1" … (몇 번째 장인지) */
export type PageFiles = Record<string, StoredFile>;

export const pageKey = (index: number) => `p${index}`;

/** users/{uid}/stories/{storyId} 문서 */
export type StoryDoc = {
  title: string;
  hero: string; // 그림마다 주인공이 같은 모습이 되도록 쓰는 영어 묘사
  art?: string; // 이 책 그림의 색감과 빛 (영어). 이 기능 전에 만든 동화에는 없어요
  input: StoryInput;
  pages: StoryPage[];
  images: PageFiles; // 장면 그림 (Storage 위치)
  audio: PageFiles; // 읽어 주는 목소리 (Storage 위치, 한 번 들은 장만 생겨요)
  models: { story: string; image: string; voice: string };
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type SavedStory = StoryDoc & { id: string };

/** users/{uid} 문서 */
export type UserProfile = {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isAnonymous: boolean; // 손님(로그인 전)이면 true
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
};
