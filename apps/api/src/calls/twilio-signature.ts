import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyTwilioSignature(
	authToken: string,
	url: string,
	params: Record<string, unknown>,
	signature: string,
): boolean {
	const data = Object.keys(params)
		.sort()
		.reduce((acc, key) => acc + key + String(params[key]), url);

	const expected = createHmac("sha1", authToken)
		.update(data, "utf8")
		.digest("base64");

	const a = Buffer.from(expected);
	const b = Buffer.from(signature);

	return a.length === b.length && timingSafeEqual(a, b);
}
