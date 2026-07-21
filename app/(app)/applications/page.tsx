import { BriefcaseBusiness } from "lucide-react";
import { Board } from "@/components/kanban/board";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/pocketbase/server";

export default async function ApplicationsPage() {
  const pb = await createClient();
  const { data } = await pb.from("applications").select("*,job:jobs(title,company),kit:application_kits(match_score)").order("board_order");
  return <div className="page"><div className="mb-7"><p className="text-sm font-medium text-indigo-600">Your application pipeline</p><h1 className="mt-1 text-2xl font-semibold">Applications</h1><p className="mt-2 text-sm text-slate-500">Drag cards between stages or open one to prepare your next move.</p></div>{data?.length ? <Board initial={data as never[]} /> : <EmptyState icon={BriefcaseBusiness} title="Your board is waiting" body="Save a role and create an application to begin building a thoughtful pipeline." href="/jobs" action="Find jobs" />}</div>;
}
