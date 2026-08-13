import {
	BadRequestException,
	Controller,
	ForbiddenException,
	Headers,
	Logger,
	Post,
	Req,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";
import type { EnvironmentVariables } from "../config/env.validation";
import { CallsService, type TwilioStatusPayload } from "./calls.service";
import { verifyTwilioSignature } from "./twilio-signature";

@Controller("internal/twilio")
export class CallsController {
	private readonly logger = new Logger(CallsController.name);
	private readonly authToken: string | undefined;
	private readonly callbackUrl: string | undefined;

	constructor(
		private readonly calls: CallsService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.authToken = config.get("TWILIO_AUTH_TOKEN", { infer: true });
		const apiUrl = config.get("API_URL", { infer: true });
		this.callbackUrl = apiUrl
			? `${apiUrl}/internal/twilio/voice-status`
			: undefined;
	}

	@Post("voice-status")
	@AllowAnonymous()
	async voiceStatus(
		@Req() request: Request,
		@Headers("x-twilio-signature") signature?: string,
	) {
		if (!this.authToken || !this.callbackUrl) {
			this.logger.error({
				message:
					"TWILIO_AUTH_TOKEN or API_URL is not set — refusing the Twilio webhook.",
			});
			throw new ServiceUnavailableException("Call tracking is not configured.");
		}

		if (!signature) {
			throw new BadRequestException("Missing Twilio signature.");
		}

		const body = request.body as Record<string, unknown>;
		const verified = verifyTwilioSignature(
			this.authToken,
			this.callbackUrl,
			body,
			signature,
		);

		if (!verified) {
			this.logger.error({ message: "Twilio webhook signature did not verify" });
			throw new ForbiddenException();
		}

		return this.calls.handleStatusCallback(body as TwilioStatusPayload);
	}
}
