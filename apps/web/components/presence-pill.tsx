"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { connectSocket, getSocket } from "@/lib/socket";
import { apiFetch } from "@/lib/api";
import { SessionUser } from "@flint/shared";
import { Eye, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface PresenceViewer {
  id: string;
  name: string;
  role: string;
  department: string;
}

interface PresencePillProps {
  pageType: "account" | "deal" | "ticket";
  pageId: string;
}

export function PresencePill({ pageType, pageId }: PresencePillProps) {
  const [viewers, setViewers] = React.useState<PresenceViewer[]>([]);

  const { data: currentUser } = useQuery<SessionUser>({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<SessionUser>("/auth/me"),
    staleTime: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    if (!pageId) return;

    let mounted = true;
    const targetRoom = `page:${pageType}:${pageId}`;
    let socketRef: any = null;

    const handleUpdate = (data: { room: string; users: PresenceViewer[] }) => {
      if (data.room === targetRoom && mounted) {
        setViewers(data.users || []);
      }
    };

    connectSocket()
      .then((socket) => {
        if (!mounted) return;
        socketRef = socket;
        socket.on("presence:update", handleUpdate);
        socket.emit("presence:join", { pageType, pageId });
      })
      .catch(() => {});

    return () => {
      mounted = false;
      if (socketRef) {
        socketRef.off("presence:update", handleUpdate);
        socketRef.emit("presence:leave", { pageType, pageId });
      } else {
        const socket = getSocket();
        if (socket) {
          socket.emit("presence:leave", { pageType, pageId });
        }
      }
    };
  }, [pageType, pageId]);

  const otherViewers = currentUser
    ? viewers.filter((v) => v.id !== currentUser.id)
    : viewers;

  if (otherViewers.length === 0) {
    return null;
  }

  let text = "";
  if (otherViewers.length === 1) {
    text = `${otherViewers[0].name} viewing`;
  } else if (otherViewers.length === 2) {
    text = `${otherViewers[0].name} & ${otherViewers[1].name} viewing`;
  } else {
    text = `${otherViewers[0].name} and ${otherViewers.length - 1} others viewing`;
  }

  const titleTooltip = otherViewers
    .map((v) => `${v.name} (${v.role.replace("_", " ")})`)
    .join(", ");

  return (
    <div
      title={titleTooltip}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs transition-all animate-in fade-in"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="select-none flex items-center gap-1">
        <span>👁️</span>
        <span className="font-semibold">{text}</span>
      </span>
    </div>
  );
}
