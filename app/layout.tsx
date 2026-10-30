import type { Metadata, Viewport } from "next";
import { Gowun_Batang, Song_Myung } from "next/font/google";
import "./globals.css";

// 옛날 동화책 느낌: 붓으로 쓴 듯한 제목 글씨(송명) + 책 본문 같은 바탕체(고운바탕)
const songMyung = Song_Myung({ weight: "400", variable: "--font-title" });
const gowunBatang = Gowun_Batang({ weight: ["400", "700"], preload: false, variable: "--font-body" });

export const metadata: Metadata = {
  title: "우리 아이 잠자리 동화",
  description: "아이 이름·나이·좋아하는 것으로 3분짜리 그림 동화책을 만들어요.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#5d64b4" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${songMyung.variable} ${gowunBatang.variable}`}>
      <body>{children}</body>
    </html>
  );
}
