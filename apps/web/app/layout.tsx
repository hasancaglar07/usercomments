import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UserComments.net | Real User Reviews & Honest Product Comments",
  description: "Read what real people say before you buy. Thousands of user comments and honest experiences on the latest products.",
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
