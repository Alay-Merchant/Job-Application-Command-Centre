"use client";

import { useEffect, useState } from "react";
import { Clipboard, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney, scoreTone } from "@/lib/utils";

type Kit = Record<string, any>;
type Application = {
  id: string;
  stage: string;
  notes?: string;
  next_action?: string;
  next_action_due?: string;
  job: any;
  cv_profile_id?: string;
  cv?: any;
};
type CV = { id: string; label: string };

const Copy = ({ value }: { value: string }) => (
  <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("Copied to clipboard."))}>
    <Clipboard className="size-4" />Copy
  </Button>
);

function EvidenceQuote({ value }: { value?: string }) {
  if (!value) return null;
  const noEvidence = /^no (direct|matching) (cv )?evidence/i.test(value);
  return (
    <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
      <span className="font-semibold">{noEvidence ? "Evidence check: " : "CV evidence: "}</span>{value}
    </p>
  );
}

export function ApplicationDetail({ initialApplication, initialKit, cvs }: { initialApplication: Application; initialKit: Kit | null; cvs: CV[] }) {
  const [application, setApplication] = useState(initialApplication);
  const [kit, setKit] = useState<Kit | null>(initialKit);
  const [busy, setBusy] = useState(false);
  const [kitInvalidated, setKitInvalidated] = useState(false);
  const [answerDialogOpen, setAnswerDialogOpen] = useState(false);
  const [answerQuestion, setAnswerQuestion] = useState("Why this company and role?");

  const generate = async (force = false) => {
    setBusy(true);
    const response = await fetch("/api/kit/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: application.id, force }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return toast.error(json.error);
    setKit(json.kit);
    setKitInvalidated(false);
    toast.success(json.cached ? "Loaded your saved kit." : "Your application kit is ready.");
  };

  const patch = async (body: Record<string, unknown>) => {
    const response = await fetch(`/api/applications/${application.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await response.json();
    if (!response.ok) return toast.error(json.error);
    setApplication({ ...application, ...json.application });
    toast.success("Application updated.");
  };

  const changeCv = async (cvProfileId: string) => {
    if (!cvProfileId || cvProfileId === application.cv_profile_id) return;
    const response = await fetch(`/api/applications/${application.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cv_profile_id: cvProfileId }) });
    const json = await response.json();
    if (!response.ok) return toast.error(json.error);
    setApplication({ ...application, ...json.application });
    setKit(null);
    setKitInvalidated(true);
    toast.success("CV changed. Generate a new kit before using any recommendations.");
  };

  const saveCover = async (coverLetter: string) => {
    const response = await fetch("/api/kit/cover-letter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: application.id, coverLetter }) });
    const json = await response.json();
    if (!response.ok) return toast.error(json.error);
    setKit({ ...(kit || {}), ...json.kit });
    toast.success("Cover letter saved.");
  };

  const generateCover = async () => {
    setBusy(true);
    const response = await fetch("/api/kit/cover-letter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: application.id }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return toast.error(json.error);
    setKit({ ...(kit || {}), ...json.kit });
    toast.success("Cover letter generated.");
  };

  const generateAnswers = async () => {
    const question = answerQuestion.trim();
    if (question.length < 3) return toast.error("Enter a complete application question.");
    setBusy(true);
    const response = await fetch("/api/answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: application.id, questions: [question] }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return toast.error(json.error);
    setKit({ ...(kit || {}), ...json.kit });
    setAnswerDialogOpen(false);
    toast.success("Answer draft added.");
  };

  const salary = async () => {
    setBusy(true);
    const response = await fetch("/api/salary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: application.id }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return toast.error(json.error);
    setKit({ ...(kit || {}), ...json.kit });
  };

  const breakdown = kit?.match_breakdown;

  return <div>
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col justify-between gap-5 md:flex-row">
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold">{application.job?.title}</h1><Badge variant="secondary" className="capitalize">{application.stage.replaceAll("_", " ")}</Badge></div>
            <p className="mt-1 text-sm text-slate-500">{application.job?.company || "Company not listed"} · {application.job?.location || "Location flexible"}</p>
            <p className="mt-3 text-sm font-medium">{formatMoney(application.job?.salary_min, application.job?.currency)} – {formatMoney(application.job?.salary_max, application.job?.currency)}</p>
          </div>
          {typeof kit?.match_score === "number" ? <div className={`min-w-36 rounded-xl p-4 text-center ${scoreTone(kit.match_score)}`}><p className="text-3xl font-semibold">{kit.match_score}%</p><p className="text-xs font-medium">Evidence coverage</p></div> : <div className="rounded-xl border border-dashed p-4 text-center text-sm text-slate-500">Generate a kit to see your fit.</div>}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <select aria-label="CV profile" value={application.cv_profile_id || ""} onChange={(event) => changeCv(event.target.value)} className="h-10 rounded-lg border bg-transparent px-3 text-sm"><option value="">Choose CV profile</option>{cvs.map((cv) => <option value={cv.id} key={cv.id}>{cv.label}</option>)}</select>
          <Button onClick={() => generate()} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{kitInvalidated ? "Generate updated kit" : kit ? "Refresh kit" : "Generate kit"}</Button>
          {kit && <Button variant="outline" onClick={() => generate(true)} disabled={busy}><RefreshCw className="size-4" />Regenerate</Button>}
        </div>
        {kitInvalidated && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">This CV changed. Previous recommendations are hidden so you do not use advice based on the wrong evidence.</p>}
      </CardContent>
    </Card>

    {kit ? <Tabs defaultValue="match" className="mt-6">
      <TabsList className="w-full justify-start"><TabsTrigger value="match">Match</TabsTrigger><TabsTrigger value="gaps">Gaps</TabsTrigger><TabsTrigger value="interview">Interview</TabsTrigger><TabsTrigger value="star">STAR</TabsTrigger><TabsTrigger value="cover">Cover letter</TabsTrigger><TabsTrigger value="ats">ATS</TabsTrigger><TabsTrigger value="answers">Auto-answers</TabsTrigger><TabsTrigger value="salary">Salary</TabsTrigger><TabsTrigger value="notes">Notes</TabsTrigger></TabsList>
      <TabsContent value="match" className="mt-5"><Card><CardHeader><CardTitle>Evidence coverage</CardTitle></CardHeader><CardContent>
        <p className="mb-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{breakdown?.summary}</p>
        <p className="mb-5 text-xs leading-5 text-slate-500">This score indicates how well the role is supported by evidence in your selected CV. It is not a hiring prediction or a claim that you meet every requirement.</p>
        <div className="grid gap-4 sm:grid-cols-2">{["skills", "experience", "seniority", "domain"].map((key) => <div key={key}><div className="mb-2 flex justify-between text-sm"><span className="capitalize">{key}</span><span>{breakdown?.[key] || 0}%</span></div><Progress value={breakdown?.[key] || 0} /></div>)}</div>
        <div className="mt-7"><h2 className="font-semibold">Evidence used</h2><div className="mt-3 space-y-3">{breakdown?.evidence?.map((item: any, index: number) => <div className="rounded-lg border p-4" key={`${item.requirement}-${index}`}><p className="text-sm font-medium">{item.requirement}</p><EvidenceQuote value={item.cv_evidence} /></div>)}</div></div>
        <h2 className="mt-7 font-semibold">Tailored CV suggestions</h2><div className="mt-3 space-y-3">{kit.tailored_cv?.map((item: any, index: number) => <div className="rounded-lg border p-4" key={index}><p className="text-sm text-slate-500 line-through">{item.original}</p><p className="mt-2 text-sm font-medium">{item.suggestion}</p><p className="mt-2 text-xs text-slate-500">{item.reason}</p><EvidenceQuote value={item.cv_evidence} /></div>)}</div>
      </CardContent></Card></TabsContent>
      <TabsContent value="gaps" className="mt-5"><Card><CardHeader><CardTitle>Close the right gaps</CardTitle></CardHeader><CardContent className="space-y-5">
        {breakdown?.critical_gap?.map((gap: any, index: number) => <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30" key={`${gap.skill}-${index}`}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Critical gap before applying: {gap.skill}</h3><Badge variant="destructive">Address first</Badge></div><p className="mt-3 text-sm font-medium">Why it matters</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{gap.why_it_matters}</p><p className="mt-3 text-sm font-medium">Honest next step</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{gap.action}</p><EvidenceQuote value={gap.cv_evidence} /></div>)}
        {!breakdown?.critical_gap?.length && <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">No single application-blocking gap was identified from the job description and your CV evidence. Review the remaining gaps below before applying.</p>}
        {kit.missing_skills?.map((item: any) => <div className="rounded-lg border p-4" key={item.skill}><div className="flex justify-between gap-3"><h3 className="font-medium">{item.skill}</h3><Badge variant={item.importance === "high" ? "destructive" : "secondary"}>{item.importance}</Badge></div><p className="mt-2 text-sm text-slate-500">{item.how_to_address}</p><EvidenceQuote value={item.cv_evidence} /></div>)}
      </CardContent></Card></TabsContent>
      <TabsContent value="interview" className="mt-5"><Card><CardHeader><CardTitle>Likely interview questions</CardTitle></CardHeader><CardContent className="space-y-4">{kit.interview_questions?.map((item: any, index: number) => <div key={index}><div className="flex gap-2"><Badge variant="secondary">{item.type}</Badge><h3 className="font-medium">{item.question}</h3></div><p className="mt-2 text-sm text-slate-500">Why: {item.why}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Strong answer: {item.strong_answer_hint}</p></div>)}</CardContent></Card></TabsContent>
      <TabsContent value="star" className="mt-5"><Card><CardHeader><CardTitle>STAR story prompts</CardTitle></CardHeader><CardContent className="space-y-3">{kit.star_prompts?.map((item: any) => <div className="rounded-lg border p-4" key={item.competency}><p className="font-medium">{item.competency}</p><p className="mt-1 text-sm text-slate-500">{item.prompt}</p></div>)}</CardContent></Card></TabsContent>
      <TabsContent value="cover" className="mt-5"><CoverLetter value={kit.cover_letter || ""} busy={busy} onSave={saveCover} onGenerate={generateCover} /></TabsContent>
      <TabsContent value="ats" className="mt-5"><Card><CardHeader><CardTitle>ATS keyword check · {kit.ats_report?.score || 0}%</CardTitle></CardHeader><CardContent><div className="grid gap-5 sm:grid-cols-2"><div><h3 className="text-sm font-medium">Present</h3><div className="mt-2 flex flex-wrap gap-2">{kit.ats_report?.present?.map((item: string) => <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" key={item}>{item}</Badge>)}</div></div><div><h3 className="text-sm font-medium">Missing</h3><div className="mt-2 flex flex-wrap gap-2">{kit.ats_report?.missing?.map((item: string) => <Badge variant="secondary" key={item}>{item}</Badge>)}</div></div></div></CardContent></Card></TabsContent>
      <TabsContent value="answers" className="mt-5"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Application answers</CardTitle><Button size="sm" onClick={() => setAnswerDialogOpen(true)} disabled={busy}>Draft another</Button></CardHeader><CardContent className="space-y-5">{kit.auto_answers?.length ? kit.auto_answers.map((item: any, index: number) => <div key={index}><p className="font-medium">{item.question}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{item.answer}</p><div className="space-y-1">{item.cv_evidence?.map((quote: string) => <EvidenceQuote key={quote} value={quote} />)}</div><Copy value={item.answer} /></div>) : <p className="text-sm text-slate-500">Ask for a draft to a specific application question.</p>}</CardContent></Card></TabsContent>
      <TabsContent value="salary" className="mt-5"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Salary & negotiation</CardTitle><Button size="sm" onClick={salary} disabled={busy}>Refresh salary insight</Button></CardHeader><CardContent>{kit.salary_insight ? <><p className="text-xl font-semibold">{formatMoney(kit.salary_insight.market_min, kit.salary_insight.currency)} – {formatMoney(kit.salary_insight.market_max, kit.salary_insight.currency)}</p><p className="mt-1 text-xs text-slate-500">Source: {kit.salary_insight.source}. Planning estimate, not a guarantee.</p><ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">{kit.salary_insight.negotiation_points?.map((point: string) => <li key={point}>{point}</li>)}</ul></> : <p className="text-sm text-slate-500">Load current salary context before negotiating.</p>}</CardContent></Card></TabsContent>
      <TabsContent value="notes" className="mt-5"><Notes application={application} patch={patch} /></TabsContent>
    </Tabs> : <Card className="mt-6"><CardContent className="py-14 text-center"><Sparkles className="mx-auto size-8 text-indigo-600" /><h2 className="mt-4 font-semibold">{kitInvalidated ? "A refreshed kit is needed" : "Your focused application kit is one click away"}</h2><p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{kitInvalidated ? "Generate a fresh kit so all evidence, gaps and recommendations match the CV you just selected." : "It brings together match evidence, gaps, interview prep, CV suggestions, ATS keywords and a natural cover letter — based only on your CV and this role."}</p></CardContent></Card>}

    <Dialog open={answerDialogOpen} onOpenChange={setAnswerDialogOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Draft an application answer</DialogTitle><DialogDescription>Enter the exact employer question. The draft will use only evidence in this application’s selected CV.</DialogDescription></DialogHeader>
        <div className="space-y-2"><Label htmlFor="application-question">Application question</Label><Textarea id="application-question" value={answerQuestion} onChange={(event) => setAnswerQuestion(event.target.value)} className="min-h-28" maxLength={500} /></div>
        <DialogFooter><Button variant="outline" onClick={() => setAnswerDialogOpen(false)}>Cancel</Button><Button onClick={generateAnswers} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}Generate draft</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function CoverLetter({ value, busy, onSave, onGenerate }: { value: string; busy: boolean; onSave: (value: string) => void; onGenerate: () => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Cover letter</CardTitle><div className="flex gap-2"><Copy value={text} /><Button variant="outline" size="sm" onClick={onGenerate} disabled={busy}>Regenerate</Button></div></CardHeader><CardContent><Textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-96 leading-6" placeholder="Generate a tailored cover letter." /><Button className="mt-3" onClick={() => onSave(text)}>Save edits</Button></CardContent></Card>;
}

function Notes({ application, patch }: { application: Application; patch: (body: Record<string, unknown>) => void }) {
  const [notes, setNotes] = useState(application.notes || "");
  const [next, setNext] = useState(application.next_action || "");
  const [due, setDue] = useState(application.next_action_due || "");
  return <Card><CardHeader><CardTitle>Next action & notes</CardTitle></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="next">Next action</Label><Input id="next" value={next} onChange={(event) => setNext(event.target.value)} placeholder="e.g. Follow up with recruiter" /></div><div><Label htmlFor="due">Due date</Label><Input id="due" type="date" value={due} onChange={(event) => setDue(event.target.value)} /></div></div><div className="mt-4"><Label htmlFor="notes">Private notes</Label><Textarea id="notes" className="mt-1" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Preparation notes, contacts, thoughts…" /></div><Button className="mt-4" onClick={() => patch({ notes, next_action: next, next_action_due: due || null })}>Save notes</Button></CardContent></Card>;
}
