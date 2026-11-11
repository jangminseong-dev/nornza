import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "노른자 | 편의점 입지 분석",
  description: "가능성을 발견하는 첫걸음. 노른자에서 편의점 입지를 분석하세요.",
  icons: { icon: "/assets/brand-symbol.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
