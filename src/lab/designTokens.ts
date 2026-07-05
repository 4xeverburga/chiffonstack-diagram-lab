// Design tokens the user brings from their own project so the exported code
// (see exportCode.ts) matches their brand instead of this tool's defaults.
export type DesignTokens = {
  primaryColor: string
  secondaryColor: string
  headingFont: string
  bodyFont: string
}

export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  primaryColor: '#ff4715',
  secondaryColor: '#1f2937',
  headingFont: 'Quicksand, sans-serif',
  bodyFont: 'Hanken Grotesk, sans-serif',
}

export type DesignTokenKey = keyof DesignTokens
