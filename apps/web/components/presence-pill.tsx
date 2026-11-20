"use client";

import * as React from "react";
import { connectSocket, getSocket } from "@/lib/socket";
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

  React.useEffect(() => {
    if (!pageId) return;

    let mounted = true;
    const targetRoom = `page:${pageType}:${pageId}`;

    connectSocket()
      .then((socket) => {
        if (!mounted) return;

        socket.emit("presence:join", { pageType, pageId });

        const handleUpdate = (data: { room: string; users: PresenceViewer[] }) => {
          if (data.room === targetRoom) {
            setViewers(data.users || []);
          }
        };

        socket.on("presence:update", handleUpdate);

        return () => {
          socket.emit("presence:leave", { pageType, pageId });
          socket.off("presence:update", handleUpdate);
        };
      })
      .catch(() => {});

    return () => {
      mounted = false;
      const socket = getSocket();
      if (socket) {
        socket.emit("presence:leave", { pageType, pageId });
      }
    };
  }, [pageType, pageId]);

  if (viewers.length === 0) {
    return null;
  }

  let text = "";
  if (viewers.length === 1) {
    text = `${viewers[0].name} viewing`;
  } else if (viewers.length === 2) {
    text = `${viewers[0].name} & ${viewers[1].name} viewing`;
  } else {
    text = `${viewers[0].name} and ${viewers.length - 1} others viewing`;
  }

  const titleTooltip = viewers
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
