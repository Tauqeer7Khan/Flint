"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldAlert,
  ShieldCheck,
  History,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileCode,
  RotateCcw,
  Clock,
  User,
  ArrowRight,
} from "lucide-react";
import type { SessionUser, AuditLogItem, AuditLogsResponse } from "@flint/shared";

const ENTITY_OPTIONS = [
  { value: "ALL", label: "All Entities" },
  { value: "LEADS", label: "Leads" },
  { value: "ACCOUNTS", label: "Accounts" },
  { value: "CONTACTS", label: "Contacts" },
  { value: "DEALS", label: "Deals" },
  { value: "TICKETS", label: "Tickets" },
  { value: "TASKS", label: "Tasks" },
  { value: "ACTIVITIES", label: "Activities" },
  { value: "WORKFLOWS", label: "Workflows" },
];

const ACTION_OPTIONS = [
  { value: "ALL", label: "All Actions" },
  { value: "CREATE", label: "CREATE" },
  { value: "UPDATE", label: "UPDATE" },
  { value: "DELETE", label: "DELETE" },
  { value: "CONVERT", label: "CONVERT" },
];

function getActionBadgeVariant(action: string): "success" | "info" | "destructive" | "purple" | "default" {
  switch (action.toUpperCase()) {
    case "CREATE":
      return "success";
    case "UPDATE":
      return "info";
    case "DELETE":
      return "destructive";
    case "CONVERT":
      return "purple";
    default:
      return "default";
  }
}

