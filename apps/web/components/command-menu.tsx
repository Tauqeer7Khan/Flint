"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/format";
import {
  Building2,
  Briefcase,
  Contact,
  Layers,
  Search,
  Sparkles,
  Target,
  User,
  Users,
} from "lucide-react";

interface SearchResults {
  accounts: Array<{
    id: string;
    name: string;
    owner?: { id: string; name: string } | null;
  }>;
  contacts: Array<{
    id: string;
    name: string;
    email: string;
    designation: string | null;
    accountName: string | null;
    account?: { id: string; name: string } | null;
  }>;
  deals: Array<{
    id: string;
    title: string;
    amount: number;
    employees: number;
    stageName: string;
    probability: number;
  }>;
  leads: Array<{
    id: string;
    companyName: string;
    contactName: string;
    status: string;
    source: string;
  }>;
}

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults>({
    accounts: [],
    contacts: [],
    deals: [],
    leads: [],
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Global Cmd+K / Ctrl+K listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Reset when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults({ accounts: [], contacts: [], deals: [], leads: [] });
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search query
  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults({ accounts: [], contacts: [], deals: [], leads: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error("Search fetch failed:", err);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => clearTimeout(timeout);
  }, [query, open]);

  // Flattened items for keyboard navigation
  const flatItems = React.useMemo(() => {
    const list: Array<{ type: "account" | "contact" | "deal" | "lead"; id: string; url: string }> = [];
    (results?.accounts || []).forEach((a) => list.push({ type: "account", id: a.id, url: `/accounts/${a.id}` }));
    (results?.contacts || []).forEach((c) =>
      list.push({
        type: "contact",
        id: c.id,
        url: c.account ? `/accounts/${c.account.id}` : "/contacts",
      })
    );
    (results?.deals || []).forEach((d) => list.push({ type: "deal", id: d.id, url: `/deals/${d.id}` }));
    (results?.leads || []).forEach((l) => list.push({ type: "lead", id: l.id, url: `/leads` }));
    return list;
  }, [results]);

  const handleSelectUrl = (url: string) => {
    onOpenChange(false);
    router.push(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (flatItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = flatItems[selectedIndex];
      if (target) {
        handleSelectUrl(target.url);
      }
    }
  };

  const totalResults =
    results.accounts.length +
    results.contacts.length +
    results.deals.length +
    results.leads.length;

  let currentFlatIdx = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border-slate-200">
        <DialogHeader className="sr-only">
          <DialogTitle>Quick Search</DialogTitle>
        </DialogHeader>

        {/* Search Input Bar */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-white">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search accounts, contacts, deals, leads... (e.g. 'Info', 'Zomto')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full text-sm placeholder:text-slate-400 focus:outline-hidden bg-transparent text-slate-900 font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-xs text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded"
            >
              Clear
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Searching records...</div>
          ) : query.trim().length >= 2 && totalResults === 0 ? (
            <div className="py-12 text-center space-y-1">
              <Search className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <div className="text-xs font-semibold text-slate-700">No matching records found</div>
              <div className="text-[11px] text-slate-400">
                Try searching by company, person name, or deal title.
              </div>
            </div>
          ) : query.trim().length < 2 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Type at least 2 characters to trigger fuzzy search with typo tolerance.
            </div>
          ) : (
            <>
              {/* Accounts */}
              {results.accounts.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    Accounts ({results.accounts.length})
                  </div>
                  {results.accounts.map((a) => {
                    const itemIdx = currentFlatIdx++;
                    const isSelected = selectedIndex === itemIdx;
                    return (
                      <div
                        key={a.id}
                        onClick={() => handleSelectUrl(`/accounts/${a.id}`)}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#EA580C]/10 text-[#EA580C] font-semibold"
                            : "hover:bg-slate-100/70 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{a.name}</span>
                        </div>
                        {a.owner && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            Owner: {a.owner.name}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Contacts */}
              {results.contacts.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 tracking-wider flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-slate-400" />
                    Contacts ({results.contacts.length})
                  </div>
                  {results.contacts.map((c) => {
                    const itemIdx = currentFlatIdx++;
                    const isSelected = selectedIndex === itemIdx;
                    const url = c.account ? `/accounts/${c.account.id}` : "/contacts";
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleSelectUrl(url)}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#EA580C]/10 text-[#EA580C] font-semibold"
                            : "hover:bg-slate-100/70 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{c.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal truncate">
                            ({c.email})
                          </span>
                        </div>
                        {c.accountName && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                            {c.accountName}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Deals */}
              {results.deals.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3 h-3 text-slate-400" />
                    Deals ({results.deals.length})
                  </div>
                  {results.deals.map((d) => {
                    const itemIdx = currentFlatIdx++;
                    const isSelected = selectedIndex === itemIdx;
                    return (
                      <div
                        key={d.id}
                        onClick={() => handleSelectUrl(`/deals/${d.id}`)}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#EA580C]/10 text-[#EA580C] font-semibold"
                            : "hover:bg-slate-100/70 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Briefcase className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{d.title}</span>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-normal">
                            {d.stageName}
                          </span>
                        </div>
                        <span className="font-semibold text-slate-900 shrink-0 pl-2">
                          {formatINR(d.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Leads */}
              {results.leads.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 tracking-wider flex items-center gap-1.5">
                    <Target className="w-3 h-3 text-slate-400" />
                    Leads ({results.leads.length})
                  </div>
                  {results.leads.map((l) => {
                    const itemIdx = currentFlatIdx++;
                    const isSelected = selectedIndex === itemIdx;
                    return (
                      <div
                        key={l.id}
                        onClick={() => handleSelectUrl("/leads")}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#EA580C]/10 text-[#EA580C] font-semibold"
                            : "hover:bg-slate-100/70 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Target className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{l.companyName}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({l.contactName})
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">
                          {l.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <div>PostgreSQL pg_trgm Enabled</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
