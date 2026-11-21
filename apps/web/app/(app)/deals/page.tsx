
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  type SessionUser,
  type CreateDealInput,
} from "@flint/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/lib/format";
import { connectSocket, getSocket } from "@/lib/socket";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Lock,
  Plus,
  ShieldAlert,
  Sparkles,
  User,
  Users,
} from "lucide-react";

interface PipelineStage {
  id: string;
  name: string;
  probability: number;
  order_index: number;
}

interface Deal {
  id: string;
  title: string;
  amount: number;
  employees: number;
  stage_id: string;
  stage: PipelineStage;
  account_id: string;
  account: { id: string; name: string };
  contact_id: string | null;
  contact?: { id: string; name: string; email: string } | null;
  owner_id: string | null;
  owner?: { id: string; name: string; email: string; team_id: string | null } | null;
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

export default function DealsKanbanPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = React.useState(false);
  const [justWonDealId, setJustWonDealId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
    // Connect socket to listen for deals:changed
    connectSocket().catch(() => {});
    const socket = getSocket();
    if (socket) {
      const handleDealsChanged = () => {
        queryClient.invalidateQueries({ queryKey: ["deals"] });
      };
      socket.on("deals:changed", handleDealsChanged);
      return () => {
        socket.off("deals:changed", handleDealsChanged);
      };
    }
  }, [queryClient]);

  // 1. Fetch current user
  const { data: currentUser } = useQuery<SessionUser>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Failed to fetch session");
      return res.json();
    },
  });

  // 2. Fetch stages
  const { data: stagesData, isLoading: stagesLoading } = useQuery<{ items: PipelineStage[] }>({
    queryKey: ["pipeline-stages"],
    queryFn: async () => {
      const res = await fetch("/api/pipeline/stages");
      if (!res.ok) throw new Error("Failed to fetch stages");
      return res.json();
    },
  });

  // 3. Fetch deals
  const { data: dealsData, isLoading: dealsLoading } = useQuery<{ items: Deal[] }>({
    queryKey: ["deals"],
    queryFn: async () => {
      const res = await fetch("/api/deals");
      if (!res.ok) throw new Error("Failed to fetch deals");
      return res.json();
    },
  });

  // 4. Fetch accounts, contacts, and users for New Deal dialog
  const { data: accountsData } = useQuery<{ items: AccountOption[] }>({
    queryKey: ["accounts-for-deals"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return res.json();
    },
  });

  const { data: contactsData } = useQuery<{ items: ContactOption[] }>({
    queryKey: ["contacts-for-deals"],
    queryFn: async () => {
      const res = await fetch("/api/contacts");
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
  });

  const { data: usersData } = useQuery<UserOption[]>({
    queryKey: ["users-for-deals"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const stages = stagesData?.items || [];
  const deals = dealsData?.items || [];
  const accounts = accountsData?.items || [];
  const contacts = contactsData?.items || [];
  const users = usersData || [];

  // Dialog State
  const [isNewDealOpen, setIsNewDealOpen] = React.useState(false);
  const [formData, setFormData] = React.useState<{
    title: string;
    accountId: string;
    contactId: string;
    amount: string;
    employees: string;
    ownerId: string;
    stageId: string;
  }>({
    title: "",
    accountId: "",
    contactId: "",
    amount: "0",
    employees: "100",
    ownerId: "",
    stageId: "",
  });

  // Filter contacts by chosen account
  const filteredContacts = React.useMemo(() => {
    if (!formData.accountId) return [];
    return contacts.filter((c) => c.account_id === formData.accountId);
  }, [contacts, formData.accountId]);

  // Stage change mutation with optimistic UI update
  const stageMutation = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      const res = await fetch(`/api/deals/${dealId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update deal stage");
      }
      return res.json();
    },
    onMutate: async ({ dealId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: ["deals"] });
      const previousDeals = queryClient.getQueryData<{ items: Deal[] }>(["deals"]);

      const targetStage = stages.find((s) => s.id === stageId);
      if (previousDeals && targetStage) {
        queryClient.setQueryData<{ items: Deal[] }>(["deals"], {
          ...previousDeals,
          items: previousDeals.items.map((d) =>
            d.id === dealId ? { ...d, stage_id: stageId, stage: targetStage } : d
          ),
        });
      }

      return { previousDeals };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousDeals) {
        queryClient.setQueryData(["deals"], context.previousDeals);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });

  // Create Deal Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateDealInput) => {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create deal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setIsNewDealOpen(false);
      setFormData({
        title: "",
        accountId: "",
        contactId: "",
        amount: "0",
        employees: "100",
        ownerId: "",
        stageId: "",
      });
    },
  });

  // Permission logic for dragging
  const canDragDeal = (deal: Deal): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === "ADMIN") return true;
    if (currentUser.role === "SUPPORT_AGENT") return false; // Support is strictly read-only
    if (currentUser.role === "SALES_REP") {
      return deal.owner_id === currentUser.id;
    }
    if (currentUser.role === "MANAGER") {
      return Boolean(
        !deal.owner_id ||
        deal.owner_id === currentUser.id ||
        (currentUser.teamId && deal.owner?.team_id === currentUser.teamId)
      );
    }
    return false;
  };

  const isSupportAgent = currentUser?.role === "SUPPORT_AGENT";

  // Handle Drag End
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const targetStage = stages.find((s) => s.id === destination.droppableId);
    if (targetStage && targetStage.name === "Closed Won") {
      setJustWonDealId(draggableId);
      setTimeout(() => setJustWonDealId(null), 3000);
    }

    stageMutation.mutate({
      dealId: draggableId,
      stageId: destination.droppableId,
    });
  };

  if (!mounted || stagesLoading || dealsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded" />
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-96 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Calculate totals per stage
  const stageStats = stages.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage_id === stage.id);
    const count = stageDeals.length;
    const totalAmount = stageDeals.reduce((sum, d) => sum + d.amount, 0);
    const weightedAmount = (totalAmount * stage.probability) / 100;
    return {
      ...stage,
      deals: stageDeals,
      count,
      totalAmount,
      weightedAmount,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Sales Pipeline
            </h1>
            {isSupportAgent && (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-xs">
                Support View (Read-Only)
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500">
            Interactive Kanban across 6 stages with live weighted forecasting.
          </p>
        </div>

        {!isSupportAgent && (
          <Button
            onClick={() => {
              setFormData({
                title: "",
                accountId: accounts[0]?.id || "",
                contactId: "",
                amount: "0",
                employees: "100",
                ownerId: currentUser?.id || "",
                stageId: stages[0]?.id || "",
              });
              setIsNewDealOpen(true);
            }}
            className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white shadow-xs"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Deal
          </Button>
        )}
      </div>

      {/* Kanban Board Container */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[700px] items-start">
          {stageStats.map((stage) => {
            const isWonColumn = stage.name === "Closed Won";
            const isLostColumn = stage.name === "Closed Lost";

            return (
              <div
                key={stage.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-slate-100/60 p-3 flex-1 min-w-[260px] shadow-xs"
              >
                {/* Stage Header */}
                <div className="mb-3 px-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-900 truncate">
                      {stage.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isWonColumn
                          ? "bg-emerald-100 text-emerald-800"
                          : isLostColumn
                          ? "bg-slate-200 text-slate-600"
                          : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {stage.probability}%
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-slate-600 flex justify-between items-baseline">
                    <span className="font-medium text-slate-500">
                      {stage.count} {stage.count === 1 ? "deal" : "deals"}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatINR(stage.totalAmount)}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 text-right">
                    wt: {formatINR(stage.weightedAmount)}
                  </div>
                </div>

                {/* Droppable Column */}
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 space-y-2.5 min-h-[500px] p-1 rounded-xl transition-colors ${
                        snapshot.isDraggingOver
                          ? "bg-orange-50/80 border border-dashed border-[#EA580C]/40"
                          : ""
                      }`}
                    >
                      {stage.deals.map((deal, idx) => {
                        const canDrag = canDragDeal(deal);
                        const isJustWon = justWonDealId === deal.id;

                        return (
                          <Draggable
                            key={deal.id}
                            draggableId={deal.id}
                            index={idx}
                            isDragDisabled={!canDrag}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={() => {
                                  if (!dragSnapshot.isDragging) {
                                    router.push(`/deals/${deal.id}`);
                                  }
                                }}
                                className={`rounded-xl border bg-white p-3.5 shadow-xs transition-all cursor-pointer hover:border-[#EA580C]/50 hover:shadow-md ${
                                  dragSnapshot.isDragging
                                    ? "shadow-lg rotate-1 border-[#EA580C] ring-2 ring-[#EA580C]/30"
                                    : "border-slate-200"
                                } ${
                                  isJustWon
                                    ? "ring-2 ring-emerald-500 bg-emerald-50/30"
                                    : ""
                                } ${
                                  !canDrag
                                    ? "opacity-90"
                                    : ""
                                }`}
                              >
                                {/* Deal Title & Lock Indicator */}
                                <div className="flex items-start justify-between gap-1.5 mb-1.5">
                                  <h3 className="font-semibold text-xs text-slate-900 line-clamp-2 leading-snug hover:text-[#EA580C]">
                                    {deal.title}
                                  </h3>
                                  {!canDrag && (
                                    <span title="Read-only: You cannot move this deal">
                                      <Lock className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                                    </span>
                                  )}
                                  {isWonColumn && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                </div>

                                {/* Account */}
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2.5 truncate">
                                  <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{deal.account?.name}</span>
                                </div>

                                {/* Amount & Headcount */}
                                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                                  <span className="font-bold text-slate-900">
                                    {formatINR(deal.amount)}
                                  </span>
                                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <Users className="w-3 h-3 text-slate-400" />
                                    {deal.employees} emp
                                  </span>
                                </div>

                                {/* Owner */}
                                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                                  <span className="flex items-center gap-1 truncate">
                                    <User className="w-2.5 h-2.5" />
                                    <span className="truncate">
                                      {deal.owner?.name || "Unassigned"}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* New Deal Dialog */}
      <Dialog
        open={isNewDealOpen}
        onOpenChange={(open) => {
          if (!open) setIsNewDealOpen(false);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
            <DialogDescription>
              Initialize a deal opportunity in the Sales Pipeline.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({
                title: formData.title,
                amount: Math.round(Number(formData.amount)) || 0,
                employees: Math.max(1, parseInt(formData.employees) || 1),
                accountId: formData.accountId,
                contactId: formData.contactId || null,
                ownerId: formData.ownerId || null,
                stageId: formData.stageId || null,
              });
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="title">Deal Title *</Label>
              <Input
                id="title"
                required
                placeholder="e.g. Swiggy - HR Stack 2026"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="account">Account *</Label>
                <Select
                  value={formData.accountId}
                  onValueChange={(val) =>
                    setFormData({ ...formData, accountId: val, contactId: "" })
                  }
                  required
                >
                  <SelectTrigger id="account">
                    <SelectValue placeholder="Select Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact">Contact</Label>
                <Select
                  value={formData.contactId}
                  onValueChange={(val) =>
                    setFormData({ ...formData, contactId: val })
                  }
                  disabled={!formData.accountId}
                >
                  <SelectTrigger id="contact">
                    <SelectValue
                      placeholder={
                        filteredContacts.length === 0
                          ? "No contacts found"
                          : "Select Contact"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Deal Amount (₹ Annual)</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="employees">Employee Count *</Label>
                <Input
                  id="employees"
                  type="number"
                  min={1}
                  required
                  value={formData.employees}
                  onChange={(e) =>
                    setFormData({ ...formData, employees: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stage">Initial Stage</Label>
                <Select
                  value={formData.stageId}
                  onValueChange={(val) =>
                    setFormData({ ...formData, stageId: val })
                  }
                >
                  <SelectTrigger id="stage">
                    <SelectValue placeholder="Select Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.probability}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="owner">Deal Owner</Label>
                <Select
                  value={formData.ownerId}
                  onValueChange={(val) =>
                    setFormData({ ...formData, ownerId: val })
                  }
                >
                  <SelectTrigger id="owner">
                    <SelectValue placeholder="Select Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewDealOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white"
                disabled={!formData.title || !formData.accountId || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Deal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
