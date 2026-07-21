"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(form.get("email")), password: String(form.get("password")) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      window.location.assign("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen place-items-center p-4">
    <section className="w-full max-w-sm rounded-xl border bg-white p-7 shadow-sm dark:bg-slate-900">
      <div className="mb-7 flex items-center gap-2 text-xl font-semibold"><span className="grid size-9 place-items-center rounded-lg bg-indigo-600 text-white"><Sparkles className="size-5" /></span>Applied</div>
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-500">Sign in to your private application workspace.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required autoComplete="current-password" /></div>
        <Button className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
      </form>
      {process.env.NODE_ENV === "development" && <Button asChild variant="destructive" className="mt-4 w-full"><Link href="/demo">Temporary demo bypass</Link></Button>}
      <p className="mt-6 text-center text-sm text-slate-500">New here? <Link href="/signup" className="font-medium text-indigo-600">Create an account</Link></p>
    </section>
  </main>;
}
