# Hosted notification vendors for Cadence

All sources were accessed on **2026-11-11**. npm data came from `npm view <pkg> version time.modified` on the same date. `time.modified` is the date the registry entry last changed, which is usually the latest publish.

## Question

Which hosted notification-infrastructure vendors fit Cadence?

## Context

- **Stack:** React Router v7 (SSR), Node, and SQLite with Drizzle.
- **Goal:** Buy a hosted vendor rather than build. The vendor must have a prebuilt in-app feed for React.
- **Push:** Browser web push only. No mobile, SMS, or Slack.
- **Email:** Transactional email stays on Postmark. Routing the vendor's email channel through Postmark would be nice but isn't required.

"SuperSend" in the ticket almost certainly means **SuprSend**. SuperSend (supersend.io) is a cold-email and outbound sales tool, not notification infrastructure ([supersend.io](https://supersend.io/features/email-infrastructure-deliverability)).

## Comparison

| | Knock | Novu Cloud | MagicBell | Courier | SuprSend |
|---|---|---|---|---|---|
| **React feed** | `@knocklabs/react` 0.15.1 | `@novu/react` 3.19.2 (`<Inbox/>`) | `@magicbell/react` 1.14.0 | `@trycourier/courier-react` 9.3.5 | `@suprsend/react` 1.5.0 |
| **Web push** | Through FCM (web tokens) or OneSignal. No native VAPID. | Through FCM, OneSignal, Pushpad, or Pusher Beams. No native VAPID. | **Native VAPID** with a `WebPushButton`. You add a `sw.js` that imports MagicBell's worker. | Documented only through OneSignal. Native web push is unverified. | **Native VAPID**. You add `serviceWorker.js` at the site root. |
| **Preference API** | Yes | Yes | Yes | Yes | Yes |
| **Prebuilt preference UI** | A **hosted** page. React has hooks only, no component. | Yes, inside `<Inbox/>` | `UserPreferences` component (thinly documented) | `<CourierPreferences>` component, plus a hosted page | `Preferences` component in `@suprsend/react` |
| **Free tier** | 10k messages/mo, unlimited seats, 30-day logs | 10k workflow runs/mo, 5 workflows, 3 seats, **24-hour** activity retention | **1k deliveries/mo**, unlimited seats | 10k sends/mo. Inbox and preference gating isn't stated. | 10k notifications/mo, 30-day logs. Preferences may be paid-only. |
| **Node SDK** | `@knocklabs/node` 1.41.1 (updated 2026-11-10) | `@novu/api` 3.19.1. `@novu/node` is deprecated. | `magicbell` 4.5.1 (updated 2026-05) | `@trycourier/courier` 10.0.0 (updated 2026-10) | `@suprsend/node-sdk` 1.15.1 (updated 2026-05) |
| **Local dev and CI** | Dev and prod environments, CLI, `sandbox_mode` on trigger. No self-hosting. | Dev and prod environments, **self-hosted MIT core with Docker Compose**, `npx novu dev` | No test environment or sandbox documented | Test and prod environments. A Mock key exists but its plan isn't verified. | Sandbox, staging, and prod workspaces, a staging Test Mode, and a CLI |
| **Postmark under it** | Yes, native | Yes, native | Not in docs. SMTP relay may work but is unverified. | Yes, native | Yes, native |

## Knock

- **Feed:** `@knocklabs/react` provides `NotificationFeedPopover`, `NotificationFeed`, and `NotificationIconButton` ([docs.knock.app/in-app-ui/react/overview](https://docs.knock.app/in-app-ui/react/overview)).
- **Web push:** Knock's listed push providers are APNs, FCM, Expo, OneSignal, and Amazon SNS ([push overview](https://docs.knock.app/integrations/push/overview)). The FCM page is tagged "web push" and says to obtain the browser token with the Firebase web SDK. It also supports a `webpush` override block ([FCM](https://docs.knock.app/integrations/push/firebase)).
  - Knock doesn't document service worker setup. FCM's own web setup applies.
  - That means Cadence would also need a Firebase project.
- **Preferences:** The API covers workflows, categories, channel types, and channels, and includes a bulk set ([preferences overview](https://docs.knock.app/preferences/overview)).
  - The prebuilt UI is a **hosted preference center** at a signed URL. It supports only the `default` preference set.
  - For React, Knock offers hooks and a build-your-own guide, not a drop-in component.
- **Free tier ("Developer"):** ([knock.app/pricing](https://knock.app/pricing))
  - 10,000 messages a month, unlimited team members, 30-day log retention, and unlimited feed retention.
  - Paid plans start with Starter at $250/mo.
  - Free excludes branding removal, translations, and per-tenant preferences.
  - **Ambiguous:** The page states no MAU cap and no free-tier overage rate. It says Knock "contacts you" when you exceed the limit.
- **Node SDK:** `@knocklabs/node` 1.41.1, updated 2026-11-10. It is actively maintained.
- **Local dev and CI:** ([environments](https://docs.knock.app/concepts/environments), [testing workflows](https://docs.knock.app/send-notifications/testing-workflows), [CLI](https://docs.knock.app/developer-tools/knock-cli))
  - Development and production environments have separate keys and data. The CLI targets development by default.
  - Passing `settings.sandbox_mode` and `settings.skip_delay` on a trigger renders messages without delivering them to providers.
  - Sandbox mode is not supported for the in-app channel.
  - There is no self-hosted option or official mock. CI would either stub the SDK at Cadence's boundary or call the dev environment with a dev key.
- **Postmark:** Native integration, configured per environment, with an optional delivery webhook and a per-channel sandbox toggle ([Postmark](https://docs.knock.app/integrations/email/postmark)).

## Novu (Cloud)

- **Feed:** `@novu/react` provides `<Inbox />` ([inbox overview](https://docs.novu.co/platform/inbox/overview)).
  - It requires React 18 or later.
  - The docs have quickstarts for Next.js and React only. There is **no React Router or SSR guidance**.
- **Web push:** Novu's providers are FCM, APNs, Expo, OneSignal, Push Webhook, Pusher Beams, and Pushpad ([push](https://docs.novu.co/platform/integrations/push)).
  - Pushpad is explicitly browser web push ([Pushpad](https://docs.novu.co/platform/integrations/push/pushpad)).
  - There is no native VAPID channel. Any of these routes means a third-party account plus that provider's service worker.
- **Preferences:** The API exists, and `<Inbox/>` includes a built-in **Preferences** view for workflow and channel choices ([inbox overview](https://docs.novu.co/platform/inbox/overview)).
- **Free tier:** ([novu.co/pricing](https://novu.co/pricing))
  - 10,000 workflow runs a month, up to 5 workflows, 3 seats, unlimited subscribers, dev and prod environments, all channels, and **24-hour activity feed retention**.
  - Paid plans start with Pro at $30/mo. Overage is $1.20 per 1,000 runs.
  - **Ambiguous:** The Pro seat count and workflow limit differ between the plan bullets and the comparison table. The FAQ answers didn't render.
- **Node SDK:** `@novu/api` 3.19.1 (updated 2026-09). `@novu/node` is deprecated, with support ending 2025-03-20 according to its npm deprecation notice.
- **Local dev and CI:**
  - The core is **MIT-licensed**. The `enterprise/` directory is under a commercial license ([github.com/novuhq/novu](https://github.com/novuhq/novu)).
  - The community Docker Compose stack runs `api`, `worker`, `ws`, `dashboard`, MongoDB, and Redis. You point `serverURL`, `backendUrl`, and `socketUrl` at it ([deploy with Docker](https://docs.novu.co/community/self-hosting-novu/deploy-with-docker)).
  - The self-hosting overview recommends a single VM with 4 vCPUs and 8 GB RAM, plus MongoDB, Redis, and S3 storage. Self-hosting lacks some cloud-only features and social login ([self-hosting overview](https://docs.novu.co/community/self-hosting-novu/overview)).
  - This makes CI feasible but heavy.
  - `npx novu@latest dev` opens a Local environment in the cloud dashboard. Whether it needs a secret key is unverified ([studio](https://docs.novu.co/framework/studio)).
- **Postmark:** Native ([Postmark](https://docs.novu.co/platform/integrations/email/postmark)).

## MagicBell

- **Feed:** `@magicbell/react` provides `FloatingInbox`, `Inbox`, `ToastContainer`, `WebPushButton`, and `UserPreferences`. The client authenticates with a user JWT minted on your server ([React docs](https://www.magicbell.com/docs/libraries/magicbell-react)).
  - The older `@magicbell/magicbell-react` 11.5.1 is still published.
- **Web push:** **Native.** The web push channel takes your own VAPID public and private keys ([web push channel](https://www.magicbell.com/docs/channels/web_push)).
  - The service worker must `importScripts('https://assets.magicbell.io/web-push-notifications/sw.js')`. The default path is `/sw.js`.
  - On iOS, the app must be installed as a PWA ([React docs](https://www.magicbell.com/docs/libraries/magicbell-react)).
  - Supported browsers and plan gating are not stated.
- **Preferences:** The API exists ([API reference](https://www.magicbell.com/docs/api/reference)). The `UserPreferences` component is documented with only a `className` prop.
- **Free tier ("Builder"):** ([magicbell.com/pricing](https://www.magicbell.com/pricing))
  - **1,000 deliveries a month**, with deliveries counted per channel. It includes unlimited team members, 1 project, and "All integrations".
  - Paid plans start with Startup at $249/mo for 50,000 deliveries.
  - **Ambiguous:** The page states no MAU or retention limits, doesn't say whether web push is in the free plan, and gives no free-tier overage rate.
- **Node SDK:** `magicbell` 4.5.1 (updated 2026-05) ([JS client docs](https://www.magicbell.com/docs/libraries/magicbell-js)).
- **Local dev and CI:** **No test environment, sandbox, or mock is documented.** Projects use an API key and secret. CI would have to stub the SDK or use a second project. Treat this as unverified, not as a confirmed absence.
- **Postmark:** **Not in the docs.** The email channel docs list SMTP, SendGrid, Ping Email, Mailgun, and Amazon SES ([email docs](https://magicbell.com/docs/email)). Marketing pages mention Postmark, which conflicts with the docs. Postmark's SMTP relay through MagicBell's SMTP provider is a plausible fallback but unverified ([SMTP](https://www.magicbell.com/docs/channels/email/smtp)).

## Courier

- **Feed:** `@trycourier/courier-react` (React 18 or later) provides `<CourierInbox/>` and `CourierInboxPopupMenu`. The client calls `signIn({ userId, jwt })` with a JWT from your backend ([inbox overview](https://www.courier.com/docs/platform/inbox/inbox-overview)).
  - The older `@trycourier/react-inbox` packages are deprecated.
- **Web push:** Courier's push providers include APNs, FCM, Expo, OneSignal, Pusher Beams, MagicBell, and others ([push overview](https://www.courier.com/docs/integrations/push/overview)).
  - Courier's own guide routes **browser push through OneSignal** ([Node push guide](https://www.courier.com/guides/nodejs-send-push-notifications)).
  - Courier's intro page lists FCM as covering web ([intro to push](https://www.courier.com/docs/external-integrations/push/intro-to-push)).
  - A native VAPID channel is unverified.
- **Preferences:** ([embedding preferences](https://www.courier.com/docs/platform/preferences/embedding-preferences), [preferences intro](https://www.courier.com/docs/platform/preferences/intro))
  - The prebuilt `<CourierPreferences>` React component covers topics, channels, and digests. Its JWT needs the `read:preferences` and `write:preferences` scopes.
  - There are headless hooks and a hosted preference page.
  - Courier's own sources disagree on whether the hosted page is live.
- **Free tier ("Developer"):** ([courier.com/pricing](https://www.courier.com/pricing))
  - 10,000 sends a month and no per-seat fees.
  - The paid Business plan is pay-as-you-go at $0.005 per send.
  - **Ambiguous:** The page doesn't state retention, doesn't say whether Inbox and Preferences are in the free plan, and doesn't show FAQ answers on overage or what counts as a send.
- **Node SDK:** `@trycourier/courier` 10.0.0 (updated 2026-10-29). It is actively maintained.
- **Local dev and CI:**
  - Each workspace has **Production and Test** environments, with up to 20 environments in total. A Test key keeps traffic in Test.
  - The Test environment's built-in email provider delivers only to the signup address ([environments and API keys](https://www.courier.com/docs/platform/workspaces/environments-api-keys)).
  - Search results describe a "Mock" key that skips provider calls as Enterprise-only, but the environments page doesn't confirm this. Treat it as **unverified**.
- **Postmark:** Native. You can also render with Postmark templates through `config.url` ([Postmark](https://www.courier.com/docs/external-integrations/email/postmark)).

## SuprSend

- **Feed:** The `@suprsend/react` README lists prebuilt **Inbox**, **NotificationFeed**, and **Preferences** ([suprsend-react-sdk](https://github.com/suprsend/suprsend-react-sdk)).
  - `@suprsend/react-core` is the headless option.
  - `@suprsend/react-inbox` is deprecated on npm. Don't use it.
- **Web push:** **Native VAPID.** You pass a `vapidKey` to `SuprSendProvider` and call `registerPush()` from a user gesture ([React web push](https://docs.suprsend.com/docs/react-webpush), [JS web push](https://docs.suprsend.com/docs/js-webpush)).
  - `https://<domain>/serviceworker.js` must be served at the root and must `importScripts` the `@suprsend/web-sdk` CDN build.
  - The docs pin different SDK versions on different pages: 3.0.3 and 4.0.0.
- **Preferences:** The API exists, and `@suprsend/react` includes a Preferences component.
- **Free tier:** ([suprsend.com/pricing](https://www.suprsend.com/pricing))
  - 10,000 notifications a month, unlimited team members, 30-day logs, and an in-app feed with SuprSend branding. All features are unlocked for a 30-day trial.
  - Paid plans start with Essentials at $100/mo, or Business at $250/mo, each including 50,000 notifications.
  - **Ambiguous:** "User Preferences" appears under the Business plan, so the preference center may not be in Free. The page doesn't say whether web push is gated. It also contradicts itself on overage: one place says to upgrade, and another says sends aren't stopped.
- **Node SDK:** `@suprsend/node-sdk` 1.15.1 (updated 2026-05).
- **Local dev and CI:** ([what is SuprSend](https://docs.suprsend.com/docs/what-is-suprsend), [CLI](https://www.suprsend.com/post/introducing-suprsend-cli))
  - Each account has Sandbox, Staging, and Production workspaces with separate data. The Sandbox workspace is a trial.
  - Staging has a **Test Mode** that delivers only to designated internal testers.
  - The CLI syncs workflows between workspaces.
  - The Test Mode detail comes partly from SuprSend marketing pages.
  - There is no self-hosted option or official mock.
- **Postmark:** Native. It needs a server token, plus a webhook to `hub.suprsend.com` for delivery status ([Postmark](https://docs.suprsend.com/docs/postmark)).

## Others considered

- **Engagespot:** Has a prebuilt React inbox and a native default web push provider. Web push requires the in-app component ([web push](https://docs.engagespot.co/docs/features/channels/web-push/default-web-push-provider/), [intro](https://docs.engagespot.co/docs/introduction/getting-started/)).
  - **Not shortlisted:** `@engagespot/node` was last updated 2024-11 and `@engagespot/react-component` 2025-05. The pricing page returned 404, so free-tier limits are unverified.
- **OneSignal:** Strong web push, but no prebuilt persistent in-app feed component is documented ([web push quickstart](https://documentation.onesignal.com/docs/web-push-quickstart)). At most, it could serve as a push provider under Knock, Novu, or Courier.
- **Pusher Beams and Channels:** Beams is web push only and requires a root `service-worker.js`. It has no feed UI ([Beams web SDK](https://pusher.com/docs/beams/getting-started/web/sdk-integration/)). Channels is a raw websocket layer. Neither is notification infrastructure with a feed.

## Shortlist (no final pick)

1. **Knock**
   - **Strengths:** The best-maintained SDKs. A generous free tier: 10,000 messages, unlimited seats, unlimited feed retention. Native Postmark. The cleanest API test story with `sandbox_mode`.
   - **Trade-offs:** No native web push, so Cadence would add Firebase (FCM) for web. No React preference component, only hooks or a hosted page. A $250/mo step to the first paid plan. No self-hosting, so CI has to stub at the boundary.
2. **Novu Cloud**
   - **Strengths:** The only option with a **self-hostable MIT core**, giving real local and CI parity without live keys. Preferences are built into `<Inbox/>`. Native Postmark. A cheap $30/mo first paid plan.
   - **Trade-offs:** Web push needs a third party (Pushpad, FCM, OneSignal, or Pusher Beams). The free plan keeps only 24 hours of activity and allows 5 workflows. The docs have no React Router or SSR guidance. Self-hosting needs MongoDB and Redis.
3. **SuprSend**
   - **Strengths:** Covers everything in one vendor: **native VAPID web push**, plus prebuilt Inbox and Preferences React components. Native Postmark. A staging Test Mode.
   - **Trade-offs:** The pricing page suggests preferences may need the Business plan ($250/mo). The Node SDK is updated less often. The docs are inconsistent about SDK versions. There is no self-hosting.

MagicBell also has native web push, but it lost a shortlist place because of its 1,000-delivery free tier, its undocumented Postmark support, and the lack of a documented test environment. Courier is close to Knock, but its browser push is documented only through OneSignal and its free-tier feature gates are unclear.
