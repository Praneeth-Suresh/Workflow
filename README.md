# Voice Workflow Automation Builder

A small React/Next.js prototype that turns a voice or text workflow request into:

1. One optimization multiple-choice question.
2. A validated intermediate workflow graph.
3. A visual workflow preview.
4. An importable n8n JSON workflow file.

The core workflow creation happens in `app/api/generate-workflow/route.ts` using the Vercel AI SDK. The browser can preview and download a built-in example without contacting a model.


## Try the sample without an API key

From this repository's root, run:

```bash
npm ci
npm run dev
```

Use Node.js 24 LTS, which satisfies the locked runtime and tooling requirements. Open http://localhost:3000/ and select **Sample**. You should see the `Lead Enrichment Follow Up` graph. Inspect the warning and JSON preview, then select **Download** to see the inactive n8n export. This path does not need n8n, microphone access, or an API key.

## What It Does

- Takes one voice input through the browser Web Speech API.
- Falls back to a normal text prompt.
- Calls the Vercel AI SDK server-side with structured output for both the optimization question and workflow draft.
- Requires the user to choose one optimization priority before workflow generation.
- Validates the generated workflow graph.
- Converts the graph into n8n workflow JSON.
- Shows a React Flow visualization before export.
- Downloads an inactive n8n workflow JSON file.


## Generate a draft with a model

Copy `.env.example` to `.env.local` from the repository root, set your OpenAI API key, then restart the dev server. `OPENAI_MODEL` is optional; the example file shows how to set it.

For live generation, use fictional text rather than customer or personal data: the server sends your request to the model provider. Voice input depends on browser Web Speech support, and typed input works without microphone access.

## How To Use

1. Click the microphone button and describe the automation you want, or type in the text area.
2. Click **Continue**.
3. Choose one optimization priority from the generated multiple-choice question.
4. Click **Build workflow**.
5. Review the workflow visualization.
6. Read the assumptions and warnings.
7. Inspect the JSON preview.
8. Click **Download** to export the n8n workflow JSON.
9. Import the JSON into n8n.
10. Review every node and external destination in a sandbox n8n instance before adding credentials or activating the workflow. The schema checks structure; it does not guarantee that a generated action is appropriate.

## Example Prompt

```text
When a new support ticket arrives, classify whether it is billing or technical.
If it is billing, create a human review step before sending a Slack webhook.
If it is technical, prepare a troubleshooting response and send it to the helpdesk API.
```

## How Generation Works

The app does not ask the model to emit raw n8n JSON. It first asks the model for one structured optimization question, then asks for a smaller typed graph using the selected answer as design guidance:

- Workflow metadata.
- One trigger node.
- A list of allowed action nodes.
- Typed edges between nodes.
- Assumptions and warnings.

That graph is validated in `lib/workflow-schema.ts` and then converted to n8n JSON in `lib/n8n.ts`.

This is easier to debug and safer than directly trusting arbitrary generated n8n JSON.

The model-facing workflow generation schema intentionally requires every node `config` key and uses `null` for unused values. This keeps the response format compatible with strict structured-output providers while the app-facing schema remains ergonomic.

## Supported Draft Node Types

- Manual trigger
- Webhook trigger
- Schedule trigger
- HTTP request
- Set fields
- If branch
- Code transform

Most real app integrations are represented as HTTP requests. Configure credentials and exact endpoints in n8n after import.

## Known Limits

- The app creates draft workflows, not production-ready activated automations.
- It does not connect to an n8n instance directly.
- It does not store workflow history.
- Voice input depends on browser support.
- Generated workflows use placeholders for credentials and sensitive endpoints.

## Recommended Development Loop

1. Improve the optimization-question or workflow prompt in `app/api/generate-workflow/route.ts`.
2. Extend `WorkflowSpecGenerationSchema` (model-facing) and normalize into `WorkflowSpecSchema` (app-facing) in `lib/workflow-schema.ts`.
3. Add the matching converter behavior in `lib/n8n.ts`.
4. Verify the React Flow preview still renders correctly.
5. Import the downloaded JSON into n8n and test it.

## Troubleshooting

`OPENAI_API_KEY is missing`

Add `.env.local` and restart the dev server.

`This browser does not expose the Web Speech API`

Use the text area or switch to a browser with speech recognition support.

`The model generated a structurally invalid workflow`

Try a clearer prompt. For production, add a repair pass that asks the model to fix only the validation errors.

`n8n import succeeds but a node needs configuration`

That is expected for placeholder URLs, API credentials, and app-specific integrations.
