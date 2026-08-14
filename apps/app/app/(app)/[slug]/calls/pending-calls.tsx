"use client";

import { CallOutcome } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Call = RouterOutputs["calls"]["pending"][number];

const OUTCOMES: { value: CallOutcome; label: string }[] = [
	{ value: CallOutcome.ATTENDED, label: "Attended" },
	{ value: CallOutcome.OWNER_TALK, label: "Owner talk" },
	{ value: CallOutcome.FRONT_DESK, label: "Front desk" },
	{ value: CallOutcome.TRAINED, label: "Trained" },
	{ value: CallOutcome.REJECTED, label: "Rejected" },
];

function formatDuration(durationSec: number | null): string {
	if (durationSec === null) return "No duration";
	const minutes = Math.floor(durationSec / 60);
	const seconds = durationSec % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function CallRow({ call }: { call: Call }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [note, setNote] = useState("");

	const classify = useMutation(
		trpc.calls.classify.mutationOptions({
			onSuccess: async () => {
				await cache.calls();
				toast.success("Call classified.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<li className="flex flex-col gap-2.5 border-t px-5 py-3 first:border-t-0 md:px-6">
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<span className="font-medium">{call.toNumber || call.fromNumber}</span>
				<span className="flex items-center gap-2 text-muted-foreground text-xs tabular-nums">
					{formatDuration(call.durationSec)}
					{call.startedAt ? (
						<>
							{" · "}
							<LocalRelativeTime date={call.startedAt} />
						</>
					) : null}
				</span>
			</div>

			<Input
				value={note}
				onChange={(event) => setNote(event.target.value)}
				placeholder="Who did you talk to? Any notes?"
				autoComplete="off"
				disabled={classify.isPending}
			/>

			<div className="flex flex-wrap gap-1.5">
				{OUTCOMES.map((outcome) => (
					<Button
						key={outcome.value}
						type="button"
						size="sm"
						variant="outline"
						disabled={classify.isPending}
						onClick={() =>
							classify.mutate({ id: call.id, outcome: outcome.value, note })
						}
					>
						{classify.isPending &&
						classify.variables?.outcome === outcome.value ? (
							<Spinner />
						) : null}
						{outcome.label}
					</Button>
				))}
			</div>
		</li>
	);
}

export function PendingCalls({ calls }: { calls: Call[] | undefined }) {
	if (!calls) {
		return (
			<div className="flex flex-1 items-center justify-center py-10">
				<Spinner />
			</div>
		);
	}

	if (calls.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center px-5 py-10 text-center text-muted-foreground text-sm md:px-6">
				Nothing to classify. Every call Twilio has sent over has an outcome.
			</div>
		);
	}

	return (
		<ul className="flex flex-1 flex-col overflow-y-auto">
			{calls.map((call) => (
				<CallRow key={call.id} call={call} />
			))}
		</ul>
	);
}
