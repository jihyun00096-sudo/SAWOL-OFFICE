import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SAWOL OFFICE",
    template: "%s | SAWOL OFFICE",
  },
  description: "내가 하고 싶은 일을 전문 AI 직원들과 함께 만들고 실현시키는 개인 AI 회사",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body
        className="min-h-screen bg-[#F6F7F9] text-[#17181C] antialiased"
        style={{
          fontFamily:
            '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
