"use client";

// 데이터(db.ts)와 파일(files.ts)을 함께 다뤄야 하는 일만 여기서 해요.
import type { FirebaseServices } from "./firebase";
import { deleteStoryDoc, recordFile } from "./db";
import { removeFile, uploadFile } from "./files";
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
  const files = [...Object.values(story.images ?? {}), ...Object.values(story.audio ?? {})];
  await Promise.all(files.map((f) => removeFile(fb.storage, f.path)));
  await deleteStoryDoc(fb.db, uid, story.id);
}
