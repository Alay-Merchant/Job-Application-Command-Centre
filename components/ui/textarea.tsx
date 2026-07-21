import * as React from "react"; import { cn } from "@/lib/utils";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(({ className, ...props }, ref) => <textarea className={cn("flex min-h-24 w-full rounded-lg border bg-transparent px-3 py-2 text-sm placeholder:text-slate-400", className)} ref={ref} {...props} />); Textarea.displayName = "Textarea";
