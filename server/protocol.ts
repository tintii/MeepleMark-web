import { z } from "zod";
import type { EntityType } from "../src/shared/documents";

export const PROTOCOL_VERSION = 1;
export const MAX_JSON_BODY_BYTES = 1_048_576;
export const MAX_CHANGE_PAGE_SIZE = 200;
export const DEFAULT_CHANGE_PAGE_SIZE = 100;
export const MAX_ADOPTION_BATCH_SIZE = 100;

export const usernameSchema = z.string().trim().min(3).max(64).regex(/^[\p{L}\p{N}._-]+$/u);
export const passwordSchema = z.string().min(12).max(1024);
export const setupRequestSchema = z.object({ code: z.string().min(20).max(512), password: passwordSchema }).strict();
export const loginRequestSchema = z.object({ username: usernameSchema, password: z.string().min(1).max(1024) }).strict();
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(1024), newPassword: passwordSchema }).strict();

export const syncContextSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  installationId: z.string().uuid(),
  recoveryEpoch: z.string().uuid(),
  accountId: z.string().uuid(),
}).strict();

export const entityTypeSchema = z.enum(["game", "player", "play"] satisfies EntityType[]);
export const mutationSchema = z.object({
  mutationId: z.string().uuid(),
  entityType: entityTypeSchema,
  entityId: z.string().uuid(),
  baseRevision: z.number().int().min(0),
  operation: z.enum(["put", "delete"]),
  document: z.record(z.string(), z.unknown()).optional(),
}).strict().superRefine((mutation, context) => {
  if (mutation.operation === "put" && mutation.document === undefined) {
    context.addIssue({ code: "custom", path: ["document"], message: "put mutations require a document" });
  }
  if (mutation.operation === "delete" && mutation.document !== undefined) {
    context.addIssue({ code: "custom", path: ["document"], message: "delete mutations cannot include a document" });
  }
});

export const mutationRequestSchema = z.object({ context: syncContextSchema, mutation: mutationSchema }).strict();
export const changePageQuerySchema = z.object({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_CHANGE_PAGE_SIZE).default(DEFAULT_CHANGE_PAGE_SIZE),
  protocolVersion: z.coerce.number().int(),
  installationId: z.string().uuid(),
  recoveryEpoch: z.string().uuid(),
  accountId: z.string().uuid(),
}).strict();

export const adoptionItemSchema = z.object({
  entityType: entityTypeSchema,
  sourceId: z.string().min(1).max(256),
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  document: z.record(z.string(), z.unknown()),
}).strict();
export const adoptionRequestSchema = z.object({
  context: syncContextSchema,
  sourceWorkspaceId: z.string().uuid(),
  items: z.array(adoptionItemSchema).min(1).max(MAX_ADOPTION_BATCH_SIZE),
}).strict();

export type SyncContext = z.infer<typeof syncContextSchema>;
export type Mutation = z.infer<typeof mutationSchema>;
export type AdoptionRequest = z.infer<typeof adoptionRequestSchema>;

