// Design tokens the user brings from their own project so the exported code
// (see exportComponentCode.ts, exportSvg.ts) matches their brand instead of
// this tool's defaults.
export type DesignTokens = {
  primaryColor: string
  secondaryColor: string
  headingFont: string
  bodyFont: string
}

export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  primaryColor: '#ff4715',
  secondaryColor: '#d8d4cf',
  headingFont: 'JetBrains Mono, sans-serif',
  bodyFont: 'JetBrains Mono, sans-serif',
}

export type DesignTokenKey = keyof DesignTokens
