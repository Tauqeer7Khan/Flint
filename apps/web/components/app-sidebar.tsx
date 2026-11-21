'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UserPlus,
  Building2,
  Users,
  BarChart3,
  LifeBuoy,
  CheckSquare,
  GitBranch,
  Settings,
  Flame,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Leads', href: '/leads', icon: UserPlus },
  { name: 'Accounts', href: '/accounts', icon: Building2 },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Deals', href: '/deals', icon: BarChart3 },
  { name: 'Tickets', href: '/tickets', icon: LifeBuoy },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Workflows', href: '/workflows', icon: GitBranch },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface AppSidebarProps {
  userRole?: string;
}

export function AppSidebar({ userRole }: AppSidebarProps) {
  const pathname = usePathname();
  const [role, setRole] = React.useState<string | undefined>(userRole);

  React.useEffect(() => {
    if (userRole) {
      setRole(userRole);
    } else {
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((u) => {
          if (u?.role) setRole(u.role);
        })
        .catch(() => {});
    }
  }, [userRole]);

  const filteredNavItems = navItems.filter((item) => {
    if (item.name === 'Workflows' && (role === 'SALES_REP' || role === 'SUPPORT_AGENT')) {
      return false;
    }
    return true;
  });

  return (
    <aside className="w-64 border-r border-slate-200/80 bg-white flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand header */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-sm shadow-orange-500/30">
            <Flame className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="font-extrabold text-lg tracking-tight text-[#0B132B]">
              FLINT
            </div>
            <div className="text-[10px] font-semibold text-orange-600 uppercase tracking-widest -mt-1">
              Empulz CRM
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="p-3 space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-50 text-[#EA580C] font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#EA580C]' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer info */}
      <div className="p-4 border-t border-slate-100">
        <p className="text-[11px] text-slate-400 leading-tight">
          Concept CRM by Tauqeer Khan for Empulz
        </p>
      </div>
    </aside>
  );
}
