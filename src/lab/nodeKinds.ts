// Node "kinds" map to the className vocabulary already defined in App.css
// (see .react-flow__node.node / node-active / node-dim treatments).

export type NodeKind = 'default' | 'active' | 'dim'

export function classNameForKind(kind: NodeKind): string {
  if (kind === 'active') return 'node node-active'
  if (kind === 'dim') return 'node node-dim'
  return 'node'
}

export function kindForClassName(className: string | undefined): NodeKind {
  if (className === classNameForKind('active')) return 'active'
  if (className === classNameForKind('dim')) return 'dim'
  return 'default'
}