export default function SettingsPage() {
  const [selectedEntity, setSelectedEntity] = React.useState<string>("ALL");
  const [selectedAction, setSelectedAction] = React.useState<string>("ALL");
  const [page, setPage] = React.useState<number>(1);
  const [activeLog, setActiveLog] = React.useState<AuditLogItem | null>(null);

  // 1. Fetch current user session to determine RBAC permissions
  const { data: currentUser, isLoading: userLoading } = useQuery<SessionUser>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Failed to fetch session");
      return res.json();
    },
  });

  // 2. Query audit logs if permitted
  const isAuthorized = currentUser && (currentUser.role === "ADMIN" || currentUser.role === "MANAGER");

  const { data: logsData, isLoading: logsLoading, refetch } = useQuery<AuditLogsResponse>({
    queryKey: ["audit-logs", selectedEntity, selectedAction, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
      });
      if (selectedEntity !== "ALL") params.set("entity", selectedEntity);
      if (selectedAction !== "ALL") params.set("action", selectedAction);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load audit logs: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: Boolean(isAuthorized),
  });

  // Loading state for user verification
  if (userLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <History className="h-8 w-8 animate-spin text-[#EA580C]" />
          <p className="text-sm">Verifying security permissions...</p>
        </div>
      </div>
    );
  }

  // 403 Forbidden / Access Restricted Card for Sales Rep & Support Agent
  if (!currentUser || currentUser.role === "SALES_REP" || currentUser.role === "SUPPORT_AGENT") {
    return (
      <div className="mx-auto max-w-lg pt-16">
        <Card className="border-rose-100 bg-rose-50/20 text-center shadow-md">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">Access Restricted</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Contact your administrator for access to system settings and audit logs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <p className="text-xs text-slate-500">
              Your role ({currentUser?.role || "GUEST"}) does not have administrative privileges to view system audit logs or configuration parameters.
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

  const items = logsData?.items || [];
  const total = logsData?.total ?? 0;
  const totalPages = logsData?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B132B]">
              System Settings & Audit Log
            </h1>
            <Badge variant={currentUser.role === "ADMIN" ? "success" : "warning"}>
              {currentUser.role === "ADMIN" ? "Admin View" : "Manager (Read-Only)"}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Immutable before/after JSON audit trail tracking state mutations, conversions, and entity lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-9 gap-1.5 text-xs text-slate-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Refresh Logs
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Filters:
              </span>
            </div>

            {/* Entity Filter */}
            <div className="w-44">
              <Select
                value={selectedEntity}
                onValueChange={(val) => {
                  setSelectedEntity(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Filter */}
            <div className="w-40">
              <Select
                value={selectedAction}
                onValueChange={(val) => {
                  setSelectedAction(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reset Filters button */}
            {(selectedEntity !== "ALL" || selectedAction !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedEntity("ALL");
                  setSelectedAction("ALL");
                  setPage(1);
                }}
                className="h-9 text-xs text-slate-500 hover:text-slate-900"
              >
                Reset Filters
              </Button>
            )}

            <div className="ml-auto text-xs text-slate-400">
              Total events recorded: <span className="font-semibold text-slate-700">{total}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow>
              <TableHead className="w-[180px] text-xs font-semibold text-slate-700">Timestamp</TableHead>
              <TableHead className="w-[180px] text-xs font-semibold text-slate-700">User</TableHead>
              <TableHead className="w-[120px] text-xs font-semibold text-slate-700">Entity</TableHead>
              <TableHead className="w-[100px] text-xs font-semibold text-slate-700">Action</TableHead>
              <TableHead className="text-xs font-semibold text-slate-700">Entity ID</TableHead>
              <TableHead className="w-[120px] text-right text-xs font-semibold text-slate-700">Changes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logsLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="py-4">
                    <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                    <History className="h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">No audit logs found</p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Audit events will appear here automatically as users create, update, or convert records across the platform.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((log) => {
                const date = new Date(log.created_at);
                const formattedDate = date.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                const formattedTime = date.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                return (
                  <TableRow key={log.id} className="hover:bg-slate-50/50">
                    {/* Timestamp */}
                    <TableCell className="text-xs font-mono text-slate-600">
                      <div className="font-semibold text-slate-800">{formattedDate}</div>
                      <div className="text-[11px] text-slate-400">{formattedTime}</div>
                    </TableCell>

                    {/* User */}
                    <TableCell className="text-xs">
                      {log.user ? (
                        <div>
                          <div className="font-medium text-slate-900">{log.user.name}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <span className="font-mono">{log.user.role}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="italic text-slate-400">System Automation</span>
                      )}
                    </TableCell>

                    {/* Entity */}
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-50">
                        {log.entity}
                      </Badge>
                    </TableCell>

                    {/* Action */}
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action)} className="text-[11px]">
                        {log.action}
                      </Badge>
                    </TableCell>

                    {/* Entity ID */}
                    <TableCell>
                      <span
                        className="font-mono text-xs text-slate-500 hover:text-slate-900 transition-colors"
                        title={log.entity_id}
                      >
                        {log.entity_id.length > 18 ? `${log.entity_id.slice(0, 18)}…` : log.entity_id}
                      </span>
                    </TableCell>

                    {/* Changes Action Button */}
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveLog(log)}
                        className="h-8 gap-1 text-xs text-slate-700 hover:text-[#EA580C] hover:border-[#EA580C]"
                      >
                        <FileCode className="h-3.5 w-3.5" />
                        View Changes
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 bg-slate-50/50">
            <div className="text-xs text-slate-500">
              Showing page <span className="font-semibold text-slate-800">{page}</span> of{" "}
              <span className="font-semibold text-slate-800">{totalPages}</span> ({total} records)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 gap-1 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 gap-1 text-xs"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* JSON Diff Dialog */}
      <Dialog open={Boolean(activeLog)} onOpenChange={(open) => !open && setActiveLog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-bold text-slate-900">
                Audit Log Details
              </DialogTitle>
              {activeLog && (
                <Badge variant={getActionBadgeVariant(activeLog.action)}>
                  {activeLog.action}
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-slate-500">
              {activeLog && (
                <>
                  Entity <span className="font-mono font-semibold text-slate-700">{activeLog.entity}</span> ({activeLog.entity_id}) •{" "}
                  Modified by <span className="font-semibold text-slate-700">{activeLog.user?.name || "System"}</span> on{" "}
                  {new Date(activeLog.created_at).toLocaleString("en-IN")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {activeLog && (
            <div className="mt-4 space-y-4">
              {activeLog.changes && typeof activeLog.changes === "object" && ("before" in activeLog.changes || "after" in activeLog.changes) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Before State */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                        Before State
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {activeLog.changes.before ? "Snapshot" : "None (Created)"}
                      </span>
                    </div>
                    <pre className="p-3 rounded-xl bg-slate-950 text-slate-200 text-[11px] font-mono overflow-auto max-h-80 border border-slate-800 leading-relaxed">
                      {activeLog.changes.before
                        ? JSON.stringify(activeLog.changes.before, null, 2)
                        : "// None (New entity created)"}
                    </pre>
                  </div>

                  {/* After State */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                        After State
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {activeLog.changes.after ? "Snapshot" : "None (Deleted)"}
                      </span>
                    </div>
                    <pre className="p-3 rounded-xl bg-slate-950 text-slate-200 text-[11px] font-mono overflow-auto max-h-80 border border-slate-800 leading-relaxed">
                      {activeLog.changes.after
                        ? JSON.stringify(activeLog.changes.after, null, 2)
                        : "// None (Entity deleted)"}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Changes Payload
                  </span>
                  <pre className="p-3 rounded-xl bg-slate-950 text-slate-200 text-[11px] font-mono overflow-auto max-h-80 border border-slate-800 leading-relaxed">
                    {JSON.stringify(activeLog.changes || {}, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
