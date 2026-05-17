import { z } from 'zod';

const forbiddenFieldNames = new Set(['__proto__', 'prototype', 'constructor']);
const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const workflowFieldsSchema = z.object({}).catchall(z.string());

export const workflowNodeTypes = [
  'manualTrigger',
  'webhook',
  'schedule',
  'httpRequest',
  'set',
  'if',
  'code',
] as const;

export const WorkflowNodeConfigSchema = z
  .object({
    method: z.enum(httpMethods).optional(),
    url: z.string().optional(),
    path: z.string().optional(),
    cron: z.string().optional(),
    condition: z.string().optional(),
    fields: workflowFieldsSchema.optional(),
    jsCode: z.string().optional(),
    bodyJson: z.string().optional(),
  })
  .default({});

export const WorkflowNodeSchema = z.object({
  id: z
    .string()
    .min(2)
    .regex(/^[a-z][a-z0-9-]*$/, 'Use kebab-case ids that start with a letter.'),
  type: z.enum(workflowNodeTypes),
  label: z.string().min(2).max(60),
  description: z.string().min(8).max(180),
  config: WorkflowNodeConfigSchema,
});

export const WorkflowEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().max(50).optional(),
  branch: z.enum(['main', 'true', 'false']).default('main'),
});

export const WorkflowSpecSchema = z.object({
  workflowName: z.string().min(3).max(80),
  description: z.string().min(10).max(400),
  reviewRequired: z.boolean(),
  assumptions: z.array(z.string().min(3).max(160)).default([]),
  warnings: z.array(z.string().min(3).max(180)).default([]),
  nodes: z.array(WorkflowNodeSchema).min(2).max(10),
  edges: z.array(WorkflowEdgeSchema).min(1).max(14),
});

export type WorkflowSpec = z.infer<typeof WorkflowSpecSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

const OptimizationOptionSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9-]*$/, 'Use kebab-case ids that start with a letter.'),
  label: z.string().min(2).max(60),
  description: z.string().min(8).max(180),
});

export const WorkflowOptimizationQuestionSchema = z.object({
  question: z.string().min(10).max(180),
  options: z.array(OptimizationOptionSchema).length(3),
});

export const WorkflowOptimizationSelectionSchema = z.object({
  question: z.string().min(10).max(180),
  selectedOption: OptimizationOptionSchema,
});

export type WorkflowOptimizationQuestion = z.infer<typeof WorkflowOptimizationQuestionSchema>;
export type WorkflowOptimizationSelection = z.infer<typeof WorkflowOptimizationSelectionSchema>;

const WorkflowNodeConfigGenerationSchema = z.object({
  method: z.enum(httpMethods).nullable(),
  url: z.string().nullable(),
  path: z.string().nullable(),
  cron: z.string().nullable(),
  condition: z.string().nullable(),
  fields: workflowFieldsSchema.nullable(),
  jsCode: z.string().nullable(),
  bodyJson: z.string().nullable(),
});

const WorkflowNodeGenerationSchema = z.object({
  id: z
    .string()
    .min(2)
    .regex(/^[a-z][a-z0-9-]*$/, 'Use kebab-case ids that start with a letter.'),
  type: z.enum(workflowNodeTypes),
  label: z.string().min(2).max(60),
  description: z.string().min(8).max(180),
  config: WorkflowNodeConfigGenerationSchema,
});

const WorkflowEdgeGenerationSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().max(50).nullable(),
  branch: z.enum(['main', 'true', 'false']),
});

export const WorkflowSpecGenerationSchema = z.object({
  workflowName: z.string().min(3).max(80),
  description: z.string().min(10).max(400),
  reviewRequired: z.boolean(),
  assumptions: z.array(z.string().min(3).max(160)),
  warnings: z.array(z.string().min(3).max(180)),
  nodes: z.array(WorkflowNodeGenerationSchema).min(2).max(10),
  edges: z.array(WorkflowEdgeGenerationSchema).min(1).max(14),
});

export type WorkflowSpecGeneration = z.infer<typeof WorkflowSpecGenerationSchema>;

export function normalizeGeneratedWorkflowSpec(spec: WorkflowSpecGeneration): WorkflowSpec {
  return WorkflowSpecSchema.parse({
    workflowName: spec.workflowName,
    description: spec.description,
    reviewRequired: spec.reviewRequired,
    assumptions: spec.assumptions,
    warnings: spec.warnings,
    nodes: spec.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      description: node.description,
      config: normalizeGeneratedConfig(node.config),
    })),
    edges: spec.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      ...(edge.label === null ? {} : { label: edge.label }),
      branch: edge.branch,
    })),
  });
}

function normalizeGeneratedConfig(
  config: z.infer<typeof WorkflowNodeConfigGenerationSchema>,
): WorkflowNode['config'] {
  const normalizedConfig: WorkflowNode['config'] = {};

  if (config.method !== null) {
    normalizedConfig.method = config.method;
  }
  if (config.url !== null) {
    normalizedConfig.url = config.url;
  }
  if (config.path !== null) {
    normalizedConfig.path = config.path;
  }
  if (config.cron !== null) {
    normalizedConfig.cron = config.cron;
  }
  if (config.condition !== null) {
    normalizedConfig.condition = config.condition;
  }
  if (config.fields !== null) {
    normalizedConfig.fields = config.fields;
  }
  if (config.jsCode !== null) {
    normalizedConfig.jsCode = config.jsCode;
  }
  if (config.bodyJson !== null) {
    normalizedConfig.bodyJson = config.bodyJson;
  }

  return normalizedConfig;
}

export function validateWorkflowSpec(spec: WorkflowSpec) {
  const nodeIds = new Set(spec.nodes.map((node) => node.id));
  const errors: string[] = [];

  spec.edges.forEach((edge) => {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge starts from unknown node "${edge.from}".`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge points to unknown node "${edge.to}".`);
    }
  });

  const triggerNodes = spec.nodes.filter((node) =>
    ['manualTrigger', 'webhook', 'schedule'].includes(node.type),
  );

  if (triggerNodes.length !== 1) {
    errors.push('Workflow must contain exactly one trigger node.');
  }

  const incoming = new Set(spec.edges.map((edge) => edge.to));
  const startNodes = spec.nodes.filter((node) => !incoming.has(node.id));

  if (startNodes.length !== 1) {
    errors.push('Workflow must have exactly one start node.');
  } else if (!['manualTrigger', 'webhook', 'schedule'].includes(startNodes[0].type)) {
    errors.push('The start node must be a trigger node.');
  }

  spec.nodes.forEach((node) => {
    if (!node.config.fields) {
      return;
    }

    Object.keys(node.config.fields).forEach((fieldName) => {
      if (fieldName.trim().length === 0) {
        errors.push(`Node "${node.id}" contains an empty set field name.`);
      }

      if (fieldName.length > 80) {
        errors.push(`Node "${node.id}" field "${fieldName}" exceeds 80 characters.`);
      }

      if (forbiddenFieldNames.has(fieldName)) {
        errors.push(`Node "${node.id}" uses forbidden field name "${fieldName}".`);
      }
    });
  });

  return errors;
}
