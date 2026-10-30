"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Firebase 콘솔 → 프로젝트 설정 → 내 앱 에 나오는 값이에요.
// NEXT_PUBLIC_ 이 붙은 값은 화면(브라우저)에서 쓰는 공개 값이라 비밀이 아니에요.
// 누가 무엇을 읽고 쓸 수 있는지는 firestore.rules / storage.rules 가 지켜요.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Firebase 값이 다 들어 있을 때만 저장 기능을 켜요. 없으면 예전처럼 저장 없이 동작해요. */
export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.projectId && config.storageBucket && config.appId);

export type FirebaseServices = { auth: Auth; db: Firestore; storage: FirebaseStorage };

let services: FirebaseServices | null = null;

export function getFirebase(): FirebaseServices | null {
  if (!firebaseEnabled || typeof window === "undefined") return null;
  if (!services) {
    const app = getApps().length ? getApp() : initializeApp(config);
    services = { auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) };
  }
  return services;
}
