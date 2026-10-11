import type { PluginEvent } from "@clayon/plugin-sdk";

export interface ActivityPublication {
  companyId: string;
  payload: Record<string, unknown>;
  pluginEvent: PluginEvent | null;
}
