"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { waitlistSchema, type WaitlistInput, MODULES } from "@flint/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Building2,
  CheckCircle2,
  Flame,
  Layers,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";

export default function WaitlistPage() {
  const router = useRouter();
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<WaitlistInput>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      name: "",
      email: "",
      companyName: "",
      companySize: "" as any,
      currentHrTool: "",
      interestedModules: [],
      hrContactDesignation: "",
      consent: true,
      website: "", // Honeypot
    },
  });

  const selectedModules = watch("interestedModules") || [];
  const consent = watch("consent");

  const onSubmit = async (data: WaitlistInput) => {
    try {
      setErrorMessage(null);
      const res = await fetch("/api/public/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.status === 429) {
        setErrorMessage("Too many attempts, please try again in a minute.");
        return;
      }

      const resData = await res.json();
      if (!res.ok) {
        setErrorMessage(resData.error || resData.details || "Something went wrong. Please check your inputs.");
        return;
      }

      setIsSuccess(true);
      router.push("/waitlist/thank-you");
    } catch (err: any) {
      setErrorMessage(err.message || "Network error. Please try again.");
    }
  };

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
        {/* Hero Section */}
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-[#EA580C] border border-orange-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Early Access Program</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0B132B]">
            Join the Waitlist
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto">
            The employee experience platform your teams deserve. Launching soon.
          </p>
        </div>

        {/* Card Form or Success Screen */}
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-xl p-6 sm:p-8">
          {isSuccess ? (
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
              <div className="pt-4">
                <Button
                  onClick={() => setIsSuccess(false)}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Submit another response
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {errorMessage && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
                  {errorMessage}
                </div>
              )}

              {/* Honeypot Field (Off-screen, tabIndex -1, aria-hidden) */}
              <div
                style={{
                  position: "absolute",
                  left: "-9999px",
                  opacity: 0,
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              >
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  {...register("website")}
                />
              </div>

              {/* Row 1: Name & Work Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
                    Full Name *
                  </Label>
                  <Input
                    id="name"
                    placeholder="Aditi Rao"
                    {...register("name")}
                    className="text-xs bg-slate-50/50 focus:bg-white"
                  />
                  {errors.name && (
                    <p className="text-[11px] text-rose-500 font-medium">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    Work Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="aditi@zomato.com"
                    {...register("email")}
                    className="text-xs bg-slate-50/50 focus:bg-white"
                  />
                  {errors.email && (
                    <p className="text-[11px] text-rose-500 font-medium">{errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Row 2: Company Name & Size */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="companyName" className="text-xs font-semibold text-slate-700">
                    Company Name *
                  </Label>
                  <Input
                    id="companyName"
                    placeholder="Zomato Feeding India"
                    {...register("companyName")}
                    className="text-xs bg-slate-50/50 focus:bg-white"
                  />
                  {errors.companyName && (
                    <p className="text-[11px] text-rose-500 font-medium">{errors.companyName.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="companySize" className="text-xs font-semibold text-slate-700">
                    Company Size (Employees) *
                  </Label>
                  <Input
                    id="companySize"
                    type="number"
                    min={1}
                    placeholder="500"
                    {...register("companySize")}
                    className="text-xs bg-slate-50/50 focus:bg-white"
                  />
                  {errors.companySize && (
                    <p className="text-[11px] text-rose-500 font-medium">{errors.companySize.message}</p>
                  )}
                </div>
              </div>

              {/* Row 3: Current HR Tool & Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="currentHrTool" className="text-xs font-semibold text-slate-700">
                    Current HR Tool <span className="text-slate-400 font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="currentHrTool"
                    placeholder="Darwinbox / Keka / Greytip"
                    {...register("currentHrTool")}
                    className="text-xs bg-slate-50/50 focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="hrContactDesignation" className="text-xs font-semibold text-slate-700">
                    Your Designation <span className="text-slate-400 font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="hrContactDesignation"
                    placeholder="VP People / HR Director"
                    {...register("hrContactDesignation")}
                    className="text-xs bg-slate-50/50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Modules Checklist */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Interested Modules <span className="text-slate-400 font-normal">(Select all that apply)</span>
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50/40">
                  {MODULES.map((mod) => {
                    const isChecked = selectedModules.includes(mod.name);
                    return (
                      <label
                        key={mod.name}
                        className="flex items-center space-x-2 text-xs p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setValue("interestedModules", [...selectedModules, mod.name]);
                            } else {
                              setValue(
                                "interestedModules",
                                selectedModules.filter((m) => m !== mod.name)
                              );
                            }
                          }}
                        />
                        <span className="font-medium text-slate-700">{mod.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Consent Checkbox */}
              <div className="pt-2">
                <label className="flex items-start space-x-2.5 text-xs text-slate-600 cursor-pointer select-none">
                  <Checkbox
                    checked={consent}
                    onCheckedChange={(val) => setValue("consent", Boolean(val) as any)}
                    className="mt-0.5"
                  />
                  <span>
                    I agree to be contacted about Empulz updates, product launches, and exclusive early access offers. *
                  </span>
                </label>
                {errors.consent && (
                  <p className="text-[11px] text-rose-500 font-medium mt-1">
                    {errors.consent.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#EA580C] hover:bg-[#EA580C]/90 text-white font-semibold text-sm shadow-md shadow-orange-500/20 h-10 rounded-xl"
              >
                {isSubmitting ? "Registering..." : "Join the Waitlist"}
              </Button>
            </form>
          )}
        </Card>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-slate-500">
        Concept project built by <span className="font-semibold text-slate-700">Tauqeer Khan</span> for Empulz
      </footer>
    </div>
  );
}
