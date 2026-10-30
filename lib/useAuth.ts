"use client";

import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { saveProfile } from "./db";
import { firebaseEnabled, getFirebase } from "./firebase";

export type AuthStatus =
  | "off" // Firebase 설정이 없어요 → 저장 없이 동작
  | "loading"
  | "ready";

export type AuthState = {
  status: AuthStatus;
  user: User | null; // 손님이면 user.isAnonymous === true
  error: string;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

/**
 * 로그인 상태를 관리해요.
 * - 처음 오면 "손님"(익명 로그인)으로 시작해서, 로그인 없이도 이 기기에서 만든 동화가 저장돼요.
 * - Google 로 로그인하면 손님으로 만든 동화가 그 계정으로 그대로 옮겨 가요 (같은 uid 를 이어 써요).
 */
export function useAuth(): AuthState {
  const fb = getFirebase();
  const [user, setUser] = useState<User | null>(null);
  // 서버와 브라우저가 처음에 같은 화면을 그리도록 "설정이 있는지"로만 정해요
  const [status, setStatus] = useState<AuthStatus>(firebaseEnabled ? "loading" : "off");
  const [error, setError] = useState("");
  const [, refresh] = useState(0);

  useEffect(() => {
    if (!fb) return;
    return onAuthStateChanged(fb.auth, (u) => {
      if (!u) {
        // 아무도 로그인 안 했으면 손님으로 들어가요
        signInAnonymously(fb.auth).catch(() => {
          setStatus("ready");
          setError("손님 저장이 꺼져 있어요. Google로 로그인하면 저장돼요.");
        });
        return;
      }
      setUser(u);
      setStatus("ready");
      saveProfile(fb.db, u).catch(() => {});
    });
  }, [fb]);

  const signInWithGoogle = useCallback(async () => {
    if (!fb) return;
    setError("");
    const provider = new GoogleAuthProvider();
    const current = fb.auth.currentUser;
    try {
      if (current?.isAnonymous) {
        // 손님 계정에 Google 을 연결해요 → uid 가 그대로라 손님 때 만든 동화도 그대로예요
        const { user: linked } = await linkWithPopup(current, provider);
        // 같은 사용자 객체가 "손님 → 로그인"으로 바뀌었으니 화면을 다시 그려요
        refresh((n) => n + 1);
        saveProfile(fb.db, linked).catch(() => {});
      } else {
        await signInWithPopup(fb.auth, provider);
      }
    } catch (e) {
      const code = e instanceof FirebaseError ? e.code : "";
      if (code === "auth/credential-already-in-use") {
        // 이미 이 Google 계정으로 쓰던 적이 있어요 → 그 계정으로 들어가요
        // (이번에 손님으로 만든 동화는 손님 계정에 남아요)
        const credential = GoogleAuthProvider.credentialFromError(e as FirebaseError);
        if (credential) await signInWithCredential(fb.auth, credential);
      } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError("로그인하지 못했어요. 잠시 뒤 다시 해 주세요.");
      }
    }
  }, [fb]);

  const signOut = useCallback(async () => {
    if (!fb) return;
    await firebaseSignOut(fb.auth); // → 위의 onAuthStateChanged 가 다시 손님으로 만들어요
  }, [fb]);

  return { status, user, error, signInWithGoogle, signOut };
}
