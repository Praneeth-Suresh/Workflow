import { openai } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { NextResponse } from 'next/server';
import {
  WorkflowOptimizationQuestionSchema,
  WorkflowOptimizationSelectionSchema,
  WorkflowSpecGenerationSchema,
  normalizeGeneratedWorkflowSpec,
  validateWorkflowSpec,
} from '@/lib/workflow-schema';
import { toN8nWorkflow } from '@/lib/n8n';

export const runtime = 'nodejs';

const systemPrompt = `You create compact n8n automation workflows from plain English voice transcripts.

Return a valid workflow specification only. Use exactly one trigger node and between 2 and 10 total nodes.

Allowed node types:
- manualTrigger: use when the user does not specify an external trigger.
- webhook: use when the workflow should start from a form, app event, or incoming API request.
- schedule: use when the workflow should run periodically.
- set: use to normalize, map, or prepare fields.
- httpRequest: use for external APIs, notifications, app integrations, Slack webhooks, email APIs, CRM APIs, or other services.
- if: use for branching on validated data.
- code: use only for small transformations that cannot be represented by set.

Prefer placeholders over fake credentials. Put credential and activation caveats in warnings.
Branch only on concrete conditions. If an action is sensitive, destructive, or externally visible, set reviewRequired true.
Do not represent human approval, manual review, waiting, or review safety as extra trigger nodes.
Represent review needs with reviewRequired, warnings, and ordinary action nodes such as set or httpRequest when a draft payload must be prepared.
Keep labels short and business-readable. Use kebab-case ids.

For every node config, always include all keys: method, url, path, cron, condition, fields, jsCode, bodyJson.
When a key is not used for that node, set it to null.
For every edge, always include label and branch. Use null when no label is needed.`;

const optimizationQuestionPrompt = `You help choose how an n8n workflow draft should be optimized before it is generated.

Return exactly one multiple-choice question with exactly three answer options.
The question must ask the user which optimization priority should guide the workflow design.
Make the options distinct and practical for n8n workflow generation, such as review safety, fewer nodes, clearer debugging, lower external API usage, or faster automation.
Use kebab-case ids. Keep labels short and descriptions specific.`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      prompt?: string;
      optimization?: unknown;
    };
    const action = body.action || 'createOptimizationQuestion';
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is missing. Add it to .env.local and restart the dev server.' },
        { status: 500 },
      );
    }

    if (action === 'createOptimizationQuestion') {
      const result = await generateText({
        model: openai(process.env.OPENAI_MODEL || 'gpt-4.1-mini'),
        output: Output.object({
          schema: WorkflowOptimizationQuestionSchema,
          name: 'workflow_optimization_question',
          description: 'One multiple-choice question that selects the workflow optimization priority.',
        }),
        system: optimizationQuestionPrompt,
        prompt: `Workflow request:\n${prompt}\n\nCreate the optimization question.`,
      });

      return NextResponse.json({
        optimizationQuestion: result.output,
      });
    }

    if (action !== 'generateWorkflow') {
      return NextResponse.json({ error: 'Unknown workflow generation action.' }, { status: 400 });
    }

    const optimization = WorkflowOptimizationSelectionSchema.safeParse(body.optimization);

    if (!optimization.success) {
      return NextResponse.json(
        { error: 'Selected optimization answer is required before workflow generation.' },
        { status: 400 },
      );
    }

    const result = await generateText({
      model: openai(process.env.OPENAI_MODEL || 'gpt-4.1-mini'),
      output: Output.object({
        schema: WorkflowSpecGenerationSchema,
        name: 'n8n_workflow_spec',
        description: 'A validated intermediate workflow spec that can be converted to n8n JSON.',
      }),
      system: systemPrompt,
      prompt: `Voice transcript:\n${prompt}

Optimization question shown to the user:
${optimization.data.question}

Selected optimization priority:
${optimization.data.selectedOption.label} - ${optimization.data.selectedOption.description}

Create the workflow specification optimized for that selected priority.`,
    });

    const workflowSpec = normalizeGeneratedWorkflowSpec(result.output);
    const validationErrors = validateWorkflowSpec(workflowSpec);

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'The model generated a structurally invalid workflow.',
          details: validationErrors,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      spec: workflowSpec,
      n8n: toN8nWorkflow(workflowSpec),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown workflow generation error.';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
