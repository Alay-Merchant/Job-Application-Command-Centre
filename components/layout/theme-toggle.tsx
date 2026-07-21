"use client";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
export function ThemeToggle() { const [dark, setDark] = useState(false); useEffect(() => setDark(document.documentElement.classList.contains("dark")), []); const toggle = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); localStorage.setItem("applied-theme", next ? "dark" : "light"); }; return <Button aria-label="Toggle colour theme" variant="ghost" size="icon" onClick={toggle}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>; }
