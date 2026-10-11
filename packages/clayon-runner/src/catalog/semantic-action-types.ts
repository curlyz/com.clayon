export type ClayonSemanticActionId =
  | "search_api"
  | "call_api"
  | "set_task_title"
  | "set_task_monitor"
  | "get_task_context"
  | "get_task_history"
  | "list_documents"
  | "read_document"
  | "list_document_revisions"
  | "report_progress"
  | "answer_status_question"
  | "write_document"
  | "request_human_input"
  | "register_deliverable"
  | "finish_task"
  | "block_task"
  | "request_review"
  | "list_agents"
  | "hire_agent"
  | "get_agent"
  | "search_tasks"
  | "list_approvals"
  | "get_approval"
  | "get_approval_context"
  | "get_workspace_runtime"
  | "control_workspace_service"
  | "reassign_task"
  | "set_dependencies"
  | "create_skill"
  | "update_skill"
  | "create_project"
  | "list_project_repositories"
  | "list_projects"
  | "create_task"
  | "request_approval"
  | "decide_approval"
  | "comment_on_approval"
  | "schedule_wake";

export type ClayonSemanticActionPlacement = "always" | "optional";
export type ClayonSemanticActionMode =
  "standard" | "ask" | "planning" | "skill_test";
export type ClayonSemanticActionEffect = "read" | "write" | "governance";

export type ClayonJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly ClayonJsonValue[]
  | { readonly [key: string]: ClayonJsonValue };

/** The JSON Schema subset used by the v1 semantic action catalog. */
export interface ClayonJsonSchema {
  readonly type?: string | readonly string[];
  readonly title?: string;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, ClayonJsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | ClayonJsonSchema;
  readonly items?: ClayonJsonSchema;
  readonly enum?: readonly ClayonJsonValue[];
  readonly oneOf?: readonly ClayonJsonSchema[];
  readonly anyOf?: readonly ClayonJsonSchema[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly pattern?: string;
  readonly format?: string;
  readonly default?: ClayonJsonValue;
}

/**
 * A transport-neutral declaration. Catalog membership never grants discovery
 * or invocation authority; a run-scoped authorization layer must do that.
 */
export interface ClayonSemanticActionDescriptor {
  readonly schema: "clayon.semantic-action.v1";
  readonly operationId: ClayonSemanticActionId;
  readonly version: 1;
  readonly title: string;
  readonly description: string;
  readonly placement: ClayonSemanticActionPlacement;
  readonly effect: ClayonSemanticActionEffect;
  readonly requiredClaims: readonly string[];
  readonly allowedModes: readonly ClayonSemanticActionMode[];
  readonly allowedRoles?: readonly string[];
  readonly inputSchema: ClayonJsonSchema;
  readonly outputSchema: ClayonJsonSchema;
}
