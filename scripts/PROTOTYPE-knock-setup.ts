// PROTOTYPE — creates and commits the two spike workflows in Knock Development
// via the Management API. Needs KNOCK_SERVICE_TOKEN in .env. Throwaway; never merge.
process.loadEnvFile();

const h = {
  Authorization: `Bearer ${process.env.KNOCK_SERVICE_TOKEN}`,
  "Content-Type": "application/json",
};
const MAPI = "https://control.knock.app/v1";
const FEED_CHANNEL_KEY = "in-app";

const workflows = [
  {
    key: "discussion-reply",
    name: "Discussion reply",
    categories: ["discussion"],
    markdown_body:
      '**{{ actor.name }}** replied to your question "{{ data.question_title }}": {{ data.reply_excerpt }}',
  },
  {
    key: "new-enrollment",
    name: "New enrollment",
    categories: ["new-enrollment"],
    markdown_body: "**{{ actor.name }}** enrolled in {{ data.course_title }}",
  },
];

// Categories must exist in the project-wide catalog before a workflow can use them.
for (const name of workflows.flatMap((w) => w.categories)) {
  const res = await fetch(`${MAPI}/preference_categories/${name}`, { method: "PUT", headers: h });
  console.log("category", name, res.status);
}

for (const w of workflows) {
  const res = await fetch(
    `${MAPI}/workflows/${w.key}?environment=development&commit=true&commit_message=${encodeURIComponent("PROTOTYPE knock spike")}`,
    {
      method: "PUT",
      headers: h,
      body: JSON.stringify({
        workflow: {
          name: w.name,
          categories: w.categories,
          steps: [
            {
              type: "channel",
              ref: "in_app_feed_1",
              channel_key: FEED_CHANNEL_KEY,
              template: { markdown_body: w.markdown_body, action_url: "{{ data.url }}" },
            },
          ],
        },
      }),
    },
  );
  console.log(w.key, res.status, (await res.text()).slice(0, 400));
}
