"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { connectSocket, getSocket } from "@/lib/socket";
import { Bell, Check, CheckCheck, Clock, ExternalLink } from "lucide-react";

interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  link_url?: string | null;
  read_at?: string | null;
  created_at: string;
}

interface NotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
  total: number;
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  return `${diffDays}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  // Live socket listener for incoming notifications
  React.useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    connectSocket()
      .then((socket) => {
        if (!mounted) return;
        const handleNewNotification = () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        };
        socket.on("notification:new", handleNewNotification);

        cleanup = () => {
          socket.off("notification:new", handleNewNotification);
        };
      })
      .catch(() => {});

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [queryClient]);

  // Query notifications
  const { data } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to load notifications");
      return res.json();
    },
    refetchInterval: 30000, // Background refresh
  });

  const notifications = data?.items || [];
  const unreadCount = data?.unreadCount || 0;

  // Mark all read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!res.ok) throw new Error("Failed to mark all as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mark single as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.read_at) {
      markReadMutation.mutate(n.id);
    }
    setOpen(false);
    if (n.link_url) {
      router.push(n.link_url);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer outline-hidden"
          aria-label="View notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#EA580C] text-[10px] font-bold text-white shadow-xs animate-in zoom-in-75">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 p-0 rounded-2xl border-slate-200 shadow-xl overflow-hidden bg-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-semibold bg-orange-100 text-[#EA580C] px-1.5 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="text-[11px] font-medium text-[#EA580C] hover:text-[#EA580C]/80 transition-colors flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="py-10 text-center space-y-1">
              <Bell className="w-6 h-6 text-slate-300 mx-auto mb-1" />
              <div className="text-xs font-medium text-slate-600">No notifications</div>
              <div className="text-[11px] text-slate-400">
                You are all caught up!
              </div>
            </div>
          ) : (
            notifications.map((n) => {
              const isUnread = !n.read_at;
              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 text-xs cursor-pointer transition-colors flex items-start gap-3 ${
                    isUnread
                      ? "bg-orange-50/40 hover:bg-orange-50/80"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  {/* Indicator Dot */}
                  <div className="pt-1 shrink-0">
                    {isUnread ? (
                      <span className="block w-2 h-2 rounded-full bg-[#EA580C] ring-2 ring-orange-200" />
                    ) : (
                      <span className="block w-2 h-2 rounded-full bg-slate-300" />
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-semibold truncate ${
                          isUnread ? "text-slate-900" : "text-slate-700"
                        }`}
                      >
                        {n.title}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {n.body}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
