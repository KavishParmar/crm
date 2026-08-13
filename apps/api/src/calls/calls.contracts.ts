import { CallOutcome } from "@crm/db";
import { z } from "zod";

const outcomeEnum = z.enum(
	Object.values(CallOutcome) as [CallOutcome, ...CallOutcome[]],
);

export const CALL_STATS_RANGES = ["today", "week", "month"] as const;

export const callStatsInput = z.object({
	range: z.enum(CALL_STATS_RANGES).default("week"),
});

export type CallStatsInput = z.infer<typeof callStatsInput>;

export const pendingCallsInput = z.object({
	limit: z.number().int().min(1).max(100).default(25),
});

export type PendingCallsInput = z.infer<typeof pendingCallsInput>;

export const classifyCallInput = z.object({
	id: z.string(),
	outcome: outcomeEnum,
	contactId: z.string().optional(),
	companyId: z.string().optional(),
	note: z.string().trim().optional(),
});

export type ClassifyCallInput = z.infer<typeof classifyCallInput>;
