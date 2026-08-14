"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import type { ChartConfig } from "@crm/ui/components/chart";
import { DashboardRow, StatGroup } from "@crm/ui/components/dashboard";
import { Spinner } from "@crm/ui/components/spinner";
import { StatCard, type StatDelta } from "@crm/ui/components/stat-card";
import { formatCount, formatPercent } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AreaTrend } from "@/components/dashboard-charts";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { PendingCalls } from "./pending-calls";

type Stats = RouterOutputs["calls"]["stats"];
type Range = Stats["range"];

const RANGES: { value: Range; label: string }[] = [
	{ value: "today", label: "Today" },
	{ value: "week", label: "This week" },
	{ value: "month", label: "This month" },
];

const SERIES_CONFIG: ChartConfig = {
	calls: { label: "Calls made", color: "var(--chart-1)" },
	attended: { label: "Attended", color: "var(--success)" },
};

function changeDelta(
	current: number,
	previous: number,
	label: string,
): StatDelta | undefined {
	if (previous === 0) return undefined;
	const change = Math.round(((current - previous) / previous) * 100);
	return {
		value: `${change >= 0 ? "+" : ""}${change}%`,
		direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
		label,
	};
}

function rate(count: number, total: number): string {
	return total === 0 ? "—" : formatPercent(count / total);
}

export function CallsDashboard() {
	const trpc = useTRPC();
	const [range, setRange] = useState<Range>("week");

	const statsQuery = useQuery({
		...trpc.calls.stats.queryOptions({ range }),
		placeholderData: (previous) => previous,
	});
	const pendingQuery = useQuery(trpc.calls.pending.queryOptions({}));

	const stats = statsQuery.data;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center gap-1">
				{RANGES.map((option) => (
					<Button
						key={option.value}
						type="button"
						size="sm"
						variant={range === option.value ? "contrast" : "ghost"}
						onClick={() => setRange(option.value)}
					>
						{option.label}
					</Button>
				))}
			</div>

			{!stats ? (
				<div className="flex flex-1 justify-center py-12">
					<Spinner />
				</div>
			) : (
				<>
					<StatGroup>
						<StatCard
							label="Calls made"
							value={formatCount(stats.current.totalCalls, "call")}
							delta={changeDelta(
								stats.current.totalCalls,
								stats.previous.totalCalls,
								"vs. previous period",
							)}
							description={`${formatCount(stats.previous.totalCalls, "call")} in the period before`}
						/>
						<StatCard
							label="Attended"
							value={formatCount(stats.current.ATTENDED, "call")}
							delta={changeDelta(
								stats.current.ATTENDED,
								stats.previous.ATTENDED,
								"vs. previous period",
							)}
							description={`${rate(stats.current.ATTENDED, stats.current.totalCalls)} of calls made`}
						/>
						<StatCard
							label="Owner talks"
							value={formatCount(stats.current.OWNER_TALK, "call")}
							delta={changeDelta(
								stats.current.OWNER_TALK,
								stats.previous.OWNER_TALK,
								"vs. previous period",
							)}
							description={`${rate(stats.current.OWNER_TALK, stats.current.totalCalls)} of calls made`}
						/>
						<StatCard
							label="Front desk"
							value={formatCount(stats.current.FRONT_DESK, "call")}
							delta={changeDelta(
								stats.current.FRONT_DESK,
								stats.previous.FRONT_DESK,
								"vs. previous period",
							)}
							description={`${rate(stats.current.FRONT_DESK, stats.current.totalCalls)} of calls made`}
						/>
						<StatCard
							label="Trained"
							value={formatCount(stats.current.TRAINED, "call")}
							delta={changeDelta(
								stats.current.TRAINED,
								stats.previous.TRAINED,
								"vs. previous period",
							)}
							description={`${rate(stats.current.TRAINED, stats.current.totalCalls)} of calls made`}
						/>
						<StatCard
							label="Rejected"
							value={formatCount(stats.current.REJECTED, "call")}
							delta={changeDelta(
								stats.current.REJECTED,
								stats.previous.REJECTED,
								"vs. previous period",
							)}
							description={`${rate(stats.current.REJECTED, stats.current.totalCalls)} of calls made`}
						/>
						<StatCard
							label="Emails sent"
							value={formatCount(stats.current.emailsSent, "email")}
							delta={changeDelta(
								stats.current.emailsSent,
								stats.previous.emailsSent,
								"vs. previous period",
							)}
							description={`${formatCount(stats.previous.emailsSent, "email")} in the period before`}
						/>
						<StatCard
							label="Not yet classified"
							value={formatCount(stats.current.unclassified, "call")}
							description="Waiting for an outcome below"
						/>
					</StatGroup>

					<DashboardRow split="hero">
						<Card className="min-w-0">
							<CardHeader>
								<CardTitle>Calls, day by day</CardTitle>
								<CardDescription>Last 14 days</CardDescription>
							</CardHeader>
							<div className="flex flex-1 flex-col border">
								<div className="flex flex-1 flex-col justify-center py-4">
									<AreaTrend
										data={stats.series}
										config={SERIES_CONFIG}
										xKey="day"
										height={220}
										variant="gradient"
										bloom="high"
										showLegend
									/>
								</div>
							</div>
						</Card>

						<Card className="min-w-0">
							<CardHeader>
								<CardTitle>Waiting to be classified</CardTitle>
								<CardDescription>
									{pendingQuery.data
										? formatCount(pendingQuery.data.length, "call", "calls")
										: "Loading…"}
								</CardDescription>
							</CardHeader>
							<div className="flex flex-1 flex-col border">
								<PendingCalls calls={pendingQuery.data} />
							</div>
						</Card>
					</DashboardRow>
				</>
			)}
		</div>
	);
}
