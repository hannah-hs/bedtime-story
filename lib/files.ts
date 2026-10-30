"use client";

// Storage: 그림(jpg)·목소리(mp3) 같은 "파일"을 올리고, 내려받고, 지워요. (데이터는 lib/db.ts)
import { deleteObject, getDownloadURL, ref, uploadBytes, type FirebaseStorage } from "firebase/storage";
import type { FileKind, StoredFile } from "./types";

const DEFAULT_TYPE: Record<FileKind, string> = { images: "image/jpeg", audio: "audio/mpeg" };
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

// 파일 종류에 맞는 확장자를 붙여요 (그림은 보통 jpg, 목소리는 mp3)
export const filePath = (uid: string, storyId: string, kind: FileKind, index: number, contentType: string) =>
  `users/${uid}/stories/${storyId}/${kind}/page-${index + 1}.${EXT[contentType] ?? (kind === "images" ? "jpg" : "mp3")}`;

/** 파일을 Storage 에 올리고, 문서에 적을 정보를 돌려줘요 */
export async function uploadFile(
  storage: FirebaseStorage,
  uid: string,
  storyId: string,
  kind: FileKind,
  index: number,
  blob: Blob,
): Promise<StoredFile> {
  const contentType = blob.type || DEFAULT_TYPE[kind];
  const path = filePath(uid, storyId, kind, index, contentType);
  const fileRef = ref(storage, path);
  // 한 번 만든 그림·목소리는 바뀌지 않으니 브라우저가 오래 기억해도 돼요
  await uploadBytes(fileRef, blob, { contentType, cacheControl: "public, max-age=31536000" });
  return { path, url: await getDownloadURL(fileRef), contentType, size: blob.size };
}

/** Storage 에서 파일을 지워요 (이미 없으면 그냥 넘어가요) */
export async function removeFile(storage: FirebaseStorage, path: string) {
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    if ((e as { code?: string }).code !== "storage/object-not-found") throw e;
  }
}

/** data:/blob: 주소(아직 안 올린 파일)를 Blob 으로 바꿔요 */
export const toBlob = async (src: string) => (await fetch(src)).blob();

/**
 * 파일을 휴대폰·컴퓨터에 내려받아요.
 * - 아직 안 올린 파일(data:, blob:)은 바로 내려받고
 * - Storage 파일은 우리 서버(/api/download)를 거쳐 "다운로드"로 받아요
 *   (Storage 주소를 그대로 열면 새 탭에서 보이기만 해서요)
 */
export function downloadFile(src: string, filename: string) {
  const local = src.startsWith("data:") || src.startsWith("blob:");
  const a = document.createElement("a");
  a.href = local ? src : `/api/download?url=${encodeURIComponent(src)}&name=${encodeURIComponent(filename)}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** 글자를 .txt 파일로 내려받아요 */
export function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  downloadFile(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
