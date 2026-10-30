import type { Metadata, Viewport } from "next";
import { Gowun_Dodum, Jua } from "next/font/google";
import "./globals.css";

// 동글동글한 제목 글씨(주아) + 또박또박 읽기 좋은 본문 글씨(고운돋움)
const jua = Jua({ weight: "400", preload: false, variable: "--font-title" });
const gowun = Gowun_Dodum({ weight: "400", preload: false, variable: "--font-body" });

export const metadata: Metadata = {
  title: "우리 아이 잠자리 동화",
  description: "아이 이름·나이·좋아하는 것으로 3분짜리 그림 동화책을 만들어요.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1d1b4f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${jua.variable} ${gowun.variable}`}>
      <body>{children}</body>
    </html>
  );
}
