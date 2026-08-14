import { parse as parseFormBody } from "node:querystring";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const MAX_BODY_BYTES = 64 * 1024;

@Injectable()
export class TwilioBodyMiddleware implements NestMiddleware {
	use(request: Request, _response: Response, next: NextFunction): void {
		const chunks: Buffer[] = [];
		let size = 0;

		request.on("data", (chunk: Buffer) => {
			size += chunk.length;
			if (size > MAX_BODY_BYTES) {
				request.destroy();
				return;
			}
			chunks.push(chunk);
		});

		request.on("end", () => {
			request.body = parseFormBody(Buffer.concat(chunks).toString("utf8"));
			next();
		});

		request.on("error", (error) => next(error));
	}
}
