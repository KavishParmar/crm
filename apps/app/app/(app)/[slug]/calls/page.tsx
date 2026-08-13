import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { CallsDashboard } from "./calls-dashboard";

export const metadata: Metadata = {
	title: "Calls",
};

export default function CallsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Calls</PageShellTitle>
					<PageShellDescription>
						Every call Twilio tracked, and what happened on it.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Calls />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Calls() {
	await requireSession();

	const queryClient = getServerQueryClient();
	const trpc = getServerTrpc();
	await Promise.all([
		queryClient.prefetchQuery(trpc.calls.stats.queryOptions({ range: "week" })),
		queryClient.prefetchQuery(trpc.calls.pending.queryOptions({})),
	]);

	return (
		<HydrateClient>
			<CallsDashboard />
		</HydrateClient>
	);
}
