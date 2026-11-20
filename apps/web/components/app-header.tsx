'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SessionUser } from '@flint/shared';
import { LiveStatus } from './live-status';
import { NotificationBell } from './notification-bell';
import { CommandMenu } from './command-menu';
import { Button } from './ui/button';
import { LogOut, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface AppHeaderProps {
  user: SessionUser;
}

export function AppHeader({ user }: AppHeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await apiFetch('/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
      window.location.href = '/login';
    } finally {
      setLoggingOut(false);
    }
  };

  const roleLabels: Record<string, string> = {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    SALES_REP: 'Sales Rep',
    SUPPORT_AGENT: 'Support Agent',
  };

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-rose-100 text-rose-800 border-rose-200',
    MANAGER: 'bg-purple-100 text-purple-800 border-purple-200',
    SALES_REP: 'bg-blue-100 text-blue-800 border-blue-200',
    SUPPORT_AGENT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };

  return (
    <>
      <header className="h-16 px-8 border-b border-slate-200/80 bg-white flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <LiveStatus />

          {/* Quick Search trigger button */}
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="hidden md:flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-400 bg-slate-50 hover:bg-slate-100/80 hover:text-slate-600 border border-slate-200 rounded-xl transition-colors cursor-pointer select-none"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">Search accounts, deals, contacts...</span>
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded shadow-2xs font-semibold">
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Notifications dropdown bell */}
          <NotificationBell />

          <div className="h-5 w-px bg-slate-200" />

          {/* User profile pill */}
          <div className="flex items-center gap-3 text-right">
            <div>
              <div className="text-sm font-semibold text-[#0B132B]">
                {user.name}
              </div>
              <div className="text-xs text-slate-500">
                {user.email}
              </div>
            </div>
            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                roleColors[user.role] || 'bg-slate-100 text-slate-800'
              }`}
            >
              {roleLabels[user.role] || user.role}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            Logout
          </Button>
        </div>
      </header>

      {/* Global Command Menu */}
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
