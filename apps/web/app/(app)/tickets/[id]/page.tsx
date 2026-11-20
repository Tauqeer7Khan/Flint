"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type TicketPriority,
  type TicketStatus,
  type SessionUser,
} from "@flint/shared";
import { Timeline, type ActivityItem } from "@/components/timeline";
import { SlaCountdownPill } from "@/components/sla-countdown-pill";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/lib/format";
import { PresencePill } from "@/components/presence-pill";
import { connectSocket, getSocket } from "@/lib/socket";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  LifeBuoy,
  Lock,
  MessageSquare,
  Send,
  ShieldAlert,
  TrendingUp,
  User,
  Users,
} from "lucide-react";

interface TicketDetailData {
  ticket: {
    id: string;
    subject: string;
    description: string | null;
    priority: TicketPriority;
    status: TicketStatus;
    account_id: string;
    account: { id: string; name: string };
    contact_id: string | null;
    contact?: { id: string; name: string; email: string; phone: string | null } | null;
    assignee_id: string | null;
    assignee?: { id: string; name: string; email: string; role: string } | null;
    sla_policy_id: string | null;
    sla_due_at: string | null;
    sla_breached_at: string | null;
    slaBreached?: boolean;
    slaDueAt?: string | null;
    first_response_at: string | null;
    activities: ActivityItem[];
    created_at: string;
    updated_at: string;
  };
  canEdit: boolean;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [replyBody, setReplyBody] = React.useState("");
  const [isInternal, setIsInternal] = React.useState(false);
  const [replyError, setReplyError] = React.useState<string | null>(null);

  // Socket setup
  React.useEffect(() => {
    connectSocket().catch(() => {});
    const socket = getSocket();
    if (socket) {
      const handleTicketsChanged = () => {
        queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
        queryClient.invalidateQueries({ queryKey: ["ticket-alerts", ticketId] });
      };
      socket.on("tickets:changed", handleTicketsChanged);
      socket.on("deals:changed", handleTicketsChanged);
      return () => {
        socket.off("tickets:changed", handleTicketsChanged);
        socket.off("deals:changed", handleTicketsChanged);
      };
    }
  }, [ticketId, queryClient]);

