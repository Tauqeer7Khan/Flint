"use client";

import * as React from "react";
import Link from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreateQuoteInput,
} from "@flint/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Timeline, type ActivityItem } from "@/components/timeline";
import { ActivityComposer } from "@/components/activity-composer";
import { PresencePill } from "@/components/presence-pill";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  History,
  Plus,
  Receipt,
  Sparkles,
  TrendingUp,
  User,
  Users,
} from "lucide-react";

interface PipelineStage {
  id: string;
  name: string;
  probability: number;
  order_index: number;
}

interface StageHistory {
  id: string;
  from_stage: PipelineStage | null;
  to_stage: PipelineStage;
  user: { id: string; name: string } | null;
  changed_at: string;
}

interface DealDetail {
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
  owner?: { id: string; name: string; email: string } | null;
  stage_history: StageHistory[];
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  price_per_employee_month: number;
  is_active: boolean;
}

interface QuoteDocument {
  id: string;
  type: string;
  number: string;
  monthly_total: number;
  annual_total: number;
  created_at: string;
  items: {
    id: string;
    qty: number;
    unit_price: number;
    product: { id: string; name: string; price_per_employee_month: number };
  }[];
}

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = String(params?.id);
  const queryClient = useQueryClient();

  // Socket listener for live updates
  React.useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    connectSocket()
      .then((socket) => {
        if (!mounted) return;
        const handleDealsChanged = () => {
          queryClient.invalidateQueries({ queryKey: ["deal", dealId] });
          queryClient.invalidateQueries({ queryKey: ["deal-quotes", dealId] });
          queryClient.invalidateQueries({ queryKey: ["deal-activities", dealId] });
          queryClient.invalidateQueries({ queryKey: ["deal-alerts", dealId] });
        };
        socket.on("deals:changed", handleDealsChanged);
        socket.on("activity:new", handleDealsChanged);
        socket.on("activities:changed", handleDealsChanged);
        socket.on("tickets:changed", handleDealsChanged);

        cleanup = () => {
          socket.off("deals:changed", handleDealsChanged);
          socket.off("activity:new", handleDealsChanged);
          socket.off("activities:changed", handleDealsChanged);
          socket.off("tickets:changed", handleDealsChanged);
        };
      })
      .catch(() => {});

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [dealId, queryClient]);

  // Query Cross-Team Alerts
  const { data: alertsData } = useQuery<{
    hasHighPriorityTicket: boolean;
    ticket?: {
      id: string;
      subject: string;
      priority: string;
      status: string;
    } | null;
  }>({
    queryKey: ["deal-alerts", dealId],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}/alerts`);
      if (!res.ok) throw new Error("Failed to fetch deal alerts");
      return res.json();
    },
  });

  // Query Activities for Deal
  const { data: activitiesData } = useQuery<{ items: ActivityItem[] }>({
    queryKey: ["deal-activities", dealId],
    queryFn: async () => {
      const res = await fetch(`/api/activities?dealId=${dealId}`);
      if (!res.ok) throw new Error("Failed to fetch deal activities");
      return res.json();
    },
  });

  const activities = activitiesData?.items || [];

  // Query Deal
  const {
    data: deal,
    isLoading: dealLoading,
    error: dealError,
  } = useQuery<DealDetail>({
    queryKey: ["deal", dealId],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}`);
      if (!res.ok) throw new Error("Failed to fetch deal details");
      return res.json();
    },
  });

  // Query Quotes for Deal
  const { data: quotesData } = useQuery<{ items: QuoteDocument[] }>({
    queryKey: ["deal-quotes", dealId],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}/quotes`);
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    },
  });

  // Query Products
  const { data: productsData } = useQuery<{ items: Product[] }>({
    queryKey: ["products-active"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  // Query Pipeline Stages
  const { data: stagesData } = useQuery<{ items: Array<{ id: string; name: string; probability: number }> }>({
    queryKey: ["pipeline-stages"],
    queryFn: async () => {
      const res = await fetch("/api/pipeline/stages");
      if (!res.ok) throw new Error("Failed to fetch stages");
      return res.json();
    },
  });

  const quotes = quotesData?.items || [];
  const products = productsData?.items || [];
  const stages = stagesData?.items || [];

  // Stage change mutation (fallback/alternative to drag-and-drop)
  const changeStageMutation = useMutation({
    mutationFn: async (stageId: string) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal", dealId] });
      queryClient.invalidateQueries({ queryKey: ["deal-alerts", dealId] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });

  // Quote Dialog state
  const [isQuoteOpen, setIsQuoteOpen] = React.useState(false);
  const [quoteEmployees, setQuoteEmployees] = React.useState<number>(100);
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
  const [updateDealAmount, setUpdateDealAmount] = React.useState<boolean>(true);

  // Initialize quote dialog values when opened
  const handleOpenQuoteDialog = () => {
    setQuoteEmployees(deal?.employees || 100);
    // Default pick first 2 products if none selected
    if (selectedProductIds.length === 0 && products.length > 0) {
      setSelectedProductIds(products.slice(0, 2).map((p) => p.id));
    }
    setIsQuoteOpen(true);
  };

  // Live calculation of quote totals
  const quoteMonthlyTotal = React.useMemo(() => {
    const sumPrice = selectedProductIds.reduce((sum, pid) => {
      const found = products.find((p) => p.id === pid);
      return sum + (found ? found.price_per_employee_month : 0);
    }, 0);
    return quoteEmployees * sumPrice;
  }, [selectedProductIds, quoteEmployees, products]);

  const quoteAnnualTotal = React.useMemo(() => {
    return quoteMonthlyTotal * 12;
  }, [quoteMonthlyTotal]);

  // Mutation to create quote
  const quoteMutation = useMutation({
    mutationFn: async (payload: CreateQuoteInput) => {
      const res = await fetch(`/api/deals/${dealId}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create quote");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal", dealId] });
      queryClient.invalidateQueries({ queryKey: ["deal-quotes", dealId] });
      setIsQuoteOpen(false);
    },
  });

  if (dealLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-slate-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-96 md:col-span-2 bg-slate-100 animate-pulse rounded-2xl" />
          <div className="h-96 bg-slate-100 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (dealError || !deal) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center max-w-lg mx-auto my-12">
        <p className="text-red-700 font-semibold mb-4">Deal not found or access restricted.</p>
        <Button onClick={() => router.push("/deals")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Pipeline
        </Button>
      </div>
    );
  }

  const isWon = deal.stage.probability === 100;
  const isLost = deal.stage.probability === 0;
  const weightedAmount = (deal.amount * deal.stage.probability) / 100;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Button
          onClick={() => router.push("/deals")}
          variant="ghost"
          size="sm"
          className="text-slate-500 hover:text-slate-900 -ml-2 mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Pipeline
        </Button>
      </div>

      {/* Cross-Team Alert Banner */}
      {alertsData?.hasHighPriorityTicket && alertsData.ticket && (
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
                Account has an open {alertsData.ticket.priority} priority ticket: &ldquo;{alertsData.ticket.subject}&rdquo;
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/tickets/${alertsData.ticket!.id}`)}
            className="bg-white hover:bg-red-100 border-red-300 text-red-800 text-xs font-semibold shrink-0 cursor-pointer"
          >
            View Ticket #{alertsData.ticket.id.slice(-6).toUpperCase()} →
          </Button>
        </div>
      )}

      {/* Main Deal Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {deal.title}
              </h1>
              <Badge
                variant="outline"
                className={`font-semibold text-xs px-2.5 py-0.5 ${
                  isWon
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : isLost
                    ? "bg-slate-100 text-slate-600 border-slate-300"
                    : "bg-orange-50 text-[#EA580C] border-orange-300"
                }`}
              >
                {deal.stage.name} ({deal.stage.probability}%)
              </Badge>
              {stages.length > 0 && (
                <div className="w-36">
                  <Select
                    value={deal.stage_id}
                    onValueChange={(stageId) => changeStageMutation.mutate(stageId)}
                  >
                    <SelectTrigger
                      aria-label="Change deal stage"
                      data-testid="stage-selector"
                      className="h-6 text-[11px] px-2 py-0 border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                    >
                      <SelectValue placeholder="Change Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.name} ({s.probability}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <PresencePill pageType="deal" pageId={deal.id} />
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="font-medium text-slate-700">{deal.account?.name}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" />
                <span>{deal.employees} employees</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" />
                <span>Owner: {deal.owner?.name || "Unassigned"}</span>
              </span>
              {deal.contact && (
                <>
                  <span>•</span>
                  <span>Contact: {deal.contact.name} ({deal.contact.email})</span>
                </>
              )}
            </div>
          </div>

          {/* Deal Value Pill */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-right min-w-[200px]">
            <div className="text-xs text-slate-500">Annual Deal Value</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {formatINR(deal.amount)}
            </div>
            <div className="text-[11px] text-[#EA580C] font-medium mt-0.5 flex items-center justify-end gap-1">
              <TrendingUp className="w-3 h-3" />
              weighted: {formatINR(weightedAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Quotes Card + Stage History Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Quotes Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#EA580C]" />
                  Official Quotes ({quotes.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Server-computed seat quotes with granular Empulz module pricing.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={handleOpenQuoteDialog}
                className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                New Quote
              </Button>
            </CardHeader>
            <CardContent>
              {quotes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs">
                  No quotes generated yet for this deal. Click &quot;New Quote&quot; to build an official quote.
                </div>
              ) : (
                <div className="space-y-3">
                  {quotes.map((quote) => (
                    <div
                      key={quote.id}
                      className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded">
                            {quote.number}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(quote.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-slate-900">
                            {formatINR(quote.annual_total)} / yr
                          </span>
                          <span className="text-xs text-slate-500 ml-2 font-mono">
                            ({formatINR(quote.monthly_total)} / mo)
                          </span>
                        </div>
                      </div>

                      {/* Line Items */}
                      <div className="space-y-1 mt-2">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Included Products
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {quote.items.map((item) => (
                            <div
                              key={item.id}
                              className="text-xs flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-100"
                            >
                              <span className="font-medium text-slate-800">
                                {item.product.name}
                              </span>
                              <span className="text-slate-500 font-mono text-[11px]">
                                {item.qty} seats × ₹{item.unit_price}/mo
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Stage History Card */}
        <div className="space-y-4">
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-600" />
                Stage Audit Trail
              </CardTitle>
              <CardDescription className="text-xs">
                History of pipeline progression and stage transitions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deal.stage_history.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-6">
                  Initial stage. No subsequent stage transitions recorded.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {deal.stage_history.map((hist) => (
                    <div key={hist.id} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#EA580C] ring-4 ring-orange-50" />
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                          <span className="text-slate-500">
                            {hist.from_stage?.name || "Initial"}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-900">
                            {hist.to_stage.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(hist.changed_at).toLocaleString("en-IN", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                          {hist.user && <span>by {hist.user.name}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Deal Activity Stream & Collaboration Section */}
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#EA580C]" />
            Deal Activity & Collaboration
          </CardTitle>
          <CardDescription className="text-xs">
            Notes, calls, meetings, internal team discussions, and system logs linked to this deal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ActivityComposer
            accountId={deal.account_id}
            dealId={deal.id}
            contactId={deal.contact_id || undefined}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["deal-activities", dealId] });
            }}
          />
          <Timeline
            activities={activities}
            emptyMessage="No activities or comments logged specifically for this deal yet."
          />
        </CardContent>
      </Card>

      {/* New Quote Dialog */}
      <Dialog
        open={isQuoteOpen}
        onOpenChange={(open) => {
          if (!open) setIsQuoteOpen(false);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#EA580C]" />
              Build Interactive Quote
            </DialogTitle>
            <DialogDescription>
              Select employee seat count and module products. Pricing is computed server-side from active catalog rates.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedProductIds.length === 0) return;
              quoteMutation.mutate({
                employees: Number(quoteEmployees),
                productIds: selectedProductIds,
                updateDealAmount,
              });
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="employees">Employee Count (Seats) *</Label>
              <Input
                id="employees"
                type="number"
                min={1}
                required
                value={quoteEmployees}
                onChange={(e) =>
                  setQuoteEmployees(Math.max(1, parseInt(e.target.value) || 1))
                }
              />
            </div>

            {/* Products Checklist */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold text-slate-800">
                  Select Empulz Products
                </Label>
                <span className="text-xs text-slate-500 font-mono">
                  {selectedProductIds.length} modules selected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50/50">
                {products.map((p) => {
                  const isChecked = selectedProductIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-white text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(val) => {
                            if (val) {
                              setSelectedProductIds([...selectedProductIds, p.id]);
                            } else {
                              setSelectedProductIds(
                                selectedProductIds.filter((id) => id !== p.id)
                              );
                            }
                          }}
                        />
                        <span className="font-medium text-slate-800">{p.name}</span>
                      </div>
                      <span className="text-slate-500 font-mono">
                        ₹{p.price_per_employee_month}/mo
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Live Pricing Summary Banner */}
            <div className="rounded-xl bg-[#0B132B] text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-300">Live Calculated Quote</div>
                <div className="text-2xl font-bold tracking-tight text-white mt-0.5">
                  {formatINR(quoteAnnualTotal)} / year
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Monthly: {formatINR(quoteMonthlyTotal)} ({quoteEmployees} seats)
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#EA580C]/20 text-[#EA580C] flex items-center justify-center font-bold text-lg shrink-0">
                ₹
              </div>
            </div>

            {/* Checkbox: Update deal amount */}
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="updateDealAmount"
                checked={updateDealAmount}
                onCheckedChange={(val) => setUpdateDealAmount(Boolean(val))}
              />
              <Label
                htmlFor="updateDealAmount"
                className="text-xs text-slate-700 cursor-pointer font-medium"
              >
                Update deal amount ({formatINR(quoteAnnualTotal)}) and employee count ({quoteEmployees}) with this quote
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsQuoteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white"
                disabled={selectedProductIds.length === 0 || quoteMutation.isPending}
              >
                {quoteMutation.isPending ? "Generating Quote..." : "Save Quote"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
