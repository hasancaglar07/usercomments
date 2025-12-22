import "../../styles/globals.css";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { AuthProvider } from "../../components/auth/AuthProvider";

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <Header />
      {children}
      <Footer />
    </AuthProvider>
  );
}
