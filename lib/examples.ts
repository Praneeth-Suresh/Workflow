import type { WorkflowSpec } from './workflow-schema';

export const sampleWorkflow: WorkflowSpec = {
  workflowName: 'Lead Enrichment Follow Up',
  description:
    'Capture a new lead, enrich the profile through an API, branch on company size, and prepare a follow-up payload for export into n8n.',
  reviewRequired: true,
  assumptions: [
    'The enrichment service is represented by a placeholder HTTP endpoint.',
    'The approval step is modeled as a review-required warning before export.',
  ],
  warnings: [
    'Replace placeholder URLs and add credentials inside n8n before activating the workflow.',
  ],
  nodes: [
    {
      id: 'new-lead',
      type: 'webhook',
      label: 'New Lead',
      description: 'Receives a new lead payload from a form or CRM webhook.',
      config: { path: 'new-lead' },
    },
    {
      id: 'normalize-lead',
      type: 'set',
      label: 'Normalize Lead',
      description: 'Keeps only the fields required for enrichment and follow-up routing.',
      config: {
        fields: {
          email: '={{ $json.email }}',
          company: '={{ $json.company }}',
          source: 'voice-builder',
        },
      },
    },
    {
      id: 'enrich-company',
      type: 'httpRequest',
      label: 'Enrich Company',
      description: 'Calls a company enrichment API using the submitted email domain.',
      config: {
        method: 'POST',
        url: 'https://example.com/enrich',
        bodyJson: '{"email":"={{ $json.email }}"}',
      },
    },
    {
      id: 'enterprise-check',
      type: 'if',
      label: 'Enterprise Check',
      description: 'Routes leads based on whether the enrichment result marks them enterprise.',
      config: {
        condition: '={{ $json.isEnterprise }}',
      },
    },
    {
      id: 'sales-alert',
      type: 'httpRequest',
      label: 'Sales Alert',
      description: 'Sends enterprise leads to a sales notification endpoint.',
      config: {
        method: 'POST',
        url: 'https://example.com/sales-alert',
        bodyJson: '{"lead":"={{ $json }}"}',
      },
    },
    {
      id: 'nurture-list',
      type: 'set',
      label: 'Nurture List',
      description: 'Tags smaller leads for a nurture campaign payload.',
      config: {
        fields: {
          segment: 'nurture',
          status: 'queued',
        },
      },
    },
  ],
  edges: [
    { from: 'new-lead', to: 'normalize-lead', branch: 'main' },
    { from: 'normalize-lead', to: 'enrich-company', branch: 'main' },
    { from: 'enrich-company', to: 'enterprise-check', branch: 'main' },
    { from: 'enterprise-check', to: 'sales-alert', branch: 'true', label: 'Enterprise' },
    { from: 'enterprise-check', to: 'nurture-list', branch: 'false', label: 'Not enterprise' },
  ],
};
