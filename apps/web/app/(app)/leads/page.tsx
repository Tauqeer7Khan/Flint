"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  LEAD_SOURCES,
  MODULES,
  type CreateLeadInput,
  type ConvertLeadInput,
} from "@flint/shared";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableRowActions } from "@/components/data-table/data-table-row-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatINR } from "@/lib/format";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Plus,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from "lucide-react";

interface Lead {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  source: string;
  status: string;
  consent: boolean;
  custom_fields: {
    companySize?: number;
    currentHrTool?: string;
    interestedModules?: string[];
    hrContactDesignation?: string;
  } | null;
  owner_id: string | null;
  owner?: { id: string; name: string } | null;
  created_at: string;
}

export default function LeadsPage() {
  const queryClient = useQueryClient();

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingLead, setEditingLead] = React.useState<Lead | null>(null);
  const [convertingLead, setConvertingLead] = React.useState<Lead | null>(null);
  const [deleteLeadId, setDeleteLeadId] = React.useState<string | null>(null);

  // Form states for Create/Edit
  const [formData, setFormData] = React.useState<{
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    source: (typeof LEAD_SOURCES)[number];
    status: string;
    companySize: string;
    currentHrTool: string;
    hrContactDesignation: string;
    interestedModules: string[];
  }>({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    source: "Waitlist",
    status: "NEW",
    companySize: "",
    currentHrTool: "",
    hrContactDesignation: "",
    interestedModules: [],
  });

  // Form states for Convert Lead
  const [convertData, setConvertData] = React.useState<{
    dealTitle: string;
    employees: number;
    selectedModules: string[];
  }>({
    dealTitle: "",
    employees: 100,
    selectedModules: ["HR Operations", "Payroll"],
  });

  // Query leads
  const {
    data: responseData,
    isLoading,
    error,
  } = useQuery<{ data: Lead[]; total: number }>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/leads");
      if (res.status === 403) {
        throw new Error("403_FORBIDDEN");
      }
      if (!res.ok) {
        throw new Error("Failed to fetch leads");
      }
      return res.json();
    },
    retry: false,
  });

  const leads = responseData?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (input: CreateLeadInput) => {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create lead");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setIsCreateOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateLeadInput> }) => {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update lead");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setEditingLead(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/leads/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete lead");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setDeleteLeadId(null);
    },
  });

  const convertMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ConvertLeadInput }) => {
      const res = await fetch(`/api/leads/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to convert lead");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setConvertingLead(null);
    },
  });

  const resetForm = () => {
    setFormData({
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      source: "Waitlist",
      status: "NEW",
      companySize: "",
      currentHrTool: "",
      hrContactDesignation: "",
      interestedModules: [],
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEditDialog = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      companyName: lead.company_name,
      contactName: lead.contact_name,
      email: lead.email,
      phone: lead.phone || "",
      source: (lead.source as (typeof LEAD_SOURCES)[number]) || "Waitlist",
      status: lead.status || "NEW",
      companySize: lead.custom_fields?.companySize
        ? String(lead.custom_fields.companySize)
        : "",
      currentHrTool: lead.custom_fields?.currentHrTool || "",
      hrContactDesignation: lead.custom_fields?.hrContactDesignation || "",
      interestedModules: lead.custom_fields?.interestedModules || [],
    });
  };

  const openConvertDialog = (lead: Lead) => {
    const size = lead.custom_fields?.companySize || 100;
    const modules =
      lead.custom_fields?.interestedModules &&
      lead.custom_fields.interestedModules.length > 0
        ? lead.custom_fields.interestedModules
        : ["HR Operations", "Payroll"];

    setConvertingLead(lead);
    setConvertData({
      dealTitle: `${lead.company_name} - Annual Subscription`,
      employees: Number(size),
      selectedModules: modules,
    });
  };

  // Convert calculation
  const totalPerEmployeeMonth = React.useMemo(() => {
    return convertData.selectedModules.reduce((sum, modName) => {
      const found = MODULES.find((m) => m.name === modName);
      return sum + (found ? found.price_per_employee_month : 0);
    }, 0);
  }, [convertData.selectedModules]);

  const computedAnnualDealAmount = React.useMemo(() => {
    return convertData.employees * totalPerEmployeeMonth * 12;
  }, [convertData.employees, totalPerEmployeeMonth]);

  // Handle access denied for Support Agent
  if (error?.message === "403_FORBIDDEN") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 text-center max-w-2xl mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-600 mb-6">
          Your role does not have permission to view or manage Leads. According to FLINT&apos;s RBAC policy, Support Agents cannot access the Sales Pipeline Leads.
        </p>
        <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">
          <span>Role Scope:</span>
          <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
            Forbidden
          </Badge>
        </div>
      </div>
    );
  }

  // Columns definition
  const columns: ColumnDef<Lead>[] = [
    {
      accessorKey: "company_name",
      header: "Company",
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {row.original.company_name}
          </div>
          <div className="text-xs text-slate-500">
            {row.original.custom_fields?.companySize
              ? `${row.original.custom_fields.companySize} emp`
              : "Size not specified"}
            {row.original.custom_fields?.currentHrTool && (
              <span> • using {row.original.custom_fields.currentHrTool}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "contact_name",
      header: "Contact",
      cell: ({ row }) => (
        <div>
          <div className="text-sm font-medium text-slate-800">
            {row.original.contact_name}
          </div>
          <div className="text-xs text-slate-500">{row.original.email}</div>
          {row.original.custom_fields?.hrContactDesignation && (
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
              {row.original.custom_fields.hrContactDesignation}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-normal text-xs">
          {row.original.source}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status;
        let variant: "default" | "secondary" | "outline" | "destructive" = "secondary";
        let colorClass = "bg-slate-100 text-slate-700";

        if (s === "NEW") colorClass = "bg-blue-50 text-blue-700 border-blue-200";
        if (s === "CONTACTED") colorClass = "bg-amber-50 text-amber-700 border-amber-200";
        if (s === "QUALIFIED") colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        if (s === "CONVERTED") colorClass = "bg-purple-50 text-purple-700 border-purple-200";
        if (s === "UNQUALIFIED") colorClass = "bg-slate-100 text-slate-500 border-slate-200";

        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}
          >
            {s}
          </span>
        );
      },
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
      cell: ({ row }) => {
        const isConverted = row.original.status === "CONVERTED";
        return (
          <DataTableRowActions
            onEdit={() => openEditDialog(row.original)}
            onConvert={!isConverted ? () => openConvertDialog(row.original) : undefined}
            onDelete={() => setDeleteLeadId(row.original.id)}
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads Hub</h1>
          <p className="text-sm text-slate-500">
            Empulz inbound waitlist, qualification, and direct deal conversion.
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white shadow-xs"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Lead
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={leads}
        searchKey="company_name"
        searchPlaceholder="Search leads by company..."
        isLoading={isLoading}
      />

      {/* Add / Edit Dialog */}
      <Dialog
        open={isCreateOpen || !!editingLead}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingLead(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLead ? "Edit Lead" : "Create New Lead"}
            </DialogTitle>
            <DialogDescription>
              Capture company details, contact information, and Empulz HR profile.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const payload: CreateLeadInput = {
                companyName: formData.companyName,
                contactName: formData.contactName,
                email: formData.email,
                phone: formData.phone || undefined,
                source: formData.source,
                status: formData.status,
                consent: true,
                customFields: {
                  companySize: formData.companySize ? Number(formData.companySize) : undefined,
                  currentHrTool: formData.currentHrTool || undefined,
                  hrContactDesignation: formData.hrContactDesignation || undefined,
                  interestedModules: formData.interestedModules,
                },
              };

              if (editingLead) {
                updateMutation.mutate({ id: editingLead.id, data: payload });
              } else {
                createMutation.mutate(payload);
              }
            }}
            className="space-y-4 py-2"
          >
            {/* Core Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  required
                  placeholder="e.g. Swiggy"
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contactName">Contact Name *</Label>
                <Input
                  id="contactName"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={formData.contactName}
                  onChange={(e) =>
                    setFormData({ ...formData, contactName: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="priya@company.com"
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
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="source">Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(val: (typeof LEAD_SOURCES)[number]) =>
                    setFormData({ ...formData, source: val })
                  }
                >
                  <SelectTrigger id="source">
                    <SelectValue placeholder="Select Source" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">NEW</SelectItem>
                    <SelectItem value="CONTACTED">CONTACTED</SelectItem>
                    <SelectItem value="QUALIFIED">QUALIFIED</SelectItem>
                    <SelectItem value="UNQUALIFIED">UNQUALIFIED</SelectItem>
                    {editingLead && <SelectItem value="CONVERTED">CONVERTED</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Empulz Custom Fields Section */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Empulz HR Intelligence
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="companySize" className="text-xs">
                    Company Size (Employees)
                  </Label>
                  <Input
                    id="companySize"
                    type="number"
                    placeholder="e.g. 250"
                    value={formData.companySize}
                    onChange={(e) =>
                      setFormData({ ...formData, companySize: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="currentHrTool" className="text-xs">
                    Current HR Tool
                  </Label>
                  <Input
                    id="currentHrTool"
                    placeholder="e.g. Darwinbox / Keka"
                    value={formData.currentHrTool}
                    onChange={(e) =>
                      setFormData({ ...formData, currentHrTool: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="hrContactDesignation" className="text-xs">
                    Contact Designation
                  </Label>
                  <Input
                    id="hrContactDesignation"
                    placeholder="e.g. VP People / HR Lead"
                    value={formData.hrContactDesignation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hrContactDesignation: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Modules of interest */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <Label className="text-xs font-medium text-slate-700">
                  Interested Empulz Modules
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MODULES.map((m) => {
                    const checked = formData.interestedModules.includes(m.name);
                    return (
                      <label
                        key={m.name}
                        className="flex items-center space-x-2 text-xs cursor-pointer p-1.5 rounded hover:bg-white transition-colors"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(val) => {
                            if (val) {
                              setFormData({
                                ...formData,
                                interestedModules: [
                                  ...formData.interestedModules,
                                  m.name,
                                ],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                interestedModules: formData.interestedModules.filter(
                                  (item) => item !== m.name
                                ),
                              });
                            }
                          }}
                        />
                        <span className="text-slate-700 font-medium">
                          {m.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingLead(null);
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
                {editingLead ? "Save Changes" : "Create Lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Convert Lead Modal */}
      <Dialog
        open={!!convertingLead}
        onOpenChange={(open) => {
          if (!open) setConvertingLead(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-[#EA580C]" />
              Convert Lead to Deal & Account
            </DialogTitle>
            <DialogDescription>
              Converts <strong>{convertingLead?.company_name}</strong> into an Account, creates contact <strong>{convertingLead?.contact_name}</strong>, and initializes an active Pipeline Deal.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!convertingLead) return;
              convertMutation.mutate({
                id: convertingLead.id,
                data: {
                  leadId: convertingLead.id,
                  dealTitle: convertData.dealTitle,
                  dealAmount: computedAnnualDealAmount,
                  employees: Number(convertData.employees),
                  selectedModules: convertData.selectedModules,
                },
              });
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="dealTitle">Deal Title</Label>
              <Input
                id="dealTitle"
                required
                value={convertData.dealTitle}
                onChange={(e) =>
                  setConvertData({ ...convertData, dealTitle: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="employees">Employee Count (Seats)</Label>
              <Input
                id="employees"
                type="number"
                min={1}
                required
                value={convertData.employees}
                onChange={(e) =>
                  setConvertData({
                    ...convertData,
                    employees: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
              />
            </div>

            {/* Modules Checkboxes with Prices */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium text-slate-800">
                  Select Modules for Subscription
                </Label>
                <span className="text-xs text-slate-500 font-mono">
                  ₹{totalPerEmployeeMonth}/emp/mo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50/50">
                {MODULES.map((mod) => {
                  const isChecked = convertData.selectedModules.includes(mod.name);
                  return (
                    <label
                      key={mod.name}
                      className="flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-white text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(val) => {
                            if (val) {
                              setConvertData({
                                ...convertData,
                                selectedModules: [
                                  ...convertData.selectedModules,
                                  mod.name,
                                ],
                              });
                            } else {
                              setConvertData({
                                ...convertData,
                                selectedModules: convertData.selectedModules.filter(
                                  (m) => m !== mod.name
                                ),
                              });
                            }
                          }}
                        />
                        <span className="font-medium text-slate-800">
                          {mod.name}
                        </span>
                      </div>
                      <span className="text-slate-500 font-mono">
                        ₹{mod.price_per_employee_month}/mo
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Live Calculated Quote Box */}
            <div className="rounded-xl bg-[#0B132B] text-white p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-300">
                  Annual Contract Value (ACV)
                </div>
                <div className="text-2xl font-bold tracking-tight text-white mt-0.5">
                  {formatINR(computedAnnualDealAmount)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {convertData.employees} employees × ₹{totalPerEmployeeMonth}/mo × 12 months
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#EA580C]/20 text-[#EA580C] flex items-center justify-center font-bold">
                ₹
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConvertingLead(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white"
                disabled={convertMutation.isPending}
              >
                {convertMutation.isPending ? "Converting..." : "Complete Conversion"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteLeadId}
        onOpenChange={(open) => {
          if (!open) setDeleteLeadId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this lead? This will be soft-deleted and recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteLeadId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteLeadId && deleteMutation.mutate(deleteLeadId)}
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
