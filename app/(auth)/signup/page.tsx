"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: String(form.get("name")), email: String(form.get("email")), password: String(form.get("password")) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create your account.");
      window.location.assign("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen place-items-center p-4">
    <section className="w-full max-w-sm rounded-xl border bg-white p-7 shadow-sm dark:bg-slate-900">
      <h1 className="text-2xl font-semibold">Start applying with intent</h1>
      <p className="mt-1 text-sm text-slate-500">Your data stays private to you.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div><Label htmlFor="name">Name</Label><Input id="name" name="name" required autoComplete="name" /></div>
        <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" /></div>
        <Button className="w-full" disabled={loading}>{loading ? "Creating account…" : "Create account"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-medium text-indigo-600">Sign in</Link></p>
    </section>
  </main>;
}
