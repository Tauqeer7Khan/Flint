"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { connectSocket, getSocket } from "@/lib/socket";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  Code2,
  Eye,
  GitBranch,
  Layers,
  Play,
  RotateCw,
  ShieldAlert,
  Sparkles,
  UserCheck,
  XCircle,
  Zap,
} from "lucide-react";

interface WorkflowItem {
  id: string;
  name: string;
  trigger: string;
  conditions: any;
  actions: any;
  is_active: boolean;
  totalRuns: number;
  recentRuns: Array<{ id: string; status: string; created_at: string }>;
  created_at: string;
  updated_at: string;
}

interface WorkflowRunItem {
  id: string;
  workflow_id: string;
  workflow: {
    id: string;
    name: string;
    trigger: string;
  };
  trigger_event: any;
  status: "SUCCESS" | "FAILED" | string;
  log: any;
  created_at: string;
}

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const [selectedRun, setSelectedRun] = React.useState<WorkflowRunItem | null>(null);
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [testNotification, setTestNotification] = React.useState<string | null>(null);

  // Fetch current user for RBAC enforcement
  const { data: currentUser, isLoading: isLoadingUser } = useQuery<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>({
    queryKey: ["current-user"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Real-time socket updates
  React.useEffect(() => {
    connectSocket().catch(() => {});
    const socket = getSocket();
    if (socket) {
      const handleWorkflowsChanged = () => {
        queryClient.invalidateQueries({ queryKey: ["workflows"] });
        queryClient.invalidateQueries({ queryKey: ["workflow-runs"] });
      };
      socket.on("workflows:changed", handleWorkflowsChanged);
      return () => {
        socket.off("workflows:changed", handleWorkflowsChanged);
      };
    }
  }, [queryClient]);

  // Fetch workflows
  const { data: workflowsData, isLoading: isLoadingWorkflows } = useQuery<{
    workflows: WorkflowItem[];
  }>({
    queryKey: ["workflows"],
    enabled: !!currentUser && currentUser.role !== "SALES_REP" && currentUser.role !== "SUPPORT_AGENT",
    queryFn: async () => {
      const res = await fetch("/api/workflows");
      if (!res.ok) throw new Error("Failed to load workflows");
      return res.json();
    },
  });

  // Fetch run history
  const { data: runsData, isLoading: isLoadingRuns } = useQuery<{
    runs: WorkflowRunItem[];
  }>({
    queryKey: ["workflow-runs"],
    enabled: !!currentUser && currentUser.role !== "SALES_REP" && currentUser.role !== "SUPPORT_AGENT",
    queryFn: async () => {
      const res = await fetch("/api/workflows/runs");
      if (!res.ok) throw new Error("Failed to load workflow runs");
      return res.json();
    },
  });

  // Mutation: Toggle Active/Inactive
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/workflows/${id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle workflow");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  // Mutation: Test Run
  const testRunMutation = useMutation({
    mutationFn: async (id: string) => {
      setTestingId(id);
      const res = await fetch(`/api/workflows/${id}/test`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to execute test run");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-runs"] });
      setTestNotification(data.message || "Test run completed successfully!");
      setTimeout(() => setTestNotification(null), 4000);
      setTestingId(null);
    },
    onError: (err: Error) => {
      alert(`Test run error: ${err.message}`);
      setTestingId(null);
    },
  });

  const workflows = workflowsData?.workflows || [];
  const runs = runsData?.runs || [];

  const formatConditions = (conditions: any) => {
    if (!conditions || (typeof conditions === "object" && Object.keys(conditions).length === 0)) {
      return "None (All events)";
    }
    if (typeof conditions === "object") {
      const entries = Object.entries(conditions);
      return entries.map(([k, v]) => `${k} == '${v}'`).join(", ");
    }
    return JSON.stringify(conditions);
  };

  const getActionBadges = (actions: any) => {
    if (!Array.isArray(actions)) return null;
    return actions.map((act: any, idx: number) => {
      switch (act.type) {
        case "assign_user":
          return (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200"
            >
              <UserCheck className="w-3 h-3 text-blue-600" />
              Assign User
            </span>
          );
        case "create_task":
          return (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              <Layers className="w-3 h-3 text-emerald-600" />
              {act.forEach ? "Create Tasks (Per Module)" : "Create Task"}
            </span>
          );
        case "notify":
          return (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200"
            >
              <Bell className="w-3 h-3 text-purple-600" />
              Notify
            </span>
          );
        default:
          return (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700"
            >
              {act.type}
            </span>
          );
      }
    });
  };

  const formatActionsSummary = (log: any) => {
    if (!log || !log.actionsExecuted) return "Executed";
    const actions = log.actionsExecuted;
    if (!Array.isArray(actions) || actions.length === 0) return "No actions";

    const types = actions.map((a: any) => a.type);
    return `${actions.length} ${actions.length === 1 ? "action" : "actions"}: ${types.join(", ")}`;
  };

  const isManager = currentUser?.role === "MANAGER";

  // 403 Forbidden / Access Restricted Card for Sales Rep & Support Agent
  if (!isLoadingUser && currentUser && (currentUser.role === "SALES_REP" || currentUser.role === "SUPPORT_AGENT")) {
    return (
      <div className="mx-auto max-w-lg pt-16">
        <Card className="border-rose-100 bg-rose-50/20 text-center shadow-md">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">Access Restricted</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Contact your administrator for access to automated workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <p className="text-xs text-slate-500">
              Your role ({currentUser?.role || "GUEST"}) does not have administrative privileges to configure or inspect system workflows.
            </p>
            <Link href="/dashboard" className="block w-full">
              <Button className="w-full bg-[#0B132B] hover:bg-[#1C2541] text-white">
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-[#EA580C]" />
            Automation Engine
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Connected workflows driving no-silo execution across Sales, Support, and Customer Success.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
            3 Active Workflows
          </Badge>
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
            Engine Running
          </Badge>
        </div>
      </div>

      {/* Test Notification Banner */}
      {testNotification && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{testNotification}</span>
        </div>
      )}

      {/* 3 Core Workflows Card Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Configured Automations (Seeded & Verified)
        </h2>

        {isLoadingWorkflows ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading workflows...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {workflows.map((wf) => {
              const isTesting = testingId === wf.id;

              return (
                <Card
                  key={wf.id}
                  className={`rounded-2xl transition-all duration-200 border ${
                    wf.is_active
                      ? "border-slate-200 hover:border-slate-300 bg-white shadow-xs"
                      : "border-slate-200/60 bg-slate-50/50 opacity-75"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-bold text-slate-900 leading-snug">
                        {wf.name}
                      </CardTitle>
                      {/* Active Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={wf.is_active}
                        disabled={isManager}
                        title={
                          isManager
                            ? "View-only for Managers"
                            : wf.is_active
                            ? "Click to deactivate"
                            : "Click to activate"
                        }
                        onClick={() => {
                          if (!isManager) {
                            toggleMutation.mutate({ id: wf.id, isActive: !wf.is_active });
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 ${
                          isManager ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                        } rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          wf.is_active ? "bg-emerald-600" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            wf.is_active ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Badge className="bg-purple-100 text-purple-800 border-purple-200 font-mono text-[11px]">
                        <Zap className="w-3 h-3 mr-1 text-purple-600" />
                        {wf.trigger}
                      </Badge>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {wf.totalRuns} {wf.totalRuns === 1 ? "run" : "runs"}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 text-xs">
                    {/* Condition Matcher */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 space-y-1">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Condition Criteria
                      </div>
                      <div className="font-mono text-slate-700 text-[11px] truncate">
                        {formatConditions(wf.conditions)}
                      </div>
                    </div>

                    {/* Actions Array */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Action Pipeline
                      </div>
                      <div className="flex flex-wrap gap-1.5">{getActionBadges(wf.actions)}</div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            wf.is_active ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                          }`}
                        />
                        {wf.is_active ? "Active" : "Disabled"}
                      </span>

                      {!isManager && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isTesting || testRunMutation.isPending}
                          onClick={() => testRunMutation.mutate(wf.id)}
                          className="h-7 text-xs font-semibold gap-1 text-[#EA580C] border-orange-200 hover:bg-orange-50 hover:text-[#EA580C]"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          {isTesting ? "Running..." : "Test Run"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Execution Run History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Execution Log & Run History (Last 50 Runs)
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["workflow-runs"] })}
            className="text-xs text-slate-500 hover:text-slate-900 gap-1.5 h-7"
          >
            <RotateCw className="w-3 h-3" />
            Refresh History
          </Button>
        </div>

        {isLoadingRuns ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading history...</div>
        ) : runs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            No execution runs recorded yet. Use the "Test Run" button above or trigger a live event!
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Workflow Name</th>
                    <th className="py-3 px-4">Trigger Event</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Actions Executed</th>
                    <th className="py-3 px-4">Executed At</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {runs.map((run) => {
                    const isSuccess = run.status === "SUCCESS";

                    return (
                      <tr
                        key={run.id}
                        onClick={() => setSelectedRun(run)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900 group-hover:text-[#EA580C] transition-colors">
                          {run.workflow?.name || "System Workflow"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="font-mono text-[10px] text-purple-700 bg-purple-50 border-purple-200">
                            {run.workflow?.trigger || "domain.event"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {isSuccess ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              SUCCESS
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold gap-1">
                              <XCircle className="w-3 h-3" />
                              FAILED
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 truncate max-w-xs">
                          {formatActionsSummary(run.log)}
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {new Date(run.created_at).toLocaleString("en-IN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-slate-400 group-hover:text-slate-700"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      <Dialog open={!!selectedRun} onOpenChange={(open) => !open && setSelectedRun(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-bold text-slate-900">
                {selectedRun?.workflow?.name || "Execution Run Log"}
              </DialogTitle>
              {selectedRun?.status === "SUCCESS" ? (
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  SUCCESS
                </Badge>
              ) : (
                <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                  FAILED
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-slate-500 font-mono">
              Run ID: {selectedRun?.id} • Executed at{" "}
              {selectedRun &&
                new Date(selectedRun.created_at).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "medium",
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            {/* Trigger Event JSON */}
            <div>
              <div className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Zap className="w-3.5 h-3.5 text-purple-600" />
                Trigger Event Payload
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-3.5 font-mono text-[11px] overflow-x-auto leading-relaxed">
                <pre>{JSON.stringify(selectedRun?.trigger_event, null, 2)}</pre>
              </div>
            </div>

            {/* Execution Log JSON */}
            <div>
              <div className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Code2 className="w-3.5 h-3.5 text-blue-600" />
                Actions Log & Details
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-3.5 font-mono text-[11px] overflow-x-auto leading-relaxed">
                <pre>{JSON.stringify(selectedRun?.log, null, 2)}</pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
