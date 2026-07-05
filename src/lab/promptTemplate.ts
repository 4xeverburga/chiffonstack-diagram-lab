import type { DesignTokens } from './designTokens'

export type PromptFileInfo = {
  name: string
  role: string
}

const BUNDLE_FILES: PromptFileInfo[] = [
  { name: 'Diagram.tsx', role: 'the React Flow component — renders the diagram live' },
  { name: 'diagram.css', role: 'styles for Diagram.tsx, namespaced under .chiffon-diagram' },
  { name: 'diagram.json', role: 'the canonical diagram data — re-imports into Diagram Lab unchanged' },
  { name: 'prompt.md', role: 'this file' },
]

// Generates the bundle's prompt.md: everything a coding agent (or a human)
// needs to integrate the diagram without asking follow-up questions
// (specs/001-export-suite/contracts/bundle.md, SC-003).
export function promptTemplate(
  tokens: DesignTokens,
  hasAssets: boolean,
  nodeCount: number,
  edgeCount: number,
): string {
  const fileRows = [...BUNDLE_FILES, ...(hasAssets ? [{ name: 'assets/', role: 'a copy of each embedded node image, for asset-pipeline migration' }] : [])]
    .map((file) => `| \`${file.name}\` | ${file.role} |`)
    .join('\n')

  return `# Diagram bundle

This is a self-contained, animated architecture diagram exported from
Diagram Lab: ${nodeCount} node(s) and ${edgeCount} edge(s). It renders live —
heat-flow animation plays, pan/zoom works — styled by four design tokens, no
Diagram Lab branding.

## Files

| File | Role |
|---|---|
${fileRows}

## Design tokens

Diagram.tsx sets these as \`--token-*\` CSS custom properties on the
\`.chiffon-diagram\` wrapper; diagram.css reads them from there. Change a
value in Diagram.tsx's \`tokens\` constant (or re-export from Diagram Lab) to
restyle the whole diagram.

| Token | Controls | Current value |
|---|---|---|
| \`--token-primary\` | active-node accent, heat-flow edge color | \`${tokens.primaryColor}\` |
| \`--token-secondary\` | default/dashed edge color, node border hairlines | \`${tokens.secondaryColor}\` |
| \`--token-heading-font\` | node labels | \`${tokens.headingFont}\` |
| \`--token-body-font\` | node body text | \`${tokens.bodyFont}\` |

## Integration steps

1. Install the peer dependency: \`npm install @xyflow/react\`.
2. Copy \`Diagram.tsx\` and \`diagram.css\` into your project (same folder).
3. Import and render it: \`import Diagram from './Diagram'\` then \`<Diagram />\`.
4. Size the container: give an ancestor element (or \`.chiffon-diagram\`
   itself) an explicit width and height — the component fills 100% of its
   parent.
${hasAssets ? "5. Optional: swap the inline data-URI images for files from `assets/` if your project has its own asset pipeline — update the `image` field on the matching node in `Diagram.tsx`.\n" : ''}
## Verification checklist

- [ ] Heat-flow edges animate
- [ ] Pan/zoom works, and page scrolling isn't hijacked
- [ ] Colors and fonts match the host site's design tokens
- [ ] \`diagram.json\` re-imports into Diagram Lab and reproduces this diagram
`
}
