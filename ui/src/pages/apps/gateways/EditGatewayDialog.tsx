import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ToolMcpGatewayWithTokens, ToolProfileWithDetails } from "@clayon/shared";
import { toolsApi } from "@/api/tools";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SaveStatus } from "@/components/SaveStatus";
import { useAutosave } from "@/hooks/useAutosave";
import { allowedToolsLabel } from "./gateway-helpers";
import { gatewaysQueryKey } from "./NewGatewayDialog";

export function EditGatewayDialog({
  companyId,
  gateway,
  profiles,
  open,
  onOpenChange,
}: {
  companyId: string;
  gateway: ToolMcpGatewayWithTokens;
  profiles: ToolProfileWithDetails[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(gateway.name);
  const [description, setDescription] = useState(gateway.description ?? "");
  const [profileId, setProfileId] = useState(gateway.profileId);

  useEffect(() => {
    if (!open) return;
    setName(gateway.name);
    setDescription(gateway.description ?? "");
    setProfileId(gateway.profileId);
  }, [gateway, open]);

  const activeProfiles = profiles.filter((profile) => profile.status !== "archived");

  // Autosave: edits persist while the dialog is open (an empty name is not
  // saveable, matching the old disabled Save button).
  const autosave = useAutosave({
    value: { name: name.trim(), description: description.trim() || null, profileId },
    savedValue: {
      name: gateway.name.trim(),
      description: gateway.description?.trim() || null,
      profileId: gateway.profileId,
    },
    isEqual: (draft, saved) =>
      draft.name === "" ? true : draft.name === saved.name && draft.description === saved.description && draft.profileId === saved.profileId,
    save: async (draft) => {
      await toolsApi.updateGateway(companyId, gateway.id, draft);
      await queryClient.invalidateQueries({ queryKey: gatewaysQueryKey(companyId) });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Edit gateway</DialogTitle>
            <SaveStatus
              status={autosave.status}
              errorMessage={autosave.errorMessage}
              onRetry={autosave.retry}
            />
          </div>
          <DialogDescription>
            Change the label or the access profile that controls which tools this endpoint exposes.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} onBlur={autosave.flush} autoFocus />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Access profile</span>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
            >
              {activeProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} — {allowedToolsLabel(profile)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Description (optional)</span>
            <textarea
              className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={autosave.flush}
              placeholder="Who this endpoint is for."
            />
          </label>
        </form>
      </DialogContent>
    </Dialog>
  );
}
