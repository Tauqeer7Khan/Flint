"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Flame } from "lucide-react";

export default function WaitlistThankYouPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-orange-50/60 via-slate-50 to-white flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8">
      {/* Header Bar */}
      <div className="max-w-3xl mx-auto w-full flex items-center justify-between pb-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#EA580C] flex items-center justify-center text-white shadow-md shadow-orange-500/20">
            <Flame className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-[#0B132B]">
            FLINT
          </span>
        </Link>

        <Link
          href="/login"
          className="text-xs font-semibold text-slate-600 hover:text-[#EA580C] transition-colors"
        >
          Team Sign In →
        </Link>
      </div>

      {/* Main Content */}
      <div className="max-w-xl mx-auto w-full">
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-xl p-6 sm:p-8">
          <div className="text-center py-10 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-slate-900">
                🎉 You&apos;re on the list!
              </h2>
              <p className="text-sm text-slate-600 max-w-sm mx-auto">
                Thank you for registering. Our team will review your application and reach out shortly with exclusive onboarding details.
              </p>
            </div>
            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/waitlist">
                <Button variant="outline" size="sm" className="text-xs">
                  Submit another response
                </Button>
              </Link>
              <Link href="/login">
                <Button size="sm" className="text-xs bg-[#0B132B] hover:bg-[#1C2541] text-white">
                  Go to Sign In
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-400 py-6">
        © 2026 Flint CRM Inc. Empulz ecosystem companion platform.
      </div>
    </div>
  );
}
