'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginInput, ROLES, Role } from '@flint/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { Flame, ShieldCheck, Briefcase, TrendingUp, Headphones } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [loadingRole, setLoadingRole] = React.useState<Role | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      setAuthError(null);
      await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setAuthError(err.message || 'Login failed. Please check credentials.');
    }
  };

  const handleDemoLogin = async (role: Role) => {
    try {
      setAuthError(null);
      setLoadingRole(role);
      await apiFetch('/auth/demo', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setAuthError(err.message || 'Demo login failed');
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand & Heading */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/25 mb-1">
            <Flame className="w-6 h-6 fill-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0B132B]">
            Sign in to FLINT
          </h1>
          <p className="text-sm text-slate-500">
            Empulz Collaborative CRM • One customer. One view. Every team.
          </p>

          {/* ECG Heartbeat Line Animated SVG */}
          <div className="py-2 flex justify-center">
            <svg
              className="w-56 h-10 overflow-visible"
              viewBox="0 0 300 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0,20 L80,20 L95,20 L105,4 L115,36 L125,12 L135,28 L145,20 L160,20 L300,20"
                stroke="#EA580C"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ecg-path"
              />
            </svg>
          </div>
        </div>

        {/* Card Form */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/60 p-6">
          <CardHeader className="p-0 pb-5">
            <h2 className="text-lg font-bold text-[#0B132B]">
              Standard Credentials
            </h2>
          </CardHeader>

          <CardContent className="p-0 space-y-4">
            {authError && (
              <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="rahul@flint.dev"
                  {...register('email')}
                  disabled={isSubmitting || !!loadingRole}
                />
                {errors.email && (
                  <p className="text-xs text-rose-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  disabled={isSubmitting || !!loadingRole}
                />
                {errors.password && (
                  <p className="text-xs text-rose-600">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold rounded-xl"
                disabled={isSubmitting || !!loadingRole}
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-semibold tracking-wider">
                  Or 1-Click Role Demo
                </span>
              </div>
            </div>

            {/* 4 Demo Login Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-slate-200 text-xs font-semibold hover:border-orange-300 hover:bg-orange-50/50 justify-start"
                onClick={() => handleDemoLogin(ROLES.ADMIN)}
                disabled={isSubmitting || !!loadingRole}
              >
                <ShieldCheck className="w-4 h-4 text-rose-500 mr-2 shrink-0" />
                {loadingRole === ROLES.ADMIN ? 'Loading...' : 'Demo as Admin'}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-slate-200 text-xs font-semibold hover:border-orange-300 hover:bg-orange-50/50 justify-start"
                onClick={() => handleDemoLogin(ROLES.MANAGER)}
                disabled={isSubmitting || !!loadingRole}
              >
                <Briefcase className="w-4 h-4 text-purple-500 mr-2 shrink-0" />
                {loadingRole === ROLES.MANAGER ? 'Loading...' : 'Demo as Manager'}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-slate-200 text-xs font-semibold hover:border-orange-300 hover:bg-orange-50/50 justify-start"
                onClick={() => handleDemoLogin(ROLES.SALES_REP)}
                disabled={isSubmitting || !!loadingRole}
              >
                <TrendingUp className="w-4 h-4 text-blue-500 mr-2 shrink-0" />
                {loadingRole === ROLES.SALES_REP ? 'Loading...' : 'Demo as Sales'}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-slate-200 text-xs font-semibold hover:border-orange-300 hover:bg-orange-50/50 justify-start"
                onClick={() => handleDemoLogin(ROLES.SUPPORT_AGENT)}
                disabled={isSubmitting || !!loadingRole}
              >
                <Headphones className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
                {loadingRole === ROLES.SUPPORT_AGENT ? 'Loading...' : 'Demo as Support'}
              </Button>
            </div>
          </CardContent>

          <CardFooter className="p-0 pt-6 mt-6 border-t border-slate-100 flex justify-center">
            <p className="text-xs text-slate-400 text-center">
              Concept project built by Tauqeer Khan for Empulz
            </p>
          </CardFooter>
        </Card>
      </div>

      <style jsx global>{`
        @keyframes ecgDash {
          0% {
            stroke-dashoffset: 400;
          }
          50% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -400;
          }
        }
        .ecg-path {
          stroke-dasharray: 400;
          animation: ecgDash 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>
    </main>
  );
}
