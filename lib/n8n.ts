import type { WorkflowNode, WorkflowSpec } from './workflow-schema';

type N8nConnection = {
  node: string;
  type: 'main';
  index: number;
};

type N8nNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
};

const nodeTypeMap: Record<WorkflowNode['type'], { type: string; version: number }> = {
  manualTrigger: { type: 'n8n-nodes-base.manualTrigger', version: 1 },
  webhook: { type: 'n8n-nodes-base.webhook', version: 2 },
  schedule: { type: 'n8n-nodes-base.scheduleTrigger', version: 1.2 },
  httpRequest: { type: 'n8n-nodes-base.httpRequest', version: 4.2 },
  set: { type: 'n8n-nodes-base.set', version: 3.4 },
  if: { type: 'n8n-nodes-base.if', version: 2.2 },
  code: { type: 'n8n-nodes-base.code', version: 2 },
};

export function toN8nWorkflow(spec: WorkflowSpec) {
  const nodes = spec.nodes.map((node, index) => toN8nNode(node, index));
  const nameById = new Map(nodes.map((node, index) => [spec.nodes[index].id, node.name]));
  const connections: Record<string, { main: N8nConnection[][] }> = {};

  spec.edges.forEach((edge) => {
    const sourceName = nameById.get(edge.from);
    const targetName = nameById.get(edge.to);

    if (!sourceName || !targetName) {
      return;
    }

    const outputIndex = edge.branch === 'false' ? 1 : 0;
    connections[sourceName] ??= { main: [] };
    connections[sourceName].main[outputIndex] ??= [];
    connections[sourceName].main[outputIndex].push({
      node: targetName,
      type: 'main',
      index: 0,
    });
  });

  return {
    name: spec.workflowName,
    nodes,
    connections,
    settings: {
      executionOrder: 'v1',
    },
    active: false,
    versionId: crypto.randomUUID(),
    meta: {
      templateCredsSetupCompleted: false,
      generatedBy: 'Voice Workflow Automation Builder',
    },
  };
}

function toN8nNode(node: WorkflowNode, index: number): N8nNode {
  const mapped = nodeTypeMap[node.type];

  return {
    id: node.id,
    name: node.label,
    type: mapped.type,
    typeVersion: mapped.version,
    position: calculatePosition(index),
    parameters: buildParameters(node),
  };
}

function calculatePosition(index: number): [number, number] {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return [180 + column * 310, 220 + row * 220];
}

function buildParameters(node: WorkflowNode): Record<string, unknown> {
  switch (node.type) {
    case 'manualTrigger':
      return {};
    case 'webhook':
      return {
        httpMethod: 'POST',
        path: node.config.path || node.id,
        responseMode: 'onReceived',
      };
    case 'schedule':
      return {
        rule: {
          interval: [
            {
              field: 'hours',
              hoursInterval: 1,
            },
          ],
        },
      };
    case 'httpRequest':
      return {
        method: node.config.method || 'POST',
        url: node.config.url || 'https://example.com/api',
        sendBody: Boolean(node.config.bodyJson),
        specifyBody: 'json',
        jsonBody: node.config.bodyJson || '',
        options: {},
      };
    case 'set':
      return {
        assignments: {
          assignments: Object.entries(node.config.fields || { status: 'created' }).map(
            ([name, value], index) => ({
              id: `${node.id}-${index}`,
              name,
              value,
              type: 'string',
            }),
          ),
        },
        options: {},
      };
    case 'if':
      return {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: '',
            typeValidation: 'strict',
          },
          conditions: [
            {
              id: `${node.id}-condition`,
              leftValue: node.config.condition || '={{ $json.status }}',
              rightValue: 'true',
              operator: {
                type: 'string',
                operation: 'contains',
              },
            },
          ],
          combinator: 'and',
        },
        options: {},
      };
    case 'code':
      return {
        jsCode:
          node.config.jsCode ||
          "return items.map(item => ({ json: { ...item.json, processed: true } }));",
      };
    default:
      return {};
  }
}
