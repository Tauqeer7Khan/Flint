"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreateActivityInput,
  type UserActivityType,
} from "@flint/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  CalendarDays,
  Lock,
  MessageSquareLock,
  Phone,
  Send,
  StickyNote,
  User,
} from "lucide-react";

interface ActivityComposerProps {
  accountId: string;
  dealId?: string;
  contactId?: string;
  ticketId?: string;
  onSuccess?: () => void;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

export function ActivityComposer({
  accountId,
  dealId,
  contactId,
  ticketId,
  onSuccess,
}: ActivityComposerProps) {
  const queryClient = useQueryClient();

  const [type, setType] = React.useState<UserActivityType>("NOTE");
  const [body, setBody] = React.useState("");
  const [isInternal, setIsInternal] = React.useState(false);
  const [mentions, setMentions] = React.useState<string[]>([]);

  // Mention dropdown state
  const [showMentionMenu, setShowMentionMenu] = React.useState(false);
  const [mentionFilter, setMentionFilter] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Fetch users for @mention
  const { data: usersData } = useQuery<UserOption[]>({
    queryKey: ["users-for-mentions"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const users = usersData || [];

  const filteredUsers = React.useMemo(() => {
    if (!mentionFilter) return users;
    return users.filter((u) =>
      u.name.toLowerCase().includes(mentionFilter.toLowerCase())
    );
  }, [users, mentionFilter]);

  // Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateActivityInput) => {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to post activity");
      }
      return res.json();
    },
    onSuccess: () => {
      setBody("");
      setMentions([]);
      setIsInternal(false);
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["account-360", accountId] });
      if (dealId) {
        queryClient.invalidateQueries({ queryKey: ["deal-activities", dealId] });
      }
      onSuccess?.();
    },
  });

  // Handle Textarea change & detecting `@` for mention trigger
  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_\s]*)$/);

    if (match) {
      setShowMentionMenu(true);
      setMentionFilter(match[1]);
    } else {
      setShowMentionMenu(false);
      setMentionFilter("");
    }
  };

  const handleSelectMention = (user: UserOption) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = body.slice(0, cursorPos);
    const textAfterCursor = body.slice(cursorPos);

    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex !== -1) {
      const newTextBefore = textBeforeCursor.slice(0, atIndex) + `@${user.name} `;
      const newBody = newTextBefore + textAfterCursor;
      setBody(newBody);

      if (!mentions.includes(user.id)) {
        setMentions([...mentions, user.id]);
      }
    }

    setShowMentionMenu(false);
    setMentionFilter("");
    textareaRef.current.focus();
  };

  // Coerce internal state when type changes
  const handleTypeChange = (newType: UserActivityType) => {
    setType(newType);
    if (newType === "INTERNAL_COMMENT") {
      setIsInternal(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    createMutation.mutate({
      type,
      body: body.trim(),
      isInternal: type === "INTERNAL_COMMENT" ? true : isInternal,
      mentions,
      accountId,
      dealId: dealId || null,
      contactId: contactId || null,
      ticketId: ticketId || null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-2xl border p-4 shadow-xs transition-colors relative ${
        type === "INTERNAL_COMMENT" || isInternal
          ? "border-purple-200 bg-purple-50/40"
          : "border-slate-200 bg-white"
      }`}
    >
      {/* Type Selector Tabs */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <button
          type="button"
          onClick={() => handleTypeChange("NOTE")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            type === "NOTE"
              ? "bg-[#EA580C] text-white shadow-2xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <StickyNote className="w-3.5 h-3.5" />
          Note
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange("CALL")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            type === "CALL"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          Call Log
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange("MEETING")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            type === "MEETING"
              ? "bg-blue-600 text-white shadow-2xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Meeting
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange("INTERNAL_COMMENT")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            type === "INTERNAL_COMMENT"
              ? "bg-purple-600 text-white shadow-2xs"
              : "bg-purple-100 text-purple-700 hover:bg-purple-200"
          }`}
        >
          <MessageSquareLock className="w-3.5 h-3.5" />
          Internal Comment
        </button>
      </div>

      {/* Textarea with Mention detection */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          required
          rows={3}
          placeholder={
            type === "INTERNAL_COMMENT"
              ? "Leave an internal team comment (type @ to notify a team member)..."
              : "Log activity details (type @ to mention a team member)..."
          }
          value={body}
          onChange={handleBodyChange}
          className="text-xs sm:text-sm resize-none bg-white border-slate-200 focus:border-[#EA580C]"
        />

        {/* Floating @mention autocomplete menu */}
        {showMentionMenu && filteredUsers.length > 0 && (
          <div className="absolute left-2 bottom-full mb-1 z-50 w-56 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Mention Team Member
            </div>
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelectMention(u)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-orange-50 hover:text-[#EA580C] flex items-center justify-between transition-colors"
              >
                <span className="font-medium text-slate-800">{u.name}</span>
                <span className="text-[10px] text-slate-400">{u.role}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom controls: Internal toggle + Submit */}
      <div className="flex items-center justify-between pt-3">
        {type !== "INTERNAL_COMMENT" ? (
          <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
            <Checkbox
              checked={isInternal}
              onCheckedChange={(val) => setIsInternal(Boolean(val))}
            />
            <span className="text-slate-600 font-medium flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-400" />
              Mark as Internal
            </span>
          </label>
        ) : (
          <span className="text-[11px] text-purple-700 font-medium flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Visible to internal team only
          </span>
        )}

        <Button
          type="submit"
          size="sm"
          disabled={!body.trim() || createMutation.isPending}
          className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white shadow-xs"
        >
          <Send className="w-3.5 h-3.5 mr-1.5" />
          {createMutation.isPending ? "Posting..." : "Log Activity"}
        </Button>
      </div>
    </form>
  );
}
