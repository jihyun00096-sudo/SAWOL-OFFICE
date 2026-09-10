import { createPublicKey, verify } from "node:crypto";

const ED25519_SPKI_PREFIX = Buffer.from(
  "302a300506032b6570032100",
  "hex",
);

export function verifyDiscordRequest({
  rawBody,
  signature,
  timestamp,
  publicKey,
}: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  publicKey: string;
}) {
  if (!signature || !timestamp || !publicKey) return false;

  try {
    const rawPublicKey = Buffer.from(publicKey, "hex");

    if (rawPublicKey.length !== 32) {
      return false;
    }

    const key = createPublicKey({
      key: Buffer.concat([
        ED25519_SPKI_PREFIX,
        rawPublicKey,
      ]),
      format: "der",
      type: "spki",
    });

    return verify(
      null,
      Buffer.from(timestamp + rawBody),
      key,
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}
