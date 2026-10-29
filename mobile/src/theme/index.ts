// Sakin Düzen: warm surfaces, muted green accents and clear, dark text.
export const theme = {
  colors: {
    background: '#F6F7F3',
    surface: '#FFFFFF',
    text: '#25352D',
    secondaryText: '#58675E',
    primary: '#35634B',
    border: '#DCE3DC',
    danger: '#A33434',
  },
  typography: {
    title: { fontSize: 28, lineHeight: 36, fontWeight: '700' as const },
    heading: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
    body: { fontSize: 16, lineHeight: 24 },
    caption: { fontSize: 14, lineHeight: 20 },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  touchTarget: { minWidth: 44, minHeight: 44 },
} as const;
