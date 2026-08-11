import type { Metadata } from "next";
import localFont from "next/font/local";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "블루브릿지글로벌 인사관리",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body
        className={`${pretendard.variable} min-h-screen antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
