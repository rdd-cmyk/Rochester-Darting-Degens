import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/Navbar";

export const metadata: Metadata = {
  title: {
    default: "RDD - Home",
    template: "RDD - %s",
  },
  description: "Rochester Darting Degens stats and match tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top navigation */}
        <Navbar />

        {/* Main page content */}
        <div style={{ flex: 1 }}>
          {children}
        </div>

        {/* Global footer */}
        <footer
          style={{
            padding: "1rem",
            textAlign: "center",
            borderTop: "1px solid #ddd",
            fontFamily: "sans-serif",
            color: "#555",
          }}
        >
          Powered by good vibes, man 😎✌️
        </footer>
      </body>
    </html>
  );
}
