import type { Edge, Node } from '@xyflow/react'

// Strips React Flow's internal/runtime fields down to the shape this lab's
// initialNodes/initialEdges already use, so the copied JSON can be pasted
// straight back in as a saved layout.
export function serializeDiagram(nodes: Node[], edges: Edge[]): string {
  const plainNodes = nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: { label: node.data.label },
    className: node.className,
  }))

  const plainEdges = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    data: edge.data,
  }))

  return JSON.stringify({ nodes: plainNodes, edges: plainEdges }, null, 2)
}

export async function copyDiagramToClipboard(nodes: Node[], edges: Edge[]): Promise<void> {
  const json = serializeDiagram(nodes, edges)
  await navigator.clipboard.writeText(json)
}
