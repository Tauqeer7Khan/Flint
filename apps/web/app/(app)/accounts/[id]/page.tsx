"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountPulse } from "@flint/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Timeline, type ActivityItem } from "@/components/timeline";
import { ActivityComposer } from "@/components/activity-composer";
import { PresencePill } from "@/components/presence-pill";
import { formatINR } from "@/lib/format";
import { connectSocket, getSocket } from "@/lib/socket";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  LifeBuoy,
  Receipt,
  Sparkles,
  Ticket,
  User,
  Users,
} from "lucide-react";

interface Account360Data {
  account: {
    id: string;
    name: string;
    owner_id: string | null;
    owner?: { id: string; name: string; email: string } | null;
    custom_fields: {
      companySize?: number;
      currentHrTool?: string;
      interestedModules?: string[];
      hrContactDesignation?: string;
    } | null;
    created_at: string;
  };
  contacts: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    designation: string | null;
  }[];
  deals: {
    id: string;
    title: string;
    amount: number;
    employees: number;
    stage: { id: string; name: string; probability: number };
    owner?: { id: string; name: string } | null;
  }[];
  tasks: {
    id: string;
    title: string;
    due_at: string | null;
    priority: string;
    status: string;
    assignee?: { id: string; name: string } | null;
  }[];
  tickets: {
    id: string;
    subject: string;
    status: string;
    priority: string;
    created_at: string;
    assignee?: { id: string; name: string } | null;
  }[];
  quotes: {
    id: string;
    number: string;
    monthly_total: number;
    annual_total: number;
    created_at: string;
    items: {
      id: string;
      product: { name: string };
    }[];
  }[];
  timeline: ActivityItem[];
  pulse?: AccountPulse;
}

