import {
	type MiddlewareConsumer,
	Module,
	type NestModule,
	RequestMethod,
} from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { CallsController } from "./calls.controller";
import { CallsRouter } from "./calls.router";
import { CallsService } from "./calls.service";
import { TwilioBodyMiddleware } from "./twilio-body.middleware";

@Module({
	imports: [TrpcModule],
	controllers: [CallsController],
	providers: [CallsService, CallsRouter],
	exports: [CallsService],
})
export class CallsModule implements NestModule {
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(TwilioBodyMiddleware).forRoutes({
			path: "internal/twilio/voice-status",
			method: RequestMethod.POST,
		});
	}
}
