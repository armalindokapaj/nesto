"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button size="sm" onClick={() => window.print()} className="no-print">
      <Printer size={14} /> {label}
    </Button>
  );
}
