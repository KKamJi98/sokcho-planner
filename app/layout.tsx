import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🧳 속초 당일치기",
  description: "우리 둘의 속초 계획과 맛집 비교 노트",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
