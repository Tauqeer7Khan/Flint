"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { type CreateContactInput } from "@flint/shared";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableRowActions } from "@/components/data-table/data-table-row-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, Mail, Phone, Plus, User } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  account_id: string;
  account?: { id: string; name: string } | null;
  owner_id: string | null;
  owner?: { id: string; name: string; email: string } | null;
  created_at: string;
}

interface AccountOption {
  id: string;
  name: string;
}

export default function ContactsPage() {
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState<Contact | null>(null);
  const [deleteContactId, setDeleteContactId] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState<{
    name: string;
    email: string;
    phone: string;
    designation: string;
    accountId: string;
  }>({
    name: "",
    email: "",
    phone: "",
    designation: "",
    accountId: "",
  });

  // Query contacts
  const {
    data: responseData,
    isLoading,
  } = useQuery<{ data: Contact[]; total: number }>({
    queryKey: ["contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts");
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
  });

  // Query accounts for selector
  const { data: accountsData } = useQuery<{ data: AccountOption[] }>({
    queryKey: ["accounts-options"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return res.json();
    },
  });

  const contacts = responseData?.data || [];
  const accounts = accountsData?.data || [];

  const createMutation = useMutation({
    mutationFn: async (input: CreateContactInput) => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create contact");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setIsCreateOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateContactInput> }) => {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update contact");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setEditingContact(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete contact");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setDeleteContactId(null);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      designation: "",
      accountId: "",
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEditDialog = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || "",
      designation: contact.designation || "",
      accountId: contact.account_id || "",
    });
  };

  const columns: ColumnDef<Contact>[] = [
    {
      accessorKey: "name",
      header: "Contact Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs">
            {row.original.name.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-slate-900">{row.original.name}</div>
            <div className="text-xs text-slate-500">
              {row.original.designation || "No designation specified"}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "account",
      header: "Account",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.original.account?.name || "Unassigned"}</span>
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Contact Details",
      cell: ({ row }) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1 text-slate-600">
            <Mail className="w-3 h-3 text-slate-400" />
            <span>{row.original.email}</span>
          </div>
          {row.original.phone && (
            <div className="flex items-center gap-1 text-slate-500">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{row.original.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "owner",
      header: "Owner",
      cell: ({ row }) => (
        <span className="text-xs text-slate-600">
          {row.original.owner?.name || "Unassigned"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DataTableRowActions
          onEdit={() => openEditDialog(row.original)}
          onDelete={() => setDeleteContactId(row.original.id)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500">
            Enterprise decision-makers, HR leaders, and key stakeholders.
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white shadow-xs"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={contacts}
        searchKey="name"
        searchPlaceholder="Search contacts by name..."
        isLoading={isLoading}
      />

      {/* Add / Edit Dialog */}
      <Dialog
        open={isCreateOpen || !!editingContact}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingContact(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Edit Contact" : "Create New Contact"}
            </DialogTitle>
            <DialogDescription>
              Associate an executive or HR stakeholder with a client account.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const payload: CreateContactInput = {
                name: formData.name,
                email: formData.email,
                phone: formData.phone || undefined,
                designation: formData.designation || undefined,
                accountId: formData.accountId,
              };

              if (editingContact) {
                updateMutation.mutate({ id: editingContact.id, data: payload });
              } else {
                createMutation.mutate(payload);
              }
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="contactName">Full Name *</Label>
              <Input
                id="contactName"
                required
                placeholder="e.g. Vikram Malhotra"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="designation">Designation / Role</Label>
              <Input
                id="designation"
                placeholder="e.g. Chief Human Resources Officer (CHRO)"
                value={formData.designation}
                onChange={(e) =>
                  setFormData({ ...formData, designation: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="vikram@enterprise.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+91 98111 22334"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="account">Account *</Label>
              <Select
                value={formData.accountId}
                onValueChange={(val) =>
                  setFormData({ ...formData, accountId: val })
                }
                required
              >
                <SelectTrigger id="account">
                  <SelectValue placeholder="Select an Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingContact(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white"
                disabled={
                  !formData.accountId ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
              >
                {editingContact ? "Save Changes" : "Create Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteContactId}
        onOpenChange={(open) => {
          if (!open) setDeleteContactId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this contact? It will be soft-deleted and an audit log recorded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteContactId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteContactId && deleteMutation.mutate(deleteContactId)}
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
