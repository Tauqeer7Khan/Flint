"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  type TicketPriority,
  type TicketStatus,
  type CreateTicketInput,
} from "@flint/shared";
import { DataTable } from "@/components/data-table/data-table";
import { SlaCountdownPill } from "@/components/sla-countdown-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { connectSocket, getSocket } from "@/lib/socket";
import {
  AlertCircle,
  Building2,
  Clock,
  Filter,
  LifeBuoy,
  Plus,
  ShieldAlert,
  User,
  Users,
} from "lucide-react";

interface TicketItem {
  id: string;
  subject: string;
  description: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  account_id: string;
  account: { id: string; name: string };
  contact_id: string | null;
  contact?: { id: string; name: string; email: string } | null;
  assignee_id: string | null;
  assignee?: { id: string; name: string; email: string } | null;
  sla_due_at: string | null;
  sla_breached_at: string | null;
  slaBreached?: boolean;
  slaDueAt?: string | null;
  first_response_at: string | null;
  created_at: string;
}

interface AccountOption {
  id: string;
  name: string;
}

interface ContactOption {
  id: string;
  name: string;
  account_id: string;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

export default function TicketsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  // Form state
  const [newSubject, setNewSubject] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newPriority, setNewPriority] = React.useState<TicketPriority>("MEDIUM");
  const [newAccountId, setNewAccountId] = React.useState("");
  const [newContactId, setNewContactId] = React.useState("");
  const [newAssigneeId, setNewAssigneeId] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  // Realtime Socket
  React.useEffect(() => {
    connectSocket().catch(() => {});
    const socket = getSocket();
    if (socket) {
      const handleTicketsChanged = () => {
        queryClient.invalidateQueries({ queryKey: ["tickets"] });
      };
      socket.on("tickets:changed", handleTicketsChanged);
      return () => {
        socket.off("tickets:changed", handleTicketsChanged);
      };
    }
  }, [queryClient]);

  // Current User
  const { data: currentUser } = useQuery<{ id: string; name: string; role: string }>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Failed to load session");
      return res.json();
    },
  });

  // Users
  const { data: usersData } = useQuery<UserOption[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });

  // Accounts
  const { data: accountsData } = useQuery<{ items: AccountOption[] }>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Failed to load accounts");
      return res.json();
    },
  });

  // Contacts
  const { data: contactsData } = useQuery<{ items: ContactOption[] }>({
    queryKey: ["contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts");
      if (!res.ok) throw new Error("Failed to load contacts");
      return res.json();
    },
  });

  const usersList: UserOption[] = Array.isArray(usersData) ? usersData : (usersData as any)?.users || [];
  const accountsList: AccountOption[] = (accountsData as any)?.items || (accountsData as any)?.accounts || [];
  const contactsList: ContactOption[] = (contactsData as any)?.items || (contactsData as any)?.contacts || [];

  // Tickets
  const { data: ticketsData, isLoading } = useQuery<{ tickets: TicketItem[] }>({
    queryKey: ["tickets", statusFilter],
    queryFn: async () => {
      const url = statusFilter === "ALL" ? "/api/tickets" : `/api/tickets?status=${statusFilter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load tickets");
      return res.json();
    },
  });

  // Mutation: Create Ticket
  const createMutation = useMutation({
    mutationFn: async (payload: CreateTicketInput) => {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create ticket");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setIsCreateOpen(false);
      resetForm();
      if (data?.ticket?.id) {
        router.push(`/tickets/${data.ticket.id}`);
      }
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const resetForm = () => {
    setNewSubject("");
    setNewDescription("");
    setNewPriority("MEDIUM");
    setNewAccountId("");
    setNewContactId("");
    setNewAssigneeId(currentUser?.id || "");
    setFormError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    if (currentUser?.id) {
      setNewAssigneeId(currentUser.id);
    }
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) {
      setFormError("Subject is required (min 3 characters)");
      return;
    }
    if (!newAccountId) {
      setFormError("Please select an Account");
      return;
    }

    createMutation.mutate({
      subject: newSubject.trim(),
      description: newDescription.trim() || undefined,
      priority: newPriority,
      accountId: newAccountId,
      contactId: newContactId || undefined,
      assigneeId: newAssigneeId || undefined,
    });
  };

  const filteredContacts = React.useMemo(() => {
    if (!newAccountId || contactsList.length === 0) return [];
    return contactsList.filter((c) => c.account_id === newAccountId);
  }, [newAccountId, contactsList]);

  const rawTickets = ticketsData?.tickets || [];

  const columns: ColumnDef<TicketItem>[] = React.useMemo(
    () => [
      {
        accessorKey: "subject",
        header: "Subject",
        cell: ({ row }) => (
          <div
            onClick={() => router.push(`/tickets/${row.original.id}`)}
            className="cursor-pointer group flex flex-col max-w-[280px]"
          >
            <span className="font-semibold text-slate-900 group-hover:text-[#EA580C] transition-colors truncate">
              {row.original.subject}
            </span>
            {row.original.description && (
              <span className="text-[11px] text-slate-400 line-clamp-1">
                {row.original.description}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "account.name",
        header: "Account",
        cell: ({ row }) => (
          <span className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {row.original.account?.name || "—"}
          </span>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => {
          const p = row.original.priority;
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
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status;
          switch (s) {
            case "OPEN":
              return <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">Open</Badge>;
            case "IN_PROGRESS":
              return <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">In Progress</Badge>;
            case "WAITING":
              return <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">Waiting</Badge>;
            case "RESOLVED":
              return <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">Resolved</Badge>;
            case "CLOSED":
              return <Badge variant="outline" className="border-slate-300 text-slate-600 bg-slate-50">Closed</Badge>;
          }
        },
      },
      {
        accessorKey: "sla",
        header: "SLA Status",
        cell: ({ row }) => (
          <SlaCountdownPill
            dueAt={row.original.slaDueAt || row.original.sla_due_at}
            breachedAt={row.original.sla_breached_at}
            status={row.original.status}
          />
        ),
      },
      {
        accessorKey: "assignee.name",
        header: "Assignee",
        cell: ({ row }) => (
          <span className="text-xs text-slate-600 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            {row.original.assignee?.name || <span className="text-slate-400 italic">Unassigned</span>}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-xs text-slate-400">
            {new Date(row.original.created_at).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ),
      },
    ],
    [router]
  );

  const statuses = [
    { label: "All", value: "ALL" },
    { label: "Open", value: "OPEN" },
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Waiting", value: "WAITING" },
    { label: "Resolved", value: "RESOLVED" },
    { label: "Closed", value: "CLOSED" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-[#EA580C]" />
            Helpdesk & Support Tickets
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Resolve customer queries, track resolution SLAs, and handle escalations.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white gap-2 font-medium shadow-xs"
        >
          <Plus className="w-4 h-4" />
          New Ticket
        </Button>
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              statusFilter === s.value
                ? "bg-[#EA580C]/10 text-[#EA580C]"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {s.label}
          </button>
        ))}
        <div className="ml-auto text-xs text-slate-400 font-medium pl-2 whitespace-nowrap">
          {rawTickets.length} {rawTickets.length === 1 ? "ticket" : "tickets"}
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={rawTickets}
        searchKey="subject"
        searchPlaceholder="Filter tickets by subject..."
        isLoading={isLoading}
      />

      {/* + New Ticket Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-[#EA580C]" />
              Create Support Ticket
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Submit an issue for customer resolution. SLA timer starts immediately upon creation.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <Label className="text-xs font-medium text-slate-700">Subject *</Label>
              <Input
                placeholder="e.g. Geofence attendance sync failing on retail floor"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Description</Label>
              <Textarea
                placeholder="Describe the issue, reproduction steps, or error details..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="mt-1 text-xs resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Account *</Label>
                <Select
                  value={newAccountId}
                  onValueChange={(val) => {
                    setNewAccountId(val);
                    setNewContactId("");
                  }}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="Select Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountsList.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Contact Person</Label>
                <Select
                  value={newContactId || "none"}
                  onValueChange={(val) => setNewContactId(val === "none" ? "" : val)}
                  disabled={!newAccountId || filteredContacts.length === 0}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder={!newAccountId ? "Choose account first" : "Select contact"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs text-slate-400">
                      None
                    </SelectItem>
                    {filteredContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Priority *</Label>
                <Select
                  value={newPriority}
                  onValueChange={(val: TicketPriority) => setNewPriority(val)}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW" className="text-xs">
                      Low
                    </SelectItem>
                    <SelectItem value="MEDIUM" className="text-xs">
                      Medium
                    </SelectItem>
                    <SelectItem value="HIGH" className="text-xs">
                      High
                    </SelectItem>
                    <SelectItem value="URGENT" className="text-xs">
                      Urgent
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Assignee</Label>
                <Select
                  value={newAssigneeId || "unassigned"}
                  onValueChange={(val) => setNewAssigneeId(val === "unassigned" ? "" : val)}
                >
                  <SelectTrigger className="mt-1 text-xs">
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

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white text-xs font-medium"
              >
                {createMutation.isPending ? "Submitting..." : "Create Ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
