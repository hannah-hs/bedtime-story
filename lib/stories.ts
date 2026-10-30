"use client";

// 데이터(db.ts)와 파일(files.ts)을 함께 다뤄야 하는 일만 여기서 해요.
import type { FirebaseServices } from "./firebase";
import { deleteStoryDoc, getStory, recordFile } from "./db";
import { filePath, removeFile, uploadFile } from "./files";
import type { FileKind, SavedStory, StoredFile } from "./types";

/** 파일을 Storage 에 올리고 → 그 위치를 Firestore 문서에 적어요 */
export async function attachFile(
  fb: FirebaseServices,
  uid: string,
  storyId: string,
  kind: FileKind,
  index: number,
  blob: Blob,
): Promise<StoredFile> {
  const file = await uploadFile(fb.storage, uid, storyId, kind, index, blob);
  await recordFile(fb.db, uid, storyId, kind, index, file);
  return file;
}

/** 동화를 지워요: 파일 먼저(Storage) → 문서(Firestore) */
export async function deleteStory(fb: FirebaseServices, uid: string, story: SavedStory) {
  // 책장을 연 뒤에 새로 올라간 파일(예: 방금 들은 목소리)도 지우도록, 지우기 직전에 최신 문서를 다시 읽어요
  const latest = (await getStory(fb.db, uid, story.id)) ?? story;
  const paths = new Set<string>();
  for (const s of [story, latest]) {
    Object.values(s.images ?? {}).forEach((f) => paths.add(f.path));
    Object.values(s.audio ?? {}).forEach((f) => paths.add(f.path));
  }
  // 문서에 미처 적히지 못한 파일도 남지 않게, 보통 쓰는 위치도 한 번 더 지워요
  latest.pages.forEach((_, i) => {
    paths.add(filePath(uid, story.id, "images", i, "image/jpeg"));
    paths.add(filePath(uid, story.id, "audio", i, "audio/mpeg"));
  });
  await Promise.all([...paths].map((p) => removeFile(fb.storage, p)));
  await deleteStoryDoc(fb.db, uid, story.id);
}
