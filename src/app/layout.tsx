import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentScope — Find rentals anywhere in the US",
  description:
    "Search any US address, city, or ZIP code and see available rental homes around it on a map.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}