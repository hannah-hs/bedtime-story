"use client";

// Firestore: 글자·숫자·날짜 같은 "데이터"를 저장하고 읽어요. (파일은 lib/files.ts)
import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { IMAGE_MODEL, SPEECH_MODEL, STORY_MODEL, VOICE } from "./models";
import { pageKey, type FileKind, type SavedStory, type StoredFile, type StoryDoc, type StoryInput, type StoryPage } from "./types";

const storiesOf = (db: Firestore, uid: string) => collection(db, "users", uid, "stories");
const storyRef = (db: Firestore, uid: string, storyId: string) => doc(db, "users", uid, "stories", storyId);

/** 로그인할 때마다 사용자 정보를 적어 둬요 (처음이면 만든 날짜도) */
export async function saveProfile(db: Firestore, user: User) {
  const ref = doc(db, "users", user.uid);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      isAnonymous: user.isAnonymous,
      lastLoginAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

/** 새 동화의 번호를 미리 받아요 (아직 저장 전) */
export const newStoryId = (db: Firestore, uid: string) => doc(storiesOf(db, uid)).id;

/** 다 쓴 동화를 저장해요. 그림·목소리 파일은 나중에 하나씩 붙어요 */
export async function createStory(
  db: Firestore,
  uid: string,
  storyId: string,
  story: { title: string; hero: string; input: StoryInput; pages: StoryPage[] },
) {
  await setDoc(storyRef(db, uid, storyId), {
    ...story,
    images: {},
    audio: {},
    models: { story: STORY_MODEL, image: IMAGE_MODEL, voice: `${SPEECH_MODEL}:${VOICE}` },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Storage 에 올린 파일의 위치를 동화 문서에 적어요 */
export async function recordFile(db: Firestore, uid: string, storyId: string, kind: FileKind, index: number, file: StoredFile) {
  await updateDoc(storyRef(db, uid, storyId), {
    [`${kind}.${pageKey(index)}`]: file,
    updatedAt: serverTimestamp(),
  });
}

/** 내 책장: 최근에 만든 동화부터 */
export async function listStories(db: Firestore, uid: string, max = 30): Promise<SavedStory[]> {
  const snap = await getDocs(query(storiesOf(db, uid), orderBy("createdAt", "desc"), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoryDoc) }));
}

export async function getStory(db: Firestore, uid: string, storyId: string): Promise<SavedStory | null> {
  const snap = await getDoc(storyRef(db, uid, storyId));
  return snap.exists() ? { id: snap.id, ...(snap.data() as StoryDoc) } : null;
}

/** 동화 문서를 지워요 (파일은 lib/stories.ts 의 deleteStory 가 먼저 지워요) */
export async function deleteStoryDoc(db: Firestore, uid: string, storyId: string) {
  await deleteDoc(storyRef(db, uid, storyId));
}
