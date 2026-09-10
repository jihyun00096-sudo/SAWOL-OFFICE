import nacl from "tweetnacl";

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
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + rawBody),
      Buffer.from(signature, "hex"),
      Buffer.from(publicKey, "hex"),
    );
  } catch {
    return false;
  }
}
