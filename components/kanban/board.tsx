"use client";

import Link from "next/link";
import { useState } from "react";
import { closestCorners, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { scoreTone, stages, stageLabel, type Stage } from "@/lib/utils";

type App = {
  id: string;
  stage: Stage;
  board_order: number;
  next_action?: string;
  next_action_due?: string;
  job?: { title: string; company?: string };
  kit?: { match_score?: number } | null;
};

function ApplicationCard({ application }: { application: App }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: application.id });

  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="rounded-lg border bg-white p-3 shadow-sm dark:bg-slate-900">
    <div className="flex gap-1">
      <button aria-label="Move application" className="cursor-grab p-1 text-slate-400" {...attributes} {...listeners}><GripVertical className="size-4" /></button>
      <Link href={`/applications/${application.id}`} className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-5">{application.job?.title || "Untitled role"}</p>
        <p className="mt-1 text-xs text-slate-500">{application.job?.company || "Company not listed"}</p>
      </Link>
      {application.kit?.match_score ? <Badge className={scoreTone(application.kit.match_score)}>{application.kit.match_score}</Badge> : null}
    </div>
    {application.next_action && <div className="mt-3 flex items-start gap-1.5 border-t pt-2 text-xs text-slate-500"><CalendarClock className="mt-0.5 size-3 shrink-0" /><span>{application.next_action}{application.next_action_due ? ` · ${application.next_action_due}` : ""}</span></div>}
  </article>;
}

function BoardColumn({ stage, applications }: { stage: Stage; applications: App[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });

  return <section ref={setNodeRef} className={`w-72 shrink-0 rounded-xl p-3 transition-colors ${isOver ? "bg-indigo-100 ring-2 ring-indigo-500/50 dark:bg-indigo-950/50" : "bg-slate-100 dark:bg-slate-900/70"}`}>
    <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{stageLabel(stage)}</h2><span className="text-xs text-slate-500">{applications.length}</span></div>
    <SortableContext id={stage} items={applications.map((item) => item.id)} strategy={verticalListSortingStrategy}>
      <div className="min-h-24 space-y-3" aria-label={`${stageLabel(stage)} applications`}>
        {applications.length ? applications.map((application) => <ApplicationCard key={application.id} application={application} />) : <p className="grid min-h-24 place-items-center rounded-lg border border-dashed border-slate-300 px-3 text-center text-xs text-slate-500 dark:border-slate-700">Drop an application here</p>}
      </div>
    </SortableContext>
  </section>;
}

export function Board({ initial }: { initial: App[] }) {
  const [items, setItems] = useState(initial);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const move = async (event: DragEndEvent) => {
    const id = String(event.active.id);
    const over = event.over;
    const overId = over?.id ? String(over.id) : "";
    if (!overId || !over) return;

    const item = items.find((candidate) => candidate.id === id);
    const overItem = items.find((candidate) => candidate.id === overId);
    const target = (stages.includes(overId as Stage) ? overId : overItem?.stage) as Stage | undefined;
    if (!item || !target) return;

    const before = items;
    const targetItems = before.filter((candidate) => candidate.stage === target && candidate.id !== id).sort((a, b) => a.board_order - b.board_order);
    let insertionIndex = stages.includes(overId as Stage) ? targetItems.length : Math.max(0, targetItems.findIndex((candidate) => candidate.id === overId));
    const activeRect = event.active.rect.current.translated;
    const overRect = over.rect;
    if (!stages.includes(overId as Stage) && activeRect && activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2) insertionIndex += 1;
    const reordered = [...targetItems];
    reordered.splice(insertionIndex, 0, { ...item, stage: target });
    const orders = new Map(reordered.map((candidate, index) => [candidate.id, (index + 1) * 1000]));
    const next = before.map((candidate) => {
      const boardOrder = orders.get(candidate.id);
      return boardOrder === undefined ? candidate : { ...candidate, stage: target, board_order: boardOrder };
    });

    // No visual or persisted change when a card is dropped back onto its current position.
    if (next.every((candidate, index) => candidate.stage === before[index].stage && candidate.board_order === before[index].board_order)) return;

    setItems(next);
    const updates = reordered.map((candidate) => {
      const updated = next.find((nextCandidate) => nextCandidate.id === candidate.id)!;
      return fetch(`/api/applications/${updated.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: updated.stage, board_order: updated.board_order }),
      });
    });
    const responses = await Promise.all(updates);
    if (responses.some((response) => !response.ok)) {
      setItems(before);
      const failed = responses.find((response) => !response.ok);
      const json = failed ? await failed.json().catch(() => ({})) : {};
      toast.error(json.error || "Could not move application.");
      return;
    }
    toast.success(target === item.stage ? "Application order updated." : `Moved to ${stageLabel(target)}.`);
  };

  return <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={move}>
    <div className="flex gap-4 overflow-x-auto pb-5">
      {stages.map((stage) => <BoardColumn key={stage} stage={stage} applications={items.filter((item) => item.stage === stage).sort((a, b) => a.board_order - b.board_order)} />)}
    </div>
  </DndContext>;
}
