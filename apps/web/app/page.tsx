import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/format";
import { TrendingUp, Users, DollarSign, LifeBuoy } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-4xl space-y-8">
        {/* Centered White Rounded-2xl Card */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50 p-4">
          <CardHeader className="text-center space-y-2">
            <div className="inline-flex items-center justify-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-orange-100 text-[#EA580C] mx-auto">
              Collaborative CRM
            </div>
            <CardTitle className="text-4xl font-extrabold tracking-tight text-[#0B132B]">
              FLINT
            </CardTitle>
            <CardDescription className="text-base text-slate-600 max-w-lg mx-auto">
              One customer. One view. Every team. Designed specifically for Empulz B2B SaaS operations.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {/* Row of 4 Pastel Stat Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Green pastel tile */}
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100/80 p-5 space-y-2">
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="text-xs font-semibold uppercase tracking-wider">Revenue (Month)</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-emerald-950">
                  {formatINR(1250000)}
                </div>
                <p className="text-xs text-emerald-700 font-medium">↑ 14% vs last month</p>
              </div>

              {/* Blue pastel tile */}
              <div className="rounded-2xl bg-sky-50 border border-sky-100/80 p-5 space-y-2">
                <div className="flex items-center justify-between text-sky-700">
                  <span className="text-xs font-semibold uppercase tracking-wider">Conversion Rate</span>
                  <TrendingUp className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-2xl font-bold text-sky-950">
                  24.8%
                </div>
                <p className="text-xs text-sky-700 font-medium">Waitlist to pilot</p>
              </div>

              {/* Orange pastel tile */}
              <div className="rounded-2xl bg-orange-50 border border-orange-100/80 p-5 space-y-2">
                <div className="flex items-center justify-between text-[#EA580C]">
                  <span className="text-xs font-semibold uppercase tracking-wider">Avg Deal Size</span>
                  <Users className="w-4 h-4 text-[#EA580C]" />
                </div>
                <div className="text-2xl font-bold text-orange-950">
                  {formatINR(240000)}
                </div>
                <p className="text-xs text-[#EA580C] font-medium">500 avg seats</p>
              </div>

              {/* Pink/Purple pastel tile */}
              <div className="rounded-2xl bg-purple-50 border border-purple-100/80 p-5 space-y-2">
                <div className="flex items-center justify-between text-purple-700">
                  <span className="text-xs font-semibold uppercase tracking-wider">Open Tickets</span>
                  <LifeBuoy className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-purple-950">
                  3 Active
                </div>
                <p className="text-xs text-purple-700 font-medium">0 SLA breaches</p>
              </div>
            </div>

            {/* Action Area */}
            <div className="flex justify-center pt-2">
              <Button size="lg" className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold rounded-xl px-8 shadow-md shadow-orange-500/20">
                Launch CRM Demo
              </Button>
            </div>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-slate-100 pt-6 mt-4">
            <p className="text-xs text-slate-500">
              Concept project built by Tauqeer Khan for Empulz
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
