"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Thread = { id: string; title: string; application_id?: string | null };
type Message = { id?: string; role: string; content: string };
type Application = { id: string; job?: { title?: string; company?: string } };

export function CoachChat({ initialThreads, applications }: { initialThreads: Thread[]; applications: Application[] }) {
  const [threads, setThreads] = useState(initialThreads);
  const [thread, setThread] = useState<Thread | null>(initialThreads[0] || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const skipLoadForThread = useRef<string | null>(null);

  useEffect(() => {
    if (!thread) {
      setMessages([]);
      return;
    }
    if (skipLoadForThread.current === thread.id) return;
    let cancelled = false;
    fetch(`/api/coach/thread/${thread.id}`)
      .then((response) => response.ok ? response.json() : { messages: [] })
      .then((json) => { if (!cancelled) setMessages(json.messages || []); });
    return () => { cancelled = true; };
  }, [thread]);

  const create = async (applicationId: string | null, firstMessage?: string) => {
    const response = await fetch("/api/coach/thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId }),
    });
    const json = await response.json();
    if (!response.ok) {
      toast.error(json.error || "Could not create conversation.");
      return null;
    }
    const created = json.thread as Thread;
    setThreads((all) => [created, ...all]);
    setShowSetup(false);
    setSelectedApplicationId(null);
    if (firstMessage) skipLoadForThread.current = created.id;
    setThread(created);
    setMessages([]);
    return created;
  };

  const sendMessage = async (activeThread: Thread, message: string) => {
    setMessages((all) => [...all, { role: "user", content: message }, { role: "assistant", content: "" }]);
    const response = await fetch("/api/coach/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: activeThread.id, message }),
    });
    if (!response.ok || !response.body) {
      setMessages((all) => all.slice(0, -1));
      toast.error((await response.json().catch(() => ({}))).error || "Coach unavailable.");
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      text += decoder.decode(chunk);
      setMessages((all) => [...all.slice(0, -1), { role: "assistant", content: text }]);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = value.trim();
    if (!message || busy) return;
    setValue("");
    setBusy(true);
    try {
      const activeThread = thread || await create(null, message);
      if (activeThread) await sendMessage(activeThread, message);
    } finally {
      skipLoadForThread.current = null;
      setBusy(false);
    }
  };

  const startConfiguredConversation = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await create(selectedApplicationId);
    } finally {
      setBusy(false);
    }
  };

  return <div className="grid min-h-[600px] gap-5 lg:grid-cols-[240px_1fr]">
    <aside className="rounded-xl border bg-white p-3 dark:bg-slate-900">
      <Button className="w-full" size="sm" onClick={() => setShowSetup((visible) => !visible)} disabled={busy}><Sparkles className="size-4" />New conversation</Button>
      {showSetup && <div className="mt-3 rounded-lg border bg-slate-50 p-3 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-medium">What should this coach know?</p><p className="mt-1 text-xs text-slate-500">Choose an application for tailored preparation, or keep it general.</p></div><button type="button" aria-label="Close conversation setup" className="p-1 text-slate-500" onClick={() => setShowSetup(false)}><X className="size-4" /></button></div>
        <div className="mt-3 space-y-1">
          <button type="button" onClick={() => setSelectedApplicationId(null)} className={`w-full rounded-md px-2 py-2 text-left text-sm ${selectedApplicationId === null ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200" : "hover:bg-slate-200 dark:hover:bg-slate-800"}`}>General career coaching</button>
          {applications.map((application) => <button key={application.id} type="button" onClick={() => setSelectedApplicationId(application.id)} className={`w-full rounded-md px-2 py-2 text-left text-sm ${selectedApplicationId === application.id ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200" : "hover:bg-slate-200 dark:hover:bg-slate-800"}`}><span className="block truncate">{application.job?.title || "Untitled role"}</span><span className="block truncate text-xs opacity-70">{application.job?.company || "Application"}</span></button>)}
        </div>
        <Button className="mt-3 w-full" size="sm" onClick={() => void startConfiguredConversation()} disabled={busy}>Start conversation</Button>
      </div>}
      <div className="mt-3 space-y-1">{threads.map((item) => <button key={item.id} onClick={() => { setShowSetup(false); setThread(item); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${thread?.id === item.id ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{item.title}</button>)}</div>
    </aside>
    <Card className="flex min-h-[600px] flex-col"><CardContent className="flex flex-1 flex-col p-5"><div className="flex-1 space-y-5 overflow-y-auto">{messages.length ? messages.map((message, index) => <div key={message.id || index} className={message.role === "user" ? "ml-auto max-w-[85%] rounded-xl bg-indigo-600 px-4 py-3 text-sm leading-6 text-white" : "max-w-[90%] whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200"}>{message.content || <Loader2 className="size-4 animate-spin" />}</div>) : <div className="grid h-full place-items-center text-center"><div><Sparkles className="mx-auto size-8 text-indigo-600" /><h2 className="mt-4 font-semibold">Think with your career coach</h2><p className="mt-2 max-w-sm text-sm text-slate-500">Ask for interview practice, stronger stories, a sharper strategy, or candid feedback on your odds.</p></div></div>}</div><form onSubmit={submit} className="mt-5 flex gap-2 border-t pt-4"><Textarea value={value} onChange={(event) => setValue(event.target.value)} className="min-h-10" placeholder="Ask anything about your search…" /><Button type="submit" disabled={busy || !value.trim()} size="icon" aria-label="Send message"><Send className="size-4" /></Button></form></CardContent></Card>
  </div>;
}
