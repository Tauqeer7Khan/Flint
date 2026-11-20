"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Lock,
  MessageSquareLock,
  Phone,
  StickyNote,
  User,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ActivityAuthor {
  id: string;
  name: string;
  role: string;
  department: string;
}

export interface ActivityItem {
  id: string;
  type: "NOTE" | "CALL" | "MEETING" | "INTERNAL_COMMENT" | "SYSTEM" | string;
  body: string;
  is_internal: boolean;
  mentions: string[];
  author_id?: string | null;
  author?: ActivityAuthor | null;
  created_at: string;
}

interface TimelineProps {
  activities: ActivityItem[];
  isLoading?: boolean;
  emptyMessage?: string;
}

// Relative time formatting helper
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
}

export function Timeline({
  activities,
  isLoading = false,
  emptyMessage = "No activities recorded yet.",
}: TimelineProps) {
  // Query users to assist in resolving mention IDs
  const { data: usersData } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["users-mention-cache"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const usersMap = React.useMemo(() => {
    const map = new Map<string, string>();
    usersData?.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [usersData]);

  // Helper to render body with highlighted @mentions
  const renderFormattedBody = (body: string, mentions: string[]) => {
    // Look for @word patterns
    const parts = body.split(/(@[A-Za-z0-9_'\s]+?(?=[,\.!\?]?(\s|$)))/g);

    return parts.map((part, idx) => {
      if (part && part.startsWith("@")) {
        return (
          <span
            key={idx}
            className="inline-flex items-center font-semibold text-[#EA580C] bg-orange-100/70 border border-orange-200/60 px-1.5 py-0.5 rounded text-xs mx-0.5"
          >
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {activities.map((activity) => {
        const isInternal = activity.is_internal || activity.type === "INTERNAL_COMMENT";
        const isSystem = activity.type === "SYSTEM";

        // Determine icon & theme color
        let Icon = StickyNote;
        let iconBg = "bg-amber-100 text-amber-700 border-amber-200";

        if (activity.type === "CALL") {
          Icon = Phone;
          iconBg = "bg-emerald-100 text-emerald-700 border-emerald-200";
        } else if (activity.type === "MEETING") {
          Icon = CalendarDays;
          iconBg = "bg-blue-100 text-blue-700 border-blue-200";
        } else if (isInternal) {
          Icon = MessageSquareLock;
          iconBg = "bg-purple-100 text-purple-700 border-purple-200";
        } else if (isSystem) {
          Icon = Zap;
          iconBg = "bg-slate-200 text-slate-700 border-slate-300";
        }

        return (
          <div
            key={activity.id}
            className={`rounded-2xl border p-4 transition-colors ${
              isInternal
                ? "bg-purple-50/60 border-purple-200/90 shadow-2xs"
                : isSystem
                ? "bg-slate-50 border-slate-200 text-slate-700"
                : "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
            }`}
          >
            {/* Top row: Icon, Author, Type Pill, Relative Time */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Type Icon */}
                <div
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                {/* Author Info */}
                {isSystem ? (
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    System Event
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-semibold text-slate-900">
                      {activity.author?.name || "Team Member"}
                    </span>
                    {activity.author?.role && (
                      <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {activity.author.role}
                      </span>
                    )}
                  </div>
                )}

                {/* Internal badge */}
                {isInternal && (
                  <Badge
                    variant="outline"
                    className="border-purple-300 bg-purple-100/70 text-purple-800 text-[10px] px-1.5 py-0 font-medium flex items-center gap-1"
                  >
                    <Lock className="w-2.5 h-2.5" />
                    Internal
                  </Badge>
                )}
              </div>

              {/* Relative Time */}
              <span className="text-[11px] text-slate-400 font-medium shrink-0">
                {formatRelativeTime(activity.created_at)}
              </span>
            </div>

            {/* Body */}
            <div className="text-xs sm:text-sm text-slate-800 leading-relaxed pl-9">
              {renderFormattedBody(activity.body, activity.mentions || [])}
            </div>
          </div>
        );
      })}
    </div>
  );
}
