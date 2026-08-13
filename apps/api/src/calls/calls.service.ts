import {
	ActivityType,
	CallDirection,
	CallOutcome,
	type Db,
	EmailDirection,
	type Prisma,
} from "@crm/db";
import { WORKSPACE_ID } from "@crm/db/workspace";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ActivityStampService } from "../crm/activity-stamp.service";
import { blankToNull } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import type {
	CallStatsInput,
	ClassifyCallInput,
	PendingCallsInput,
} from "./calls.contracts";

const TERMINAL_STATUSES = new Set([
	"completed",
	"busy",
	"failed",
	"no-answer",
	"canceled",
]);

const RANGE_DAYS: Record<CallStatsInput["range"], number> = {
	today: 1,
	week: 7,
	month: 30,
};

const SERIES_DAYS = 14;

const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
});

const OUTCOME_ORDER = [
	CallOutcome.ATTENDED,
	CallOutcome.OWNER_TALK,
	CallOutcome.FRONT_DESK,
	CallOutcome.TRAINED,
	CallOutcome.REJECTED,
] as const;

export type TwilioStatusPayload = {
	CallSid?: string;
	From?: string;
	To?: string;
	CallStatus?: string;
	Direction?: string;
	CallDuration?: string;
	RecordingUrl?: string;
	Timestamp?: string;
};

const CALL_SELECT = {
	id: true,
	twilioCallSid: true,
	direction: true,
	fromNumber: true,
	toNumber: true,
	status: true,
	durationSec: true,
	recordingUrl: true,
	startedAt: true,
	endedAt: true,
	outcome: true,
	note: true,
	classifiedAt: true,
	createdAt: true,
	activity: {
		select: {
			id: true,
			company: { select: { id: true, name: true } },
			contact: { select: { id: true, firstName: true, lastName: true } },
		},
	},
} as const;

type CallRow = Prisma.CallGetPayload<{ select: typeof CALL_SELECT }>;

function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function serializeCall(call: CallRow) {
	return {
		...call,
		startedAt: call.startedAt?.toISOString() ?? null,
		endedAt: call.endedAt?.toISOString() ?? null,
		classifiedAt: call.classifiedAt?.toISOString() ?? null,
		createdAt: call.createdAt.toISOString(),
	};
}

@Injectable()
export class CallsService {
	private readonly logger = new Logger(CallsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly stamp: ActivityStampService,
	) {}

	async handleStatusCallback(
		payload: TwilioStatusPayload,
	): Promise<{ recorded: boolean }> {
		const callSid = payload.CallSid;
		const status = payload.CallStatus;

		if (!callSid || !status || !TERMINAL_STATUSES.has(status)) {
			return { recorded: false };
		}

		const ownerId = await this.resolveOwnerId();
		if (!ownerId) {
			this.logger.error({
				message:
					"A Twilio call finished but there is no workspace owner to attribute it to",
				callSid,
			});
			return { recorded: false };
		}

		const direction = (payload.Direction ?? "").startsWith("outbound")
			? CallDirection.OUTBOUND
			: CallDirection.INBOUND;
		const durationSec = payload.CallDuration
			? Number.parseInt(payload.CallDuration, 10)
			: null;
		const endedAt = payload.Timestamp
			? new Date(payload.Timestamp)
			: new Date();
		const startedAt =
			durationSec !== null && Number.isFinite(durationSec)
				? new Date(endedAt.getTime() - durationSec * 1000)
				: endedAt;

		const call = await this.db.call.upsert({
			where: { twilioCallSid: callSid },
			create: {
				twilioCallSid: callSid,
				direction,
				fromNumber: payload.From ?? "",
				toNumber: payload.To ?? "",
				status,
				durationSec,
				recordingUrl: payload.RecordingUrl ?? null,
				startedAt,
				endedAt,
			},
			update: {
				status,
				durationSec,
				recordingUrl: payload.RecordingUrl ?? null,
				endedAt,
			},
			select: { id: true, activity: { select: { id: true } } },
		});

		if (!call.activity) {
			await this.db.activity.create({
				data: {
					type: ActivityType.CALL,
					subject:
						direction === CallDirection.OUTBOUND
							? `Call to ${payload.To ?? "unknown number"}`
							: `Call from ${payload.From ?? "unknown number"}`,
					occurredAt: startedAt,
					createdById: ownerId,
					callId: call.id,
					meta: { synced: true, source: "twilio" },
				},
			});
		}

		this.logger.log({ message: "Twilio call recorded", callSid, status });

		return { recorded: true };
	}

	async pending(input: PendingCallsInput) {
		const calls = await this.db.call.findMany({
			where: { outcome: null },
			orderBy: [
				{ startedAt: { sort: "desc", nulls: "last" } },
				{ createdAt: "desc" },
			],
			take: input.limit,
			select: CALL_SELECT,
		});

		return calls.map(serializeCall);
	}

