import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "iRecommend Clone",
  description: "iRecommend Clone",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body>{children}</body>
    </html>
  );
}
