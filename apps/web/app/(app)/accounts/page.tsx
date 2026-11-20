"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { type CreateAccountInput, type AccountPulse } from "@flint/shared";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableRowActions } from "@/components/data-table/data-table-row-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, Plus, Users, Briefcase } from "lucide-react";

interface Account {
  id: string;
  name: string;
  owner_id: string | null;
  owner?: { id: string; name: string; email: string } | null;
  custom_fields: {
    companySize?: number;
    currentHrTool?: string;
    interestedModules?: string[];
  } | null;
  _count?: {
    contacts: number;
    deals: number;
  };
  pulse?: AccountPulse;
  created_at: string;
}

export default function AccountsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(null);
  const [deleteAccountId, setDeleteAccountId] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState<{
    name: string;
    companySize: string;
    currentHrTool: string;
  }>({
    name: "",
    companySize: "",
    currentHrTool: "",
  });

  const {
    data: responseData,
    isLoading,
  } = useQuery<{ data: Account[]; total: number }>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return res.json();
    },
  });

  const accounts = responseData?.data || [];

  const createMutation = useMutation({
    mutationFn: async (input: CreateAccountInput) => {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create account");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsCreateOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateAccountInput> }) => {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update account");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setEditingAccount(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete account");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setDeleteAccountId(null);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      companySize: "",
      currentHrTool: "",
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      companySize: account.custom_fields?.companySize
        ? String(account.custom_fields.companySize)
        : "",
      currentHrTool: account.custom_fields?.currentHrTool || "",
    });
  };

  const columns: ColumnDef<Account>[] = [
    {
      accessorKey: "name",
      header: "Account Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-[#EA580C]">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <Link
              href={`/accounts/${row.original.id}`}
              className="font-semibold text-slate-900 hover:text-[#EA580C] transition-colors"
            >
              {row.original.name}
            </Link>
            <div className="text-xs text-slate-500">
              {row.original.custom_fields?.currentHrTool
                ? `Using ${row.original.custom_fields.currentHrTool}`
                : "No legacy HR tool specified"}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "pulse",
      header: "Account Pulse",
      cell: ({ row }) => {
        const pulse = row.original.pulse;
        if (!pulse) return <span className="text-slate-400 text-xs">—</span>;
        const dotColor =
          pulse.color === "GREEN"
            ? "bg-emerald-500"
            : pulse.color === "YELLOW"
            ? "bg-amber-500"
            : "bg-rose-500";
        const badgeBg =
          pulse.color === "GREEN"
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : pulse.color === "YELLOW"
            ? "bg-amber-50 text-amber-800 border-amber-200"
            : "bg-rose-50 text-rose-800 border-rose-200";

        return (
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
              {pulse.score}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "companySize",
      header: "Headcount",
      cell: ({ row }) => (
        <div className="text-xs font-medium text-slate-700">
          {row.original.custom_fields?.companySize ? (
            <span>{row.original.custom_fields.companySize} employees</span>
          ) : (
            <span className="text-slate-400">N/A</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "owner",
      header: "Account Owner",
      cell: ({ row }) => (
        <span className="text-xs text-slate-600">
          {row.original.owner?.name || "Unassigned"}
        </span>
      ),
    },
    {
      accessorKey: "contacts",
      header: "Contacts",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.original._count?.contacts ?? 0}</span>
        </div>
      ),
    },
    {
      accessorKey: "deals",
      header: "Active Deals",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.original._count?.deals ?? 0}</span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DataTableRowActions
          onEdit={() => openEditDialog(row.original)}
          customActions={[
            {
              label: "Customer 360",
              onClick: () => router.push(`/accounts/${row.original.id}`),
            },
          ]}
          onDelete={() => setDeleteAccountId(row.original.id)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Accounts</h1>
          <p className="text-sm text-slate-500">
            Client enterprises, organizational profiles, and custom HR tech stacks.
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white shadow-xs"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={accounts}
        searchKey="name"
        searchPlaceholder="Search accounts by name..."
        isLoading={isLoading}
      />

      {/* Add / Edit Dialog */}
      <Dialog
        open={isCreateOpen || !!editingAccount}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingAccount(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Edit Account" : "Create New Account"}
            </DialogTitle>
            <DialogDescription>
              Organization master record and intelligence attributes.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const payload: CreateAccountInput = {
                name: formData.name,
                customFields: {
                  companySize: formData.companySize ? Number(formData.companySize) : undefined,
                  currentHrTool: formData.currentHrTool || undefined,
                  interestedModules: [],
                },
              };

              if (editingAccount) {
                updateMutation.mutate({ id: editingAccount.id, data: payload });
              } else {
                createMutation.mutate(payload);
              }
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="accountName">Account Name *</Label>
              <Input
                id="accountName"
                required
                placeholder="e.g. Tata Consultancy Services"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="companySize">Company Headcount</Label>
              <Input
                id="companySize"
                type="number"
                placeholder="e.g. 500"
                value={formData.companySize}
                onChange={(e) =>
                  setFormData({ ...formData, companySize: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="currentHrTool">Current HR Tool</Label>
              <Input
                id="currentHrTool"
                placeholder="e.g. SAP SuccessFactors / Darwinbox"
                value={formData.currentHrTool}
                onChange={(e) =>
                  setFormData({ ...formData, currentHrTool: e.target.value })
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingAccount(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingAccount ? "Save Changes" : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteAccountId}
        onOpenChange={(open) => {
          if (!open) setDeleteAccountId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this account? It will be soft-deleted and an audit log recorded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteAccountId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteAccountId && deleteMutation.mutate(deleteAccountId)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