  // Query Cross-Team Alerts
  const { data: alertsData } = useQuery<{
    hasActiveDeal: boolean;
    deal?: {
      id: string;
      title: string;
      amount: number;
      stageName: string;
    } | null;
  }>({
    queryKey: ["ticket-alerts", ticketId],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/${ticketId}/alerts`);
      if (!res.ok) throw new Error("Failed to load ticket alerts");
      return res.json();
    },
  });

  // Current session user
  const { data: currentUser } = useQuery<SessionUser>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Failed to load session");
      return res.json();
    },
  });

  // Users for assignee select
  const { data: usersData } = useQuery<UserOption[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });

  const usersList: UserOption[] = Array.isArray(usersData) ? usersData : (usersData as any)?.users || [];

  // Fetch ticket details
  const {
    data: ticketData,
    isLoading,
    isError,
  } = useQuery<TicketDetailData>({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) throw new Error("Failed to load ticket");
      return res.json();
    },
  });

  // Mutation: Status / Assignee Update
  const updateTicketMutation = useMutation({
    mutationFn: async (payload: { status?: TicketStatus; assigneeId?: string | null }) => {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update ticket");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  // Mutation: Reply Submit
  const replyMutation = useMutation({
    mutationFn: async ({ body, isInternal }: { body: string; isInternal: boolean }) => {
      const res = await fetch(`/api/tickets/${ticketId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, isInternal }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to post reply");
      }
      return res.json();
    },
    onSuccess: () => {
      setReplyBody("");
      setIsInternal(false);
      setReplyError(null);
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    },
    onError: (err: Error) => {
      setReplyError(err.message);
    },
  });

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) {
      setReplyError("Reply message cannot be empty");
      return;
    }
    replyMutation.mutate({ body: replyBody.trim(), isInternal });
  };

  if (isLoading) {
    return <div className="py-20 text-center text-sm text-slate-400">Loading ticket...</div>;
  }

  if (isError || !ticketData?.ticket) {
    return (
      <div className="py-20 text-center text-sm text-rose-500">
        Failed to load ticket or ticket does not exist.
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => router.push("/tickets")}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Tickets
          </Button>
        </div>
      </div>
    );
  }

  const { ticket, canEdit } = ticketData;
  const isSalesRep = currentUser?.role === "SALES_REP";

  const getPriorityBadge = (p: TicketPriority) => {
    switch (p) {
      case "URGENT":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Urgent</Badge>;
      case "HIGH":
        return <Badge className="bg-orange-50 text-orange-700 border-orange-200">High</Badge>;
      case "MEDIUM":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Medium</Badge>;
      case "LOW":
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back button + navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/tickets")}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tickets
        </button>

        <div className="flex items-center gap-2">
          <SlaCountdownPill
            dueAt={ticket.slaDueAt || ticket.sla_due_at}
            breachedAt={ticket.sla_breached_at}
            status={ticket.status}
          />
        </div>
      </div>

      {/* Cross-Team Alert Banner */}
      {alertsData?.hasActiveDeal && alertsData.deal && (
        <div className="rounded-2xl border border-purple-300 bg-purple-50 p-4 shadow-xs text-purple-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-purple-700">
                💼 High-Value Deal In Progress
              </div>
              <div className="text-sm font-semibold text-purple-950 mt-0.5">
                Account has an active deal worth {formatINR(alertsData.deal.amount)} in {alertsData.deal.stageName} stage
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/deals/${alertsData.deal!.id}`)}
            className="bg-white hover:bg-purple-100 border-purple-300 text-purple-800 text-xs font-semibold shrink-0 cursor-pointer"
          >
            View Deal &ldquo;{alertsData.deal.title}&rdquo; →
          </Button>
        </div>
      )}

      {/* Ticket Header & Metadata */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-slate-400">
                #{ticket.id.slice(-6).toUpperCase()}
              </span>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                {ticket.subject}
              </span>
              {getPriorityBadge(ticket.priority)}
              <PresencePill pageType="ticket" pageId={ticket.id} />
            </div>

            {ticket.description && (
              <p className="text-sm text-slate-600 max-w-3xl leading-relaxed whitespace-pre-wrap">
                {ticket.description}
              </p>
            )}

            {/* Account & Contact links */}
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 flex-wrap">
              <button
                onClick={() => router.push(`/accounts/${ticket.account_id}`)}
                className="flex items-center gap-1.5 font-medium text-slate-700 hover:text-[#EA580C] bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-md transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                {ticket.account.name}
              </button>

              {ticket.contact && (
                <span className="flex items-center gap-1 text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                  <User className="w-3 h-3 text-slate-400" />
                  {ticket.contact.name} ({ticket.contact.email})
                </span>
              )}

              <span className="text-slate-400">
                Opened {new Date(ticket.created_at).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
          </div>

          {/* Quick Actions / Controls */}
          <div className="flex flex-col sm:flex-row md:flex-col items-stretch gap-3 shrink-0 sm:w-64">
            {/* Status Selector */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                <span>Status</span>
                {isSalesRep && (
                  <span className="text-[10px] text-amber-600 flex items-center gap-1" title="Sales reps have read-only access to ticket status">
                    <Lock className="w-2.5 h-2.5" /> Read-only
                  </span>
                )}
              </div>
              <Select
                value={ticket.status}
                disabled={isSalesRep || !canEdit}
                onValueChange={(val: TicketStatus) => {
                  updateTicketMutation.mutate({ status: val });
                }}
              >
                <SelectTrigger className="text-xs bg-slate-50 border-slate-200 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN" className="text-xs">
                    Open
                  </SelectItem>
                  <SelectItem value="IN_PROGRESS" className="text-xs">
                    In Progress
                  </SelectItem>
                  <SelectItem value="WAITING" className="text-xs">
                    Waiting
                  </SelectItem>
                  <SelectItem value="RESOLVED" className="text-xs">
                    Resolved
                  </SelectItem>
                  <SelectItem value="CLOSED" className="text-xs">
                    Closed
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assignee Selector */}
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-700">Assignee</span>
              <Select
                value={ticket.assignee_id || "unassigned"}
                disabled={isSalesRep || !canEdit}
                onValueChange={(val) => {
                  updateTicketMutation.mutate({
                    assigneeId: val === "unassigned" ? null : val,
                  });
                }}
              >
                <SelectTrigger className="text-xs bg-slate-50 border-slate-200 h-9">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned" className="text-xs text-slate-400">
                    Unassigned
                  </SelectItem>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {u.name} ({u.role.replace("_", " ")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: SLA Status Card + Reply Thread */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Activity & Reply Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reply Composer */}
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#EA580C]" />
                Post Reply or Internal Note
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Public replies send updates to the customer and satisfy SLA first-response timers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {replyError && (
                <div className="mb-3 rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{replyError}</span>
                </div>
              )}

              <form onSubmit={handleReplySubmit} className="space-y-3">
                <Textarea
                  placeholder={
                    isInternal
                      ? "Write an internal note (visible only to employees)..."
                      : "Type your public reply to the customer..."
                  }
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  className={`text-xs resize-none transition-colors ${
                    isInternal ? "bg-amber-50/40 border-amber-200" : "bg-white"
                  }`}
                  rows={3}
                />

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                    <Checkbox
                      checked={isInternal}
                      onCheckedChange={(checked) => setIsInternal(!!checked)}
                      className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                    />
                    <span className="font-medium flex items-center gap-1">
                      {isInternal ? (
                        <>
                          <Lock className="w-3 h-3 text-amber-600" />
                          Internal Note (Staff only)
                        </>
                      ) : (
                        "Public Reply"
                      )}
                    </span>
                  </label>

                  <Button
                    type="submit"
                    disabled={replyMutation.isPending || !replyBody.trim()}
                    className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white text-xs font-medium gap-1.5 h-8"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {replyMutation.isPending ? "Posting..." : isInternal ? "Post Note" : "Send Reply"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500" />
              Conversation & Activity History
            </h3>
            <Timeline
              activities={ticket.activities || []}
              emptyMessage="No comments or replies yet on this ticket."
            />
          </div>
        </div>

        {/* Right Column (1 Col): SLA Status & Information Card */}
        <div className="space-y-4">
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-slate-700" />
                SLA Compliance Card
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {/* Breach Banner if Breached */}
              {ticket.sla_breached_at ? (
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    SLA Target Breached
                  </div>
                  <div className="text-[11px] text-rose-700">
                    Breached on {new Date(ticket.sla_breached_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </div>
                </div>
              ) : ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-emerald-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Ticket Resolved
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Resolution completed within operational standards.
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Target Deadline Active
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Resolution required before {new Date(ticket.sla_due_at || "").toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              )}

              {/* SLA Metrics */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">First Response:</span>
                  <span className="font-medium text-slate-900">
                    {ticket.first_response_at ? (
                      new Date(ticket.first_response_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    ) : (
                      <span className="text-amber-600 italic">Pending response</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">SLA Due At:</span>
                  <span className="font-medium text-slate-900">
                    {ticket.sla_due_at
                      ? new Date(ticket.sla_due_at).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Priority Tier:</span>
                  <span className="font-semibold text-slate-800">{ticket.priority}</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Current Status:</span>
                  <span className="font-semibold text-slate-800">{ticket.status}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
