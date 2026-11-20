"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type TaskPriority,
  type TaskStatus,
  type CreateTaskInput,
} from "@flint/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
import { connectSocket, getSocket } from "@/lib/socket";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Filter,
  Layers,
  Plus,
  Ticket,
  User,
  Users,
} from "lucide-react";

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  isOverdue?: boolean;
  account_id: string | null;
  account?: { id: string; name: string } | null;
  deal_id: string | null;
  deal?: { id: string; title: string } | null;
  ticket_id: string | null;
  ticket?: { id: string; subject: string } | null;
  assignee_id: string | null;
  assignee?: { id: string; name: string; email: string } | null;
  created_by: string | null;
  creator?: { id: string; name: string } | null;
  created_at: string;
}

interface AccountOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<"my" | "all">("my");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  // New task form state
  const [newTitle, setNewTitle] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newAssigneeId, setNewAssigneeId] = React.useState("");
  const [newDueAt, setNewDueAt] = React.useState("");
  const [newPriority, setNewPriority] = React.useState<TaskPriority>("MEDIUM");
  const [newAccountId, setNewAccountId] = React.useState<string>("");
  const [formError, setFormError] = React.useState<string | null>(null);

  // Socket setup
  React.useEffect(() => {
    connectSocket().catch(() => {});
    const socket = getSocket();
    if (socket) {
      const handleTasksChanged = () => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["tasks-my"] });
      };
      socket.on("tasks:changed", handleTasksChanged);
      return () => {
        socket.off("tasks:changed", handleTasksChanged);
      };
    }
  }, [queryClient]);

  // Fetch current user
  const { data: currentUser } = useQuery<{ id: string; name: string; role: string }>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Failed to load session");
      return res.json();
    },
  });

  // Fetch users for assignee dropdown
  const { data: usersData } = useQuery<UserOption[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });

  // Fetch accounts for task link
  const { data: accountsData } = useQuery<{ items: AccountOption[] }>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Failed to load accounts");
      return res.json();
    },
  });

  const usersList: UserOption[] = Array.isArray(usersData) ? usersData : (usersData as any)?.users || [];
  const accountsList: AccountOption[] = accountsData?.items || (accountsData as any)?.accounts || [];

  // Fetch tasks
  const {
    data: tasksData,
    isLoading,
    isError,
  } = useQuery<{ tasks: TaskItem[] }>({
    queryKey: [activeTab === "my" ? "tasks-my" : "tasks"],
    queryFn: async () => {
      const endpoint = activeTab === "my" ? "/api/tasks/my" : "/api/tasks";
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to load tasks");
      return res.json();
    },
  });

  // Mutation: Create task
  const createMutation = useMutation({
    mutationFn: async (payload: CreateTaskInput) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-my"] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // Mutation: Update status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-my"] });
    },
  });

  const resetForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewAssigneeId(currentUser?.id || "");
    setNewDueAt("");
    setNewPriority("MEDIUM");
    setNewAccountId("");
    setFormError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    if (currentUser?.id) {
      setNewAssigneeId(currentUser.id);
    }
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError("Title is required (min 2 characters)");
      return;
    }
    if (!newAssigneeId) {
      setFormError("Please select an assignee");
      return;
    }
    if (!newDueAt) {
      setFormError("Please select a due date & time");
      return;
    }

    createMutation.mutate({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      assigneeId: newAssigneeId,
      dueAt: new Date(newDueAt).toISOString(),
      priority: newPriority,
      accountId: newAccountId || undefined,
    });
  };

  const tasks = tasksData?.tasks || [];

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case "URGENT":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Urgent</Badge>;
      case "HIGH":
        return <Badge className="bg-orange-50 text-orange-700 border-orange-200">High</Badge>;
      case "MEDIUM":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Medium</Badge>;
      case "LOW":
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Low</Badge>;
      default:
        return <Badge variant="outline">{p}</Badge>;
    }
  };

  const formatDueDate = (iso: string | null) => {
    if (!iso) return "No deadline";
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isTaskOverdue = (task: TaskItem) => {
    if (task.status === "COMPLETED" || task.status === "CANCELLED") return false;
    if (task.isOverdue !== undefined) return task.isOverdue;
    if (!task.due_at) return false;
    return new Date(task.due_at).getTime() < Date.now();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-[#EA580C]" />
            Tasks Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track deliverables, deal action items, and cross-team requests.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white gap-2 font-medium shadow-xs"
        >
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab("my")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === "my"
              ? "bg-[#EA580C]/10 text-[#EA580C]"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          My Tasks
        </button>
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === "all"
              ? "bg-[#EA580C]/10 text-[#EA580C]"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          All Tasks
        </button>
        <div className="ml-auto text-xs text-slate-400 font-medium">
          Showing {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </div>
      </div>

      {/* Tasks List */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading tasks...</div>
      ) : isError ? (
        <div className="py-16 text-center text-sm text-rose-500">Failed to load tasks.</div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No tasks found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeTab === "my"
              ? "You don't have any assigned tasks pending. Create one to stay organized!"
              : "No tasks have been created in the system yet."}
          </p>
          <Button
            onClick={handleOpenCreate}
            variant="outline"
            className="mt-4 text-xs font-semibold"
          >
            Create Task
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const overdue = isTaskOverdue(task);
            const isDone = task.status === "COMPLETED";

            return (
              <div
                key={task.id}
                className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
                  isDone
                    ? "bg-slate-50/60 border-slate-200/80 opacity-75"
                    : overdue
                    ? "bg-rose-50/20 border-rose-200"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                }`}
              >
                {/* Checkbox + Title + Description */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={isDone}
                      onCheckedChange={(checked) => {
                        updateStatusMutation.mutate({
                          id: task.id,
                          status: checked ? "COMPLETED" : "TODO",
                        });
                      }}
                      className="data-[state=checked]:bg-[#EA580C] data-[state=checked]:border-[#EA580C]"
                    />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-semibold truncate ${
                          isDone
                            ? "line-through text-slate-400"
                            : overdue
                            ? "text-rose-900"
                            : "text-slate-900"
                        }`}
                      >
                        {task.title}
                      </span>
                      {overdue && (
                        <Badge className="bg-rose-100 text-rose-700 text-[10px] font-bold border-rose-200 px-1.5 py-0">
                          Overdue
                        </Badge>
                      )}
                      {getPriorityBadge(task.priority)}
                    </div>
                    {task.description && (
                      <p className="text-xs text-slate-500 line-clamp-1">{task.description}</p>
                    )}

                    {/* Linked Entity Pill */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 pt-1 flex-wrap">
                      {task.account && (
                        <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          {task.account.name}
                        </span>
                      )}
                      {task.deal && (
                        <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">
                          <Layers className="w-3 h-3 text-slate-500" />
                          {task.deal.title}
                        </span>
                      )}
                      {task.ticket && (
                        <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">
                          <Ticket className="w-3 h-3 text-slate-500" />
                          {task.ticket.subject}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Due Date + Assignee + Inline Status Dropdown */}
                <div className="flex items-center gap-4 flex-wrap md:flex-nowrap justify-between md:justify-end pl-7 md:pl-0">
                  {/* Due Date */}
                  <div
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      overdue ? "text-rose-600" : "text-slate-500"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDueDate(task.due_at)}</span>
                  </div>

                  {/* Assignee Pill */}
                  <div className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                    <User className="w-3 h-3 text-slate-500" />
                    <span className="truncate max-w-[120px]">
                      {task.assignee?.name || "Unassigned"}
                    </span>
                  </div>

                  {/* Inline Status Dropdown */}
                  <div className="w-[130px]">
                    <Select
                      value={task.status}
                      onValueChange={(val: TaskStatus) => {
                        updateStatusMutation.mutate({ id: task.id, status: val });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODO" className="text-xs">
                          To Do
                        </SelectItem>
                        <SelectItem value="IN_PROGRESS" className="text-xs">
                          In Progress
                        </SelectItem>
                        <SelectItem value="COMPLETED" className="text-xs">
                          Done
                        </SelectItem>
                        <SelectItem value="CANCELLED" className="text-xs">
                          Cancelled
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* + New Task Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#EA580C]" />
              Create New Task
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Assign work to team members with priority and due date.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <Label className="text-xs font-medium text-slate-700">Task Title *</Label>
              <Input
                placeholder="e.g. Prepare security deck for InfoSec review"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Description</Label>
              <Textarea
                placeholder="Optional details or context..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="mt-1 text-xs resize-none"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Assignee *</Label>
                <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersList.map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        {u.name} ({u.role.replace("_", " ")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Priority *</Label>
                <Select
                  value={newPriority}
                  onValueChange={(val: TaskPriority) => setNewPriority(val)}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW" className="text-xs">
                      Low
                    </SelectItem>
                    <SelectItem value="MEDIUM" className="text-xs">
                      Medium
                    </SelectItem>
                    <SelectItem value="HIGH" className="text-xs">
                      High
                    </SelectItem>
                    <SelectItem value="URGENT" className="text-xs">
                      Urgent
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Due Date & Time *</Label>
                <Input
                  type="datetime-local"
                  value={newDueAt}
                  onChange={(e) => setNewDueAt(e.target.value)}
                  className="mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Linked Account</Label>
                <Select
                  value={newAccountId || "none"}
                  onValueChange={(val) => setNewAccountId(val === "none" ? "" : val)}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="None (Optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs text-slate-400">
                      None
                    </SelectItem>
                    {accountsList.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white text-xs font-medium"
              >
                {createMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
