/* Palette for the auth screens (login / register / password reset).
   The user-facing screens use a slightly brighter gold than the admin theme. */
export const authPalette = {
  GOLD: '#D4AF37',
  BG: '#0B0B0F',
  BORDER: 'rgba(255,255,255,0.08)',
  GOLD_BD: 'rgba(212,175,55,0.30)',
  WHITE: '#FFFFFF',
  MUTED: 'rgba(255,255,255,0.40)',
} as const;

export const colors = {
  background: '#0A0A0F',
  card: '#141418',
  border: '#2a2a2a',
  gold: '#C9A84C',
  goldTransparent: '#C9A84C22',
  goldLight: '#C9A84C33',
  goldFaint: '#C9A84C11',
  white: '#fff',
  muted: '#888',
  heroCard: '#1A1500',
  tabBar: '#111116',
  error: '#E05252',
  success: '#4CAF50',
  text: {
    primary: '#fff',
    secondary: '#aaa',
    muted: '#888',
  },
};