export default function Account360Page() {
  const params = useParams();
  const router = useRouter();
  const accountId = String(params?.id);
  const queryClient = useQueryClient();

  // Socket listener for live timeline additions
  React.useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    connectSocket()
      .then((socket) => {
        if (!mounted) return;
        const handleActivityUpdate = () => {
          queryClient.invalidateQueries({ queryKey: ["account-360", accountId] });
        };
        socket.on("activity:new", handleActivityUpdate);
        socket.on("activities:changed", handleActivityUpdate);
        socket.on("tickets:changed", handleActivityUpdate);

        cleanup = () => {
          socket.off("activity:new", handleActivityUpdate);
          socket.off("activities:changed", handleActivityUpdate);
          socket.off("tickets:changed", handleActivityUpdate);
        };
      })
      .catch(() => {});

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [accountId, queryClient]);

  const {
    data,
    isLoading,
    error,
  } = useQuery<Account360Data>({
    queryKey: ["account-360", accountId],
    queryFn: async () => {
      const res = await fetch(`/api/accounts/${accountId}/360`);
      if (!res.ok) throw new Error("Failed to load Customer 360 profile");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-slate-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-96 lg:col-span-2 bg-slate-100 animate-pulse rounded-2xl" />
          <div className="h-96 bg-slate-100 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center max-w-lg mx-auto my-12">
        <p className="text-red-700 font-semibold mb-4">Account profile not found.</p>
        <Button onClick={() => router.push("/accounts")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Accounts
        </Button>
      </div>
    );
  }

  const { account, contacts, deals, tasks, tickets, quotes, timeline, pulse } = data;
  const customFields = account.custom_fields || {};

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Button
          onClick={() => router.push("/accounts")}
          variant="ghost"
          size="sm"
          className="text-slate-500 hover:text-slate-900 -ml-2 mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Accounts
        </Button>
      </div>

      {/* Cross-Team Alert Banner for Open Urgent / High Tickets */}
      {(() => {
        const alertTicket = tickets.find(
          (t) => (t.priority === "URGENT" || t.priority === "HIGH") && t.status !== "RESOLVED" && t.status !== "CLOSED"
        );
        if (!alertTicket) return null;
        return (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4 shadow-xs text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-red-700">
                  🚨 Open High-Priority Ticket Alert
                </div>
                <div className="text-sm font-semibold text-red-950 mt-0.5">
                  Account has an open {alertTicket.priority} priority ticket: &ldquo;{alertTicket.subject}&rdquo;
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/tickets/${alertTicket.id}`)}
              className="bg-white hover:bg-red-100 border-red-300 text-red-800 text-xs font-semibold shrink-0 cursor-pointer"
            >
              View Ticket #{alertTicket.id.slice(-6).toUpperCase()} →
            </Button>
          </div>
        );
      })()}

      {/* Hero Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#EA580C]">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {account.name}
                  </h1>
                  <PresencePill pageType="account" pageId={account.id} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Account Owner: {account.owner?.name || "Unassigned"} ({account.owner?.email || "No email"})
                </p>
              </div>
            </div>

            {/* Custom Field Chips */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {customFields.companySize && (
                <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700 font-medium">
                  <Users className="w-3 h-3 mr-1 text-slate-400" />
                  {customFields.companySize.toLocaleString("en-IN")} Headcount
                </Badge>
              )}

              {customFields.currentHrTool && (
                <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700 font-medium">
                  <Layers className="w-3 h-3 mr-1 text-slate-400" />
                  Using {customFields.currentHrTool}
                </Badge>
              )}

              {customFields.interestedModules?.map((mod) => (
                <Badge
                  key={mod}
                  variant="outline"
                  className="text-xs border-orange-200 bg-orange-50/50 text-[#EA580C] font-medium"
                >
                  {mod}
                </Badge>
              ))}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center min-w-[90px]">
              <div className="text-xs text-slate-500">Contacts</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{contacts.length}</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center min-w-[90px]">
              <div className="text-xs text-slate-500">Deals</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{deals.length}</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center min-w-[90px]">
              <div className="text-xs text-slate-500">Quotes</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{quotes.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2/3): Unified Activity Stream & Composer */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#EA580C]" />
                Customer 360 Timeline
              </CardTitle>
              <CardDescription className="text-xs">
                Unified chronological stream of notes, calls, meetings, internal comments, and system events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Activity Composer */}
              <ActivityComposer
                accountId={account.id}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["account-360", accountId] });
                }}
              />

              {/* Timeline Stream */}
              <Timeline
                activities={timeline}
                emptyMessage="No activities or timeline events recorded for this account yet."
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1/3): Summary Cards */}
        <div className="space-y-6">
          {/* Account Pulse Card */}
          {pulse && (
            <Card className="rounded-2xl border-slate-800 bg-[#0B132B] text-white shadow-md overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-radial from-[#EA580C]/20 to-transparent pointer-events-none" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Account Pulse
                  </span>
                  <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                    {pulse.trend}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-3">
                  <div className="text-4xl font-extrabold tracking-tight text-white font-mono">
                    {pulse.score}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block w-3 h-3 rounded-full ${
                        pulse.color === "GREEN"
                          ? "bg-emerald-500 ring-4 ring-emerald-500/20"
                          : pulse.color === "YELLOW"
                          ? "bg-amber-500 ring-4 ring-amber-500/20"
                          : "bg-rose-500 ring-4 ring-rose-500/20"
                      }`}
                    />
                    <span
                      className={`text-xs font-bold ${
                        pulse.color === "GREEN"
                          ? "text-emerald-400"
                          : pulse.color === "YELLOW"
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {pulse.color === "GREEN"
                        ? "HEALTHY"
                        : pulse.color === "YELLOW"
                        ? "MONITOR"
                        : "AT RISK"}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 mt-2">
                  {pulse.highValue ? "High-Value Account (deal ≥ ₹10L)" : "Standard Health Matrix"}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deals Summary */}
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-[#EA580C]" />
                Active Deals ({deals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deals.length === 0 ? (
                <div className="text-xs text-slate-400 py-3 text-center">No active deals.</div>
              ) : (
                <div className="space-y-2.5">
                  {deals.map((deal) => (
                    <div
                      key={deal.id}
                      onClick={() => router.push(`/deals/${deal.id}`)}
                      className="rounded-xl border border-slate-100 p-2.5 bg-slate-50/50 hover:bg-slate-100/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                        <span className="truncate hover:text-[#EA580C]">{deal.title}</span>
                        <span>{formatINR(deal.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                        <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                          {deal.stage.name} ({deal.stage.probability}%)
                        </span>
                        <span>{deal.employees} seats</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contacts Summary */}
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-600" />
                Stakeholders ({contacts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="text-xs text-slate-400 py-3 text-center">No contacts listed.</div>
              ) : (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-xl border border-slate-100 p-2 bg-slate-50/50 text-xs"
                    >
                      <div className="font-semibold text-slate-800">{contact.name}</div>
                      <div className="text-[11px] text-slate-500">{contact.designation || contact.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Open Tickets Summary */}
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <LifeBuoy className="w-4 h-4 text-slate-600" />
                Support Tickets ({tickets.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tickets.length === 0 ? (
                <div className="text-xs text-slate-400 py-3 text-center">No open tickets.</div>
              ) : (
                <div className="space-y-2">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => router.push(`/tickets/${t.id}`)}
                      className="rounded-xl border border-slate-100 p-2.5 bg-slate-50/50 text-xs hover:bg-slate-100/60 transition-colors cursor-pointer"
                    >
                      <div className="font-medium text-slate-800 hover:text-[#EA580C]">{t.subject}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                        <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50">{t.priority}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Open Tasks Summary */}
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-600" />
                Tasks ({tasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-xs text-slate-400 py-3 text-center">No open tasks.</div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-slate-100 p-2.5 bg-slate-50/50 text-xs"
                    >
                      <div className="font-medium text-slate-800">{task.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {task.assignee ? `Assignee: ${task.assignee.name}` : "Unassigned"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
