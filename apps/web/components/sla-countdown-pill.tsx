"use client";

import * as React from "react";
import { type TicketStatus } from "@flint/shared";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

export function SlaCountdownPill({
  dueAt,
  breachedAt,
  status,
}: {
  dueAt: string | null | undefined;
  breachedAt: string | null | undefined;
  status: TicketStatus;
}) {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  if (status === "RESOLVED" || status === "CLOSED") {
    return (
      <Badge variant="outline" className="text-slate-400 bg-slate-50 border-slate-200 text-[11px]">
        Resolved
      </Badge>
    );
  }

  if (breachedAt) {
    const diffMs = Date.now() - new Date(breachedAt).getTime();
    const mins = Math.max(1, Math.floor(diffMs / 60000));
    const label = mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
    return (
      <Badge className="bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[11px] animate-pulse">
        BREACHED {label}
      </Badge>
    );
  }

  if (!dueAt) {
    return (
      <Badge variant="outline" className="text-slate-400 text-[11px]">
        No SLA
      </Badge>
    );
  }

  const diffMs = new Date(dueAt).getTime() - Date.now();
  if (diffMs <= 0) {
    const mins = Math.max(1, Math.floor(Math.abs(diffMs) / 60000));
    return (
      <Badge className="bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[11px] animate-pulse">
        BREACHED {mins}m ago
      </Badge>
    );
  }

  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;

  if (mins <= 5) {
    return (
      <Badge className="bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-[11px]">
        <Clock className="w-3 h-3 mr-1 text-amber-700 animate-spin" />
        {mins}m left
      </Badge>
    );
  }

  const text = hours > 0 ? `${hours}h ${remainingMins}m left` : `${mins}m left`;
  return (
    <Badge variant="outline" className="text-slate-600 bg-slate-50 border-slate-200 text-[11px] font-medium">
      <Clock className="w-3 h-3 mr-1 text-slate-400" />
      {text}
    </Badge>
  );
}
