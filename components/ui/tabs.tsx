"use client";
import * as TabsPrimitive from "@radix-ui/react-tabs"; import { cn } from "@/lib/utils";
export const Tabs = TabsPrimitive.Root; export const TabsContent = TabsPrimitive.Content;
export const TabsList = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => <TabsPrimitive.List className={cn("flex h-10 items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800", className)} {...props} />;
export const TabsTrigger = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) => <TabsPrimitive.Trigger className={cn("inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-white", className)} {...props} />;
