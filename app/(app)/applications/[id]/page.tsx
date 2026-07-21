import { notFound } from "next/navigation";
import { ApplicationDetail } from "@/components/kit/application-detail";
import { createClient } from "@/lib/pocketbase/server";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pb = await createClient();
  const [{ data: application }, { data: cvs }] = await Promise.all([
    pb.from("applications").select("*,job:jobs(*),cv:cv_profiles(*)").eq("id", id).single(),
    pb.from("cv_profiles").select("id,label").order("label"),
  ]);
  if (!application) notFound();
  const { data: kit } = await pb.from("application_kits").select("*").eq("application_id", application.id).maybeSingle();
  return <div className="page"><ApplicationDetail initialApplication={application as never} initialKit={kit} cvs={cvs || []} /></div>;
}
