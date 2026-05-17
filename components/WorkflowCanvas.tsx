'use client';

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import type { WorkflowSpec } from '@/lib/workflow-schema';

type WorkflowCanvasProps = {
  spec: WorkflowSpec | null;
};

export function WorkflowCanvas({ spec }: WorkflowCanvasProps) {
  if (!spec) {
    return (
      <div className="empty-state">
        <div>
          <strong>No workflow generated yet</strong>
          Use the microphone or text prompt to create a workflow preview.
        </div>
      </div>
    );
  }

  const nodes: Node[] = spec.nodes.map((workflowNode, index) => ({
    id: workflowNode.id,
    position: {
      x: 80 + (index % 3) * 330,
      y: 80 + Math.floor(index / 3) * 190,
    },
    data: {
      label: (
        <div className="node-shell">
          <div className="node-type">{workflowNode.type}</div>
          <div className="node-title">{workflowNode.label}</div>
          <div className="node-description">{workflowNode.description}</div>
        </div>
      ),
    },
  }));

  const edges: Edge[] = spec.edges.map((edge) => ({
    id: `${edge.from}-${edge.to}-${edge.branch}`,
    source: edge.from,
    target: edge.to,
    label: edge.label || (edge.branch === 'main' ? undefined : edge.branch),
    animated: edge.branch !== 'main',
  }));

  return (
    <ReactFlow nodes={nodes} edges={edges} fitView className="workflow-canvas">
      <Background />
      <Controls />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}
