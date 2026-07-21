import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = { title: "Applied — Job Application Command Centre", description: "Build exceptional applications with clarity and confidence." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" suppressHydrationWarning><body>{children}<Toaster richColors position="top-right" /></body></html>; }
