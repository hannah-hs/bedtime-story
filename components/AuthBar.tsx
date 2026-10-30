"use client";

import type { AuthState } from "@/lib/useAuth";

/** 표제지 맨 위의 작은 로그인 줄 */
export function AuthBar({ auth }: { auth: AuthState }) {
  if (auth.status === "off") return null; // Firebase 연결 전에는 안 보여요

  const user = auth.user;
  const guest = !user || user.isAnonymous;

  return (
    <div className="auth-bar">
      {auth.status === "loading" ? (
        <span className="auth-note">책장을 여는 중…</span>
      ) : guest ? (
        <>
          <span className="auth-note">손님 · 이 기기에서만 다시 볼 수 있어요</span>
          <button type="button" className="link-btn" onClick={auth.signInWithGoogle}>
            Google로 로그인
          </button>
        </>
      ) : (
        <>
          <span className="auth-note">{user.displayName ?? user.email}님의 책장</span>
          <button type="button" className="link-btn" onClick={auth.signOut}>
            로그아웃
          </button>
        </>
      )}
      {auth.error && <p className="auth-error">{auth.error}</p>}
    </div>
  );
}
