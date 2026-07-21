import { createHash } from "crypto";
export const KIT_VERSION = "v2";
export function kitHash(cv: unknown, description: string, rawEvidence = "") { return createHash("sha256").update(JSON.stringify(cv) + rawEvidence + description + KIT_VERSION).digest("hex"); }
