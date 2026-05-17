# Agent Instructions

These instructions are for coding agents modifying this application.

## Project Purpose

This folder contains a demo Voice Powered Automation Builder. The core requirement is that workflow generation happens through the Vercel AI SDK on the server, first asking one optimization multiple-choice question, then visualizing the generated workflow before exporting n8n JSON.

Do not replace the AI SDK generation path with client-side generation, direct OpenAI SDK calls, or raw prompt-to-n8n JSON.

## Important Files

- `app/api/generate-workflow/route.ts`: server-side AI SDK route for optimization-question generation and workflow generation.
- `lib/workflow-schema.ts`: optimization question schema, intermediate workflow schema, and structural validation.
- `lib/n8n.ts`: conversion from intermediate spec to n8n workflow JSON.
- `components/WorkflowBuilder.tsx`: voice/text input, optimization question step, generation request, summary, copy, and download.
- `components/WorkflowCanvas.tsx`: React Flow visualization.
- `workflow-run-through.md`: implementation guide and design rationale.

## Design Rules

1. Keep an intermediate workflow schema between the model and n8n JSON.
2. Validate model output before conversion.
3. Keep generated n8n workflows inactive by default.
4. Prefer placeholder URLs and warnings over fake credentials.
5. Represent sensitive or externally visible actions through `reviewRequired` and warnings.
6. Use off-the-shelf libraries for visualization and browser/UI concerns.
7. Keep voice input as a progressive enhancement with text fallback.
8. Keep generation multi-step: prompt -> one optimization MCQ -> validated workflow preview/export.
9. Keep provider-facing structured-output schemas strict-compatible: required object properties should be explicit, and unused workflow config fields should be represented as `null` rather than omitted.

## Adding New Node Types

When adding a new workflow node type:

1. Add the enum value in `workflowNodeTypes`.
2. Extend both `WorkflowNodeSchema.config` (app/domain schema) and `WorkflowSpecGenerationSchema` (model-facing schema) only if needed.
3. Update the system prompt in `app/api/generate-workflow/route.ts`.
4. Add a mapping in `nodeTypeMap` in `lib/n8n.ts`.
5. Add parameter conversion in `buildParameters`.
6. Add or update a sample in `lib/examples.ts`.
7. Test by generating and importing the JSON into n8n.

## Testing Expectations

At minimum, run:

```bash
npm run build
```

When UI behavior changes, also run:

```bash
npm run dev
```

Then test:

- Sample workflow rendering.
- Text prompt generation.
- Optimization question selection before workflow generation.
- Downloaded JSON import into n8n.
- Mobile-width layout.

## Safety Notes

This app should not execute generated workflows. It should only generate, preview, and export inactive drafts. Execution belongs in n8n after user review and credential setup.
