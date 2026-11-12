// PROTOTYPE, throwaway. Never merge.
// Signs the Knock user token for the DevUI user so the Feed variants can call Knock's headless feed API.
import { signUserToken } from "@knocklabs/node";

try {
  process.loadEnvFile();
} catch {}

export async function feedConfigFor(userId: number | null) {
  const publicKey = process.env.KNOCK_PUBLIC_API_KEY;
  const channelId = process.env.KNOCK_FEED_CHANNEL_ID;
  if (!userId || !publicKey || !channelId || !process.env.KNOCK_SIGNING_KEY) return null;
  const token = await signUserToken(String(userId), { expiresInSeconds: 60 * 60 });
  return { userId: String(userId), publicKey, channelId, token };
}

export type FeedConfig = NonNullable<Awaited<ReturnType<typeof feedConfigFor>>>;
