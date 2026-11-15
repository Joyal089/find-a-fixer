// Dark, sleek: black background, one accent colour, large clear buttons.
export const colours = {
  background: '#000000',
  surface: '#121212',
  surfaceRaised: '#1C1C1C',
  border: '#2B2B2B',
  text: '#FFFFFF',
  textMuted: '#A3A3A3',
  accent: '#FF6B1A',
  onAccent: '#000000',
  danger: '#FF5A5F',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 14, pill: 999 } as const;
export const fontSize = { small: 13, body: 16, large: 20, title: 28 } as const;

/** Minimum height for anything tappable. */
export const TOUCH_TARGET = 56;
/** Keeps forms readable on wide web screens. */
export const MAX_CONTENT_WIDTH = 640;
