import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCloudInstance } from "../hooks/useCloudInstance";
import { companiesApi } from "../api/companies";
import { queryKeys } from "../lib/queryKeys";
import { formatCents, relativeTime } from "../lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Pencil,
  Check,
  X,
  Plus,
  MoreHorizontal,
  Trash2,
  Users,
  CircleDot,
  DollarSign,
  Calendar,
  ArchiveRestore,
} from "lucide-react";

export function Companies() {
  const {
    companies,
    selectedCompanyId,
    setSelectedCompanyId,
    loading,
    error,
  } = useCompany();
  const { openOnboarding } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  // A cloud stack holds exactly one company; creating another is a 403 floor
  // server-side, so the wizard entry point is hidden rather than dead-ending.
  const isCloud = Boolean(useCloudInstance());

  const { data: stats } = useQuery({
    queryKey: queryKeys.companies.stats,
    queryFn: () => companiesApi.stats(),
  });

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const editMutation = useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) =>
      companiesApi.update(id, { name: newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.stats });
      setConfirmDeleteId(null);
    },
  });

  // Unarchiving previously had no UI at all: archiving happens in company
  // settings, but an archived company disappears from the sidebar switcher,
  // so its settings page — and with it any way back — was only reachable by
  // hand-typed URL. This list is the one place that still shows archived
  // companies, so restoration lives here.
  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => companiesApi.update(id, { status: "active" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.stats });
    },
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Organizations" }]);
  }, [setBreadcrumbs]);

  function startEdit(companyId: string, currentName: string) {
    setEditingId(companyId);
    setEditName(currentName);
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    editMutation.mutate({ id: editingId, newName: editName.trim() });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Organizations</h1>
          <Badge variant="secondary">{companies.length}</Badge>
        </div>
        {isCloud ? null : (
          <Button size="sm" onClick={() => openOnboarding()}>
            <Plus />
            New Organization
          </Button>
        )}
      </div>

      <div>
        {loading && <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">Loading organizations...</p>}
        {error && <p className="border-t border-border px-4 py-3 text-sm text-destructive">{error.message}</p>}
      </div>

      <div className="grid gap-x-4 md:grid-cols-2 xl:grid-cols-3">
        {companies.map((company) => {
          const selected = company.id === selectedCompanyId;
          const isEditing = editingId === company.id;
          const isConfirmingDelete = confirmDeleteId === company.id;
          const companyStats = stats?.[company.id];
          const agentCount = companyStats?.agentCount ?? 0;
          const issueCount = companyStats?.issueCount ?? 0;
          const budgetPct =
            company.budgetMonthlyCents > 0
              ? Math.round(
                  (company.spentMonthlyCents / company.budgetMonthlyCents) * 100,
                )
              : 0;

          return (
            <div
              key={company.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedCompanyId(company.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedCompanyId(company.id);
                }
              }}
              className={`group flex min-w-0 cursor-pointer flex-col border-t border-border text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                selected ? "bg-accent/50" : ""
              }`}
            >
              {/* Header row: name + menu */}
              <div className="flex items-start justify-between gap-3 bg-muted/50 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {isEditing ? (
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={saveEdit}
                        disabled={editMutation.isPending}
                      >
                        <Check className="text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="min-w-0 break-words text-base font-semibold">{company.name}</h3>
                      <Badge
                        variant={
                          company.status === "active"
                            ? "secondary"
                            : company.status === "paused"
                              ? "outline"
                              : "ghost"
                        }
                      >
                        {company.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(company.id, company.name);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {company.description && !isEditing && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {company.description}
                    </p>
                  )}
                </div>

                {/* Three-dot menu */}
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => startEdit(company.id, company.name)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Rename
                      </DropdownMenuItem>
                      {company.status === "archived" && (
                        <DropdownMenuItem
                          disabled={unarchiveMutation.isPending}
                          onClick={() => unarchiveMutation.mutate(company.id)}
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                          Unarchive
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setConfirmDeleteId(company.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Organization
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5 px-4 py-3 font-mono">
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {agentCount} {agentCount === 1 ? "agent" : "agents"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-4 py-3 font-mono">
                  <CircleDot className="h-3.5 w-3.5" />
                  <span>
                    {issueCount} {issueCount === 1 ? "task" : "tasks"}
                  </span>
                </div>
                <div className="col-span-2 flex flex-wrap items-center gap-1.5 px-4 py-3 font-mono tabular-nums">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>
                    {formatCents(company.spentMonthlyCents)}
                    {company.budgetMonthlyCents > 0
                      ? <> / {formatCents(company.budgetMonthlyCents)} <span className="text-xs">({budgetPct}%)</span></>
                      : <span className="text-xs ml-1">Unlimited budget</span>}
                  </span>
                </div>
                <div className="col-span-2 flex items-center gap-1.5 px-4 py-3">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Created {relativeTime(company.createdAt)}</span>
                </div>
              </div>

              {/* Delete confirmation */}
              {isConfirmingDelete && (
                <div
                  className="flex flex-col gap-3 border-t border-border bg-destructive/5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="px-4 pt-3 text-sm font-medium text-destructive">
                    Delete this organization and all its data? This cannot be undone.
                  </p>
                  <div className="flex items-center justify-between gap-2 px-4 pb-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={deleteMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(company.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
