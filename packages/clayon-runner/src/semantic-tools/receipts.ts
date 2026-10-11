import { createHash } from "node:crypto";

import type { PrpSemanticToolEnvelope } from "../protocol/replay-contract.js";
import { redactClayonSemanticValue } from "./redaction.js";
import type {
  ClayonSemanticCorrelation,
  ClayonSemanticDenialCode,
  ClayonSemanticSafeReference,
} from "./types.js";

export type ClayonSemanticAuthorizationBoundary =
  | "company"
  | "actor"
  | "active_task"
  | "grant"
  | "governed_action"
  | "lock"
  | "revision";

export type ClayonSemanticToolOutcome =
  "succeeded" | "denied" | "conflict" | "duplicate" | "unavailable" | "failed";

interface SemanticReceiptBase {
  readonly operationId: string;
  readonly callId: string;
  readonly correlation: ClayonSemanticCorrelation;
  readonly idempotencyKey?: string | null;
  readonly content: unknown;
  readonly references?: readonly ClayonSemanticSafeReference[];
  readonly redacted?: boolean;
}

interface SemanticResultReceiptInput extends SemanticReceiptBase {
  readonly outcome: ClayonSemanticToolOutcome;
  readonly code: string;
  readonly retryable: boolean;
  readonly authorizationBoundary: ClayonSemanticAuthorizationBoundary;
  readonly operationReceiptId?: string;
  readonly auditReceiptId?: string;
  readonly currentRevision?: number | string;
  readonly duplicateOfReceiptId?: string;
}

export function createClayonSemanticInputReceipt(
  input: SemanticReceiptBase,
): PrpSemanticToolEnvelope {
  return {
    schema: "paperclip.prp.semantic_tool.v1",
    schemaVersion: 1,
    phase: "input",
    operationId: input.operationId,
    callId: input.callId,
    correlation: { ...input.correlation },
    idempotencyKey: input.idempotencyKey ?? null,
    content: safeContent(input),
  } as PrpSemanticToolEnvelope;
}

export function createClayonSemanticResultReceipt(
  input: SemanticResultReceiptInput,
): PrpSemanticToolEnvelope {
  const operationReceiptId =
    input.operationReceiptId ?? derivedOperationReceiptId(input);
  return {
    schema: "paperclip.prp.semantic_tool.v1",
    schemaVersion: 1,
    phase: "result",
    operationId: input.operationId,
    callId: input.callId,
    correlation: { ...input.correlation },
    idempotencyKey: input.idempotencyKey ?? null,
    content: safeContent(input),
    outcome: input.outcome,
    code: input.code,
    retryable: input.retryable,
    authorizationBoundary: input.authorizationBoundary,
    operationReceiptId,
    ...(input.auditReceiptId === undefined
      ? {}
      : { auditReceiptId: input.auditReceiptId }),
    ...(input.currentRevision === undefined
      ? {}
      : { currentRevision: input.currentRevision }),
    ...(input.duplicateOfReceiptId === undefined
      ? {}
      : { duplicateOfReceiptId: input.duplicateOfReceiptId }),
  } as PrpSemanticToolEnvelope;
}

export function digestClayonSemanticContent(value: unknown): string {
  const safeValue = redactClayonSemanticValue(value);
  return `sha256:${createHash("sha256").update(canonicalJson(safeValue)).digest("hex")}`;
}

export function clayonSemanticAuthorizationBoundary(
  code: string,
): ClayonSemanticAuthorizationBoundary {
  if (code.includes("company")) return "company";
  if (code.includes("actor") || code.includes("role")) return "actor";
  if (code.includes("claim") || code.includes("absent")) return "grant";
  if (
    code.includes("idempotency") ||
    code.includes("revision") ||
    code.includes("receipt")
  ) {
    return "revision";
  }
  if (code.includes("ownership") || code.includes("run_mismatch")) {
    return "lock";
  }
  if (code.includes("interaction") || code.includes("governance")) {
    return "governed_action";
  }
  return "active_task";
}

export function clayonSemanticOutcome(input: {
  readonly ok: boolean;
  readonly code: string;
  readonly duplicate?: boolean;
}): ClayonSemanticToolOutcome {
  if (input.ok) return input.duplicate === true ? "duplicate" : "succeeded";
  if (input.code.includes("conflict")) return "conflict";
  if (input.code === "operation_absent") return "unavailable";
  if (input.code.includes("binding") || input.code.includes("recovery")) {
    return "failed";
  }
  return "denied";
}

export function isClayonSemanticStableId(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= 240 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
  );
}

export function normalizeClayonSemanticReferences(
  references: readonly ClayonSemanticSafeReference[] | undefined,
): readonly ClayonSemanticSafeReference[] {
  if (!Array.isArray(references)) return Object.freeze([]);
  const allowedKinds = new Set<ClayonSemanticSafeReference["kind"]>([
    "task",
    "document_revision",
    "interaction",
    "approval",
    "decision",
    "artifact",
    "work_product",
    "wake",
    "monitor",
    "audit",
    "operation",
  ]);
  const unique = new Map<string, ClayonSemanticSafeReference>();
  for (const reference of references.slice(0, 200)) {
    if (
      typeof reference === "object" &&
      reference !== null &&
      allowedKinds.has(reference.kind) &&
      isClayonSemanticStableId(reference.id)
    ) {
      unique.set(`${reference.kind}:${reference.id}`, {
        kind: reference.kind,
        id: reference.id,
      });
    }
  }
  return Object.freeze([...unique.values()]);
}

function safeContent(input: SemanticReceiptBase) {
  return {
    digest: digestClayonSemanticContent(input.content),
    redactionDisposition: input.redacted === true ? "redacted" : "digest_only",
    references: [...normalizeClayonSemanticReferences(input.references)],
  };
}

function derivedOperationReceiptId(input: SemanticResultReceiptInput): string {
  const identity =
    input.idempotencyKey === undefined || input.idempotencyKey === null
      ? `${input.correlation.runId}:${input.operationId}:${input.callId}`
      : `${input.correlation.runId}:${input.operationId}:${input.idempotencyKey}`;
  return `semantic_receipt:${createHash("sha256").update(identity).digest("hex").slice(0, 32)}`;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function denialRetryable(code: ClayonSemanticDenialCode): boolean {
  return code === "idempotency_in_progress" || code === "binding_failed";
}
