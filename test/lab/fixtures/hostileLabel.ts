import type { Node } from '@xyflow/react'

// Exercises FR-011 escaping: quotes, angle brackets, ampersands, and
// backslashes that could corrupt generated code/markup/XML if a target's
// escaper is wrong. Shared across exportComponentCode/exportSvg/exportBundle
// tests so all three targets are held to the same hostile input.
export const HOSTILE_LABEL = `<script>alert("x")</script> & \\ "quoted" 'single'`

export function hostileLabelNode(base: Node): Node {
  return { ...base, data: { ...base.data, label: HOSTILE_LABEL } }
}