	async pendingCount(): Promise<number> {
		return this.db.call.count({ where: { outcome: null } });
	}

	async classify(input: ClassifyCallInput, actingUserId: string) {
		const call = await this.db.call.findUnique({
			where: { id: input.id },
			select: {
				id: true,
				activity: { select: { id: true, companyId: true, contactId: true } },
			},
		});

		if (!call) {
			throw new NotFoundException(`No call with id ${input.id}.`);
		}

		const contactId = input.contactId ?? call.activity?.contactId ?? null;
		const companyId =
			input.companyId ??
			(input.contactId
				? await this.companyIdForContact(input.contactId)
				: null) ??
			call.activity?.companyId ??
			null;
		const note = blankToNull(input.note ?? "");
		const classifiedAt = new Date();

		await this.db.$transaction(async (tx) => {
			await tx.call.update({
				where: { id: input.id },
				data: {
					outcome: input.outcome,
					note,
					classifiedAt,
					classifiedById: actingUserId,
				},
			});

			if (call.activity) {
				await tx.activity.update({
					where: { id: call.activity.id },
					data: { companyId, contactId, body: note },
				});
			}
		});

		if (companyId || contactId) {
			await this.stamp.touch({ companyId, contactId }, classifiedAt);
		}

		this.logger.log({
			message: "Call classified",
			callId: input.id,
			outcome: input.outcome,
		});

		const updated = await this.db.call.findUniqueOrThrow({
			where: { id: input.id },
			select: CALL_SELECT,
		});

		return serializeCall(updated);
	}

	async stats(input: CallStatsInput) {
		const days = RANGE_DAYS[input.range];
		const windowEnd = addDays(startOfDay(new Date()), 1);
		const windowStart = addDays(windowEnd, -days);
		const previousStart = addDays(windowStart, -days);

		const [current, previous, series, emailsCurrent, emailsPrevious] =
			await Promise.all([
				this.outcomeCounts({ gte: windowStart, lt: windowEnd }),
				this.outcomeCounts({ gte: previousStart, lt: windowStart }),
				this.dailySeries(addDays(windowEnd, -SERIES_DAYS), windowEnd),
				this.emailsSent({ gte: windowStart, lt: windowEnd }),
				this.emailsSent({ gte: previousStart, lt: windowStart }),
			]);

		return {
			range: input.range,
			windowStart: windowStart.toISOString(),
			windowEnd: windowEnd.toISOString(),
			current: { ...current, emailsSent: emailsCurrent },
			previous: { ...previous, emailsSent: emailsPrevious },
			series,
		};
	}

	private async resolveOwnerId(): Promise<string | null> {
		const owner = await this.db.member.findFirst({
			where: { organizationId: WORKSPACE_ID, role: "owner" },
			orderBy: { createdAt: "asc" },
			select: { userId: true },
		});

		return owner?.userId ?? null;
	}

	private async companyIdForContact(contactId: string): Promise<string | null> {
		const contact = await this.db.contact.findUnique({
			where: { id: contactId },
			select: { companyId: true },
		});

		return contact?.companyId ?? null;
	}

	private async outcomeCounts(startedAt: Prisma.DateTimeFilter) {
		const [totalCalls, byOutcome] = await Promise.all([
			this.db.call.count({ where: { startedAt } }),
			this.db.call.groupBy({
				by: ["outcome"],
				where: { startedAt },
				_count: { _all: true },
			}),
		]);

		const counts = Object.fromEntries(
			OUTCOME_ORDER.map((outcome) => [outcome, 0]),
		) as Record<CallOutcome, number>;

		let classified = 0;
		for (const row of byOutcome) {
			if (row.outcome) {
				counts[row.outcome] = row._count._all;
				classified += row._count._all;
			}
		}

		return { totalCalls, unclassified: totalCalls - classified, ...counts };
	}

	private async emailsSent(sentAt: Prisma.DateTimeFilter): Promise<number> {
		return this.db.emailMessage.count({
			where: { sentAt, direction: EmailDirection.OUTBOUND },
		});
	}

	private async dailySeries(start: Date, end: Date) {
		const calls = await this.db.call.findMany({
			where: { startedAt: { gte: start, lt: end } },
			select: { startedAt: true, outcome: true },
		});

		const buckets = new Map<
			number,
			{ day: string; calls: number; attended: number }
		>();
		for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) {
			buckets.set(cursor.getTime(), {
				day: DAY_LABEL.format(cursor),
				calls: 0,
				attended: 0,
			});
		}

		for (const call of calls) {
			if (!call.startedAt) continue;
			const bucket = buckets.get(startOfDay(call.startedAt).getTime());
			if (!bucket) continue;
			bucket.calls += 1;
			if (
				call.outcome === CallOutcome.ATTENDED ||
				call.outcome === CallOutcome.OWNER_TALK
			) {
				bucket.attended += 1;
			}
		}

		return Array.from(buckets.values());
	}
}
