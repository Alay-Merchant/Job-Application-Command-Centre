"use client";

import { LogOut, Menu, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";

export function Topbar() {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return <>
    <header className="flex h-16 items-center justify-between border-b bg-white px-4 dark:bg-slate-950 sm:px-6">
      <Button aria-label="Open navigation" variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
        <Menu className="size-5" />
      </Button>
      <div className="hidden text-sm text-slate-500 md:block">Your calmer, sharper job search.</div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut} aria-label="Sign out">
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
        <Button asChild size="sm">
          <Link href="/jobs"><Plus className="size-4" />New application</Link>
        </Button>
      </div>
    </header>
    {open && <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button aria-label="Close navigation" className="absolute inset-0 bg-slate-950/30" onClick={() => setOpen(false)} />
      <div className="relative h-full w-64"><Sidebar mobile /></div>
    </div>}
  </>;
}
