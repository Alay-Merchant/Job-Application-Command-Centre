import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
export default function AppLayout({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen"><Sidebar /><main className="min-w-0 flex-1"><Topbar />{children}</main></div>; }
