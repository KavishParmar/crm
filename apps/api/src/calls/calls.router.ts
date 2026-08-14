import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	callStatsInput,
	classifyCallInput,
	pendingCallsInput,
} from "./calls.contracts";
import { CallsService } from "./calls.service";

@Router({ alias: "calls" })
@UseMiddlewares(AuthMiddleware)
export class CallsRouter {
	constructor(@Inject(CallsService) private readonly calls: CallsService) {}

	@Query({ input: pendingCallsInput })
	async pending(@Input() input: z.infer<typeof pendingCallsInput>) {
		return this.calls.pending(input);
	}

	@Query()
	async pendingCount() {
		return this.calls.pendingCount();
	}

	@Query({ input: callStatsInput })
	async stats(@Input() input: z.infer<typeof callStatsInput>) {
		return this.calls.stats(input);
	}

	@Mutation({ input: classifyCallInput })
	async classify(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof classifyCallInput>,
	) {
		return this.calls.classify(input, ctx.user.id);
	}
}
