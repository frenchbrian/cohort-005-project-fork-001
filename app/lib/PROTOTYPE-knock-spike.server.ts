// PROTOTYPE — throwaway Knock spike for "Does Knock hold up against Cadence?".
// Lives on the prototype/knock-spike branch only. Never merge.
import Knock, { signUserToken } from "@knocklabs/node";

try {
  process.loadEnvFile();
} catch {
  // .env already loaded or missing; the checks below will say which.
}

export const WORKFLOWS = {
  discussionReply: "discussion-reply",
  newEnrollment: "new-enrollment",
} as const;

export const NEW_ENROLLMENT_CATEGORY = "new-enrollment";

export function knockEnv() {
  const missing = [
    "KNOCK_PUBLIC_API_KEY",
    "KNOCK_SECRET_API_KEY",
    "KNOCK_SIGNING_KEY",
    "KNOCK_FEED_CHANNEL_ID",
  ].filter((k) => !process.env[k]);
  return {
    missing,
    publicKey: process.env.KNOCK_PUBLIC_API_KEY ?? "",
    feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID ?? "",
  };
}

let client: Knock | null = null;
export function knock() {
  client ??= new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY });
  return client;
}

// Cadence user id → Knock user id. Plain string id for the spike.
export const knockUserId = (id: number) => String(id);

export async function identify(u: { id: number; name: string; email: string }) {
  const id = knockUserId(u.id);
  await knock().users.update(id, { name: u.name, email: u.email });
  // Cadence owns the default: new Enrollment is off until the user opts in.
  // Only written when the user has no choice recorded, so an opt-in survives re-identify.
  const prefs = await knock().users.getPreferences(id, "default");
  if (prefs.categories?.[NEW_ENROLLMENT_CATEGORY] === undefined) {
    await knock().users.setPreferences(id, "default", {
      __persistence_strategy__: "merge",
      categories: { [NEW_ENROLLMENT_CATEGORY]: { channel_types: { in_app_feed: false } } },
    });
  }
}

export async function tokenFor(userId: number) {
  // Reads KNOCK_SIGNING_KEY from the environment; RS256.
  return signUserToken(knockUserId(userId), { expiresInSeconds: 60 * 60 });
}
