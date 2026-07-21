"use client";

import { useRef, useState } from "react";
import { Check, FileUp, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Experience = { title: string; company: string; dates: string; bullets: string[] };
type Education = { institution: string; qualification: string; dates: string };
type Project = { name: string; description: string; bullets: string[] };
type Structured = { summary: string; skills: string[]; experience: Experience[]; education: Education[]; certifications: string[]; keywords: string[]; projects: Project[] };
type CV = { id: string; label: string; target_role?: string | null; is_default: boolean; source: "manual" | "upload" | "linkedin"; raw_text?: string | null; structured?: Partial<Structured> | null };
type Draft = { id: string; label: string; target_role: string; is_default: boolean; source: CV["source"]; raw_text: string; structured: Structured };

const list = (value: string) => value.split(",").map((part) => part.trim()).filter(Boolean);
const bulletList = (value: string) => value.split("\n").map((part) => part.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
const emptyStructured = (): Structured => ({ summary: "", skills: [], experience: [], education: [], certifications: [], keywords: [], projects: [] });
function structuredOf(value?: Partial<Structured> | null): Structured {
  return { ...emptyStructured(), ...value, skills: value?.skills || [], experience: value?.experience || [], education: value?.education || [], certifications: value?.certifications || [], keywords: value?.keywords || [], projects: value?.projects || [] };
}
function draftOf(cv: CV): Draft {
  return { id: cv.id, label: cv.label, target_role: cv.target_role || "", is_default: cv.is_default, source: cv.source, raw_text: cv.raw_text || "", structured: structuredOf(cv.structured) };
}

export function CvManager({ initial }: { initial: CV[] }) {
  const [cvs, setCvs] = useState(initial);
  const [selectedId, setSelectedId] = useState(initial[0]?.id || "");
  const [draft, setDraft] = useState<Draft | null>(initial[0] ? draftOf(initial[0]) : null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const selected = cvs.find((cv) => cv.id === selectedId) || null;

  const replace = (cv: CV) => {
    setCvs((all) => {
      const next = all.some((item) => item.id === cv.id) ? all.map((item) => item.id === cv.id ? cv : item) : [cv, ...all];
      return cv.is_default ? next.map((item) => ({ ...item, is_default: item.id === cv.id })) : next;
    });
    setSelectedId(cv.id);
    setDraft(draftOf(cv));
    setDirty(false);
  };

  const choose = (cv: CV) => {
    if (cv.id === selectedId) return;
    if (dirty) return toast.error("Save or discard your changes before switching CV profiles.");
    setSelectedId(cv.id);
    setDraft(draftOf(cv));
  };

  const change = (next: Draft) => { setDraft(next); setDirty(true); };
  const changeStructured = (partial: Partial<Structured>) => draft && change({ ...draft, structured: { ...draft.structured, ...partial } });

  async function save(override: Partial<Draft> = {}) {
    if (!draft) return;
    setBusy(true);
    const response = await fetch("/api/cv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, ...override }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return toast.error(json.error);
    replace(json.cv as CV);
    toast.success("Verified CV profile saved.");
  }

  async function reparse() {
    if (!draft?.raw_text.trim()) return toast.error("Add source CV evidence before re-extracting facts.");
    setBusy(true);
    const response = await fetch("/api/cv/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cvId: draft.id, rawText: draft.raw_text }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return toast.error(json.error);
    replace(json.cv as CV);
    toast.success("Facts re-extracted. Review every item before using it in an application.");
  }

  async function upload() {
    const picked = file.current?.files?.[0];
    if (!picked) return toast.error("Choose a CV file first.");
    if (!uploadLabel.trim()) return toast.error("Give this CV profile a clear name.");
    const data = new FormData();
    data.set("file", picked);
    data.set("label", uploadLabel.trim());
    setBusy(true);
    const response = await fetch("/api/cv/upload", { method: "POST", body: data });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return toast.error(json.error);
    replace(json.cv as CV);
    setUploadLabel("");
    if (file.current) file.current.value = "";
    toast.success("CV parsed. Verify the evidence ledger before generating application material.");
  }

  function updateExperience(index: number, partial: Partial<Experience>) {
    if (!draft) return;
    const experience = draft.structured.experience.map((role, current) => current === index ? { ...role, ...partial } : role);
    changeStructured({ experience });
  }
  function updateEducation(index: number, partial: Partial<Education>) {
    if (!draft) return;
    changeStructured({ education: draft.structured.education.map((item, current) => current === index ? { ...item, ...partial } : item) });
  }
  function updateProject(index: number, partial: Partial<Project>) {
    if (!draft) return;
    changeStructured({ projects: draft.structured.projects.map((item, current) => current === index ? { ...item, ...partial } : item) });
  }

  return <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
    <aside className="space-y-3">
      <Card><CardContent className="p-4">
        <Label htmlFor="upload-label">New CV profile name</Label>
        <Input id="upload-label" value={uploadLabel} onChange={(event) => setUploadLabel(event.target.value)} className="mt-2" placeholder="e.g. AI Product Manager" />
        <input ref={file} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="mt-3 block w-full text-xs" />
        <Button className="mt-3 w-full" onClick={() => void upload()} disabled={busy}><FileUp className="size-4" />Upload & parse</Button>
        <p className="mt-2 text-xs text-slate-500">PDF, DOCX or TXT · max 5 MB</p>
      </CardContent></Card>
      {cvs.map((cv) => <button key={cv.id} className={`w-full rounded-xl border p-4 text-left ${selectedId === cv.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "bg-white dark:bg-slate-900"}`} onClick={() => choose(cv)}>
        <div className="flex items-center justify-between gap-2"><span className="font-medium">{cv.label}</span>{cv.is_default && <Badge>Default</Badge>}</div>
        <p className="mt-1 text-sm text-slate-500">{cv.target_role || "Career profile"}</p>
      </button>)}
    </aside>

    <div>
      {draft && selected ? <Card>
        <CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>Verify {draft.label}</CardTitle><p className="mt-1 text-sm text-slate-500">Every generated claim must trace back to this reviewed evidence ledger.</p></div><div className="flex flex-wrap gap-2">{dirty && <Button variant="ghost" size="sm" onClick={() => { setDraft(draftOf(selected)); setDirty(false); }}>Discard changes</Button>}{!draft.is_default && <Button variant="outline" size="sm" onClick={() => void save({ is_default: true })} disabled={busy}><Check className="size-4" />Set default</Button>}</div></CardHeader>
        <CardContent className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="label">Profile name</Label><Input id="label" value={draft.label} onChange={(event) => change({ ...draft, label: event.target.value })} required /></div><div><Label htmlFor="target-role">Target role</Label><Input id="target-role" value={draft.target_role} onChange={(event) => change({ ...draft, target_role: event.target.value })} placeholder="e.g. AI Product Manager" /></div></section>
          <section><Label htmlFor="summary">Professional summary</Label><Textarea id="summary" value={draft.structured.summary} onChange={(event) => changeStructured({ summary: event.target.value })} placeholder="Only claims you can substantiate." /></section>
          <section className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="skills">Skills (comma separated)</Label><Input id="skills" value={draft.structured.skills.join(", ")} onChange={(event) => changeStructured({ skills: list(event.target.value) })} /></div><div><Label htmlFor="keywords">Keywords (comma separated)</Label><Input id="keywords" value={draft.structured.keywords.join(", ")} onChange={(event) => changeStructured({ keywords: list(event.target.value) })} /></div></section>

          <EvidenceSection title="Experience & outcomes" description="Edit the exact roles and bullets the application kit may quote.">
            {draft.structured.experience.map((role, index) => <div className="rounded-xl border p-4" key={`${role.company}-${index}`}><div className="grid gap-3 sm:grid-cols-3"><Input aria-label={`Role title ${index + 1}`} value={role.title} onChange={(event) => updateExperience(index, { title: event.target.value })} placeholder="Role title" /><Input aria-label={`Company ${index + 1}`} value={role.company} onChange={(event) => updateExperience(index, { company: event.target.value })} placeholder="Company" /><Input aria-label={`Dates ${index + 1}`} value={role.dates} onChange={(event) => updateExperience(index, { dates: event.target.value })} placeholder="Dates" /></div><Textarea aria-label={`Evidence bullets ${index + 1}`} className="mt-3" value={role.bullets.join("\n")} onChange={(event) => updateExperience(index, { bullets: bulletList(event.target.value) })} placeholder="One verified bullet per line" /><Button variant="ghost" size="sm" className="mt-2 text-red-700" onClick={() => changeStructured({ experience: draft.structured.experience.filter((_, current) => current !== index) })}><Trash2 className="size-4" />Remove role</Button></div>)}
            <Button variant="outline" size="sm" onClick={() => changeStructured({ experience: [...draft.structured.experience, { title: "", company: "", dates: "", bullets: [] }] })}><Plus className="size-4" />Add role</Button>
          </EvidenceSection>

          <EvidenceSection title="Projects, venture work & leadership" description="Keep portfolio projects, funds, clubs and side work available to the tailoring engine.">
            {draft.structured.projects.map((project, index) => <div className="rounded-xl border p-4" key={`${project.name}-${index}`}><div className="grid gap-3 sm:grid-cols-2"><Input aria-label={`Project name ${index + 1}`} value={project.name} onChange={(event) => updateProject(index, { name: event.target.value })} placeholder="Project or leadership activity" /><Input aria-label={`Project description ${index + 1}`} value={project.description} onChange={(event) => updateProject(index, { description: event.target.value })} placeholder="What it was (factually)" /></div><Textarea aria-label={`Project bullets ${index + 1}`} className="mt-3" value={project.bullets.join("\n")} onChange={(event) => updateProject(index, { bullets: bulletList(event.target.value) })} placeholder="One verified project bullet per line" /><Button variant="ghost" size="sm" className="mt-2 text-red-700" onClick={() => changeStructured({ projects: draft.structured.projects.filter((_, current) => current !== index) })}><Trash2 className="size-4" />Remove project</Button></div>)}
            <Button variant="outline" size="sm" onClick={() => changeStructured({ projects: [...draft.structured.projects, { name: "", description: "", bullets: [] }] })}><Plus className="size-4" />Add project</Button>
          </EvidenceSection>

          <EvidenceSection title="Education & credentials" description="Include only items you are happy for the app to quote.">
            {draft.structured.education.map((item, index) => <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1.2fr_1.2fr_1fr_auto]" key={`${item.institution}-${index}`}><Input aria-label={`Institution ${index + 1}`} value={item.institution} onChange={(event) => updateEducation(index, { institution: event.target.value })} placeholder="Institution" /><Input aria-label={`Qualification ${index + 1}`} value={item.qualification} onChange={(event) => updateEducation(index, { qualification: event.target.value })} placeholder="Qualification" /><Input aria-label={`Education dates ${index + 1}`} value={item.dates} onChange={(event) => updateEducation(index, { dates: event.target.value })} placeholder="Dates" /><Button variant="ghost" size="icon" aria-label={`Remove education ${index + 1}`} onClick={() => changeStructured({ education: draft.structured.education.filter((_, current) => current !== index) })}><Trash2 className="size-4" /></Button></div>)}
            <Button variant="outline" size="sm" onClick={() => changeStructured({ education: [...draft.structured.education, { institution: "", qualification: "", dates: "" }] })}><Plus className="size-4" />Add education</Button>
            <div className="mt-3"><Label htmlFor="certifications">Certifications (comma separated)</Label><Input id="certifications" value={draft.structured.certifications.join(", ")} onChange={(event) => changeStructured({ certifications: list(event.target.value) })} /></div>
          </EvidenceSection>

          <section><Label htmlFor="raw-text">Source CV text / evidence</Label><Textarea id="raw-text" className="mt-2 min-h-52" value={draft.raw_text} onChange={(event) => change({ ...draft, raw_text: event.target.value })} /><p className="mt-1 text-xs text-slate-500">If you change this source text, choose Re-extract facts before generating new material. Saved edits are included in the kit cache.</p><Button className="mt-3" variant="outline" onClick={() => void reparse()} disabled={busy}><Sparkles className="size-4" />Re-extract facts from source</Button></section>
          <Button className="w-fit" disabled={busy || !draft.label.trim()} onClick={() => void save()}><Save className="size-4" />Save verified profile</Button>
        </CardContent>
      </Card> : <Card><CardContent className="py-16 text-center"><Sparkles className="mx-auto size-8 text-indigo-600" /><h2 className="mt-4 font-semibold">Create your first career profile</h2><p className="mt-2 text-sm text-slate-500">Upload a CV to create a structured, editable evidence base.</p></CardContent></Card>}
      <Card className="mt-6"><CardHeader><CardTitle>Start a manual profile</CardTitle></CardHeader><CardContent><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void saveManual(String(form.get("new_label")), String(form.get("new_target_role")), String(form.get("new_raw_text"))); }} className="grid gap-3"><Input name="new_label" aria-label="Profile name" placeholder="Profile name" required /><Input name="new_target_role" aria-label="Target role" placeholder="Target role" /><Textarea name="new_raw_text" aria-label="Experience evidence" placeholder="Paste only verified experience and achievements." required /><Button className="w-fit" variant="outline"><Plus className="size-4" />Create manual profile</Button></form></CardContent></Card>
    </div>
  </div>;

  async function saveManual(label: string, target_role: string, raw_text: string) {
    setBusy(true);
    const response = await fetch("/api/cv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, target_role, raw_text, source: "manual" }) });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) return toast.error(json.error);
    replace(json.cv as CV);
    toast.success("Manual profile created. Add structured evidence before generating application material.");
  }
}

function EvidenceSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section><div className="mb-3"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div><div className="space-y-3">{children}</div></section>;
}
