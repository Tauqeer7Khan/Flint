"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AnalyticsOverview } from "@flint/shared";
import { formatINR } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Clock,
  LifeBuoy,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

export default function DashboardPage() {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const { data: overview, isLoading, error } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics-overview"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/overview");
      if (!res.ok) throw new Error("Failed to load analytics overview");
      return res.json();
    },
  });

  if (isLoading || !isMounted) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-80 lg:col-span-2 bg-slate-100 animate-pulse rounded-2xl" />
          <div className="h-80 bg-slate-100 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-rose-900">Failed to load analytics</h3>
        <p className="text-xs text-rose-600 mt-1">Unable to aggregate metrics from CRM database.</p>
      </div>
    );
  }

  const {
    revenueThisMonth,
    conversionRate,
    avgDealSize,
    openTickets,
    slaBreaches,
    forecast,
    repPerformance,
  } = overview;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0B132B]">
            Executive Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Role-scoped operational performance, revenue forecasting, and team delivery metrics.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <Clock className="w-3.5 h-3.5" />
          <span>Real-time DB aggregate</span>
        </div>
      </div>

      {/* 4 Pastel Stat Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Revenue This Month (Green) */}
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-5 shadow-xs transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Revenue This Month
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-950 mt-2 font-mono">
            {formatINR(revenueThisMonth)}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            Closed Won deals in current calendar month
          </div>
        </div>

        {/* Tile 2: Lead Conversion Rate (Pink/Rose) */}
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/60 p-5 shadow-xs transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
              Lead Conversion
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-950 mt-2 font-mono">
            {conversionRate}%
          </div>
          <div className="text-[11px] text-rose-700 font-medium mt-1">
            Converted leads vs total pool
          </div>
        </div>

        {/* Tile 3: Avg Deal Size (Orange) */}
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-5 shadow-xs transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Avg Deal Size
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-950 mt-2 font-mono">
            {formatINR(avgDealSize)}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            Across active &amp; won pipeline deals
          </div>
        </div>

        {/* Tile 4: Open Tickets & SLA Breaches (Blue) */}
        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/60 p-5 shadow-xs transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
              Open Tickets
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <LifeBuoy className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-sky-950 mt-2 font-mono flex items-baseline gap-2">
            <span>{openTickets}</span>
            {slaBreaches > 0 && (
              <span className="text-xs font-bold text-rose-600 bg-rose-100/80 border border-rose-200 px-2 py-0.5 rounded-full">
                🚨 {slaBreaches} SLA breached
              </span>
            )}
          </div>
          <div className="text-[11px] text-sky-700 font-medium mt-1">
            {slaBreaches === 0
              ? "All active tickets within SLA standards"
              : "Requires immediate manager escalation"}
          </div>
        </div>
      </div>

      {/* Main Grid: Forecast BarChart (2 Cols) + Rep Performance (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): 30/60/90 Day Pipeline Forecast */}
        <Card className="rounded-2xl border-slate-200 shadow-xs lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#EA580C]" />
                  Weighted Revenue Forecast
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Stage-bucket proxy: 30d (Negotiation, 75%), 60d (Proposal, 50%), 90d (Demo + Waitlist, 25%/10%)
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[11px] font-mono text-slate-500 bg-slate-50">
                Amount × Probability
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecast} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#64748B", fontSize: 12 }}
                    axisLine={{ stroke: "#CBD5E1" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    axisLine={{ stroke: "#CBD5E1" }}
                    tickLine={false}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(234, 88, 12, 0.05)" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs space-y-1">
                            <div className="font-bold text-slate-900">{data.label} Projection</div>
                            <div className="text-[#EA580C] font-extrabold text-sm">
                              {formatINR(data.value)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Weighted probability sum
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {forecast.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          index === 0
                            ? "#EA580C" // 30d: Primary Empulz orange
                            : index === 1
                            ? "#F97316" // 60d: Orange-500
                            : "#FB923C" // 90d: Orange-400
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Right Column (1 Col): Rep Performance Table */}
        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-700" />
              Rep Leaderboard
            </CardTitle>
            <CardDescription className="text-xs">
              Performance breakdown across Sales Reps and Managers.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {repPerformance.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No sales reps found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-2">Rep</th>
                      <th className="pb-2 text-center">Won</th>
                      <th className="pb-2 text-right">Revenue</th>
                      <th className="pb-2 text-right">Pipeline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {repPerformance.map((rep) => (
                      <tr key={rep.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 font-medium text-slate-800">
                          <div className="truncate max-w-[100px]" title={rep.name}>
                            {rep.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {rep.dealsOwned} deals
                          </div>
                        </td>
                        <td className="py-2.5 text-center font-semibold text-slate-700">
                          {rep.dealsWon}
                        </td>
                        <td className="py-2.5 text-right font-bold text-slate-900">
                          {formatINR(rep.wonAmount)}
                        </td>
                        <td className="py-2.5 text-right font-medium text-[#EA580C]">
                          {formatINR(rep.pipelineValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
