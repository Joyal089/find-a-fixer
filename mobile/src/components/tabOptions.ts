import { colours, fontSize } from '@/constants/theme';

/** Shared look for the customer and company tab bars: text-only, large labels. */
export const tabScreenOptions = {
  headerStyle: { backgroundColor: colours.background },
  headerTintColor: colours.text,
  headerShadowVisible: false,
  sceneStyle: { backgroundColor: colours.background },
  tabBarStyle: { backgroundColor: colours.background, borderTopColor: colours.border },
  tabBarActiveTintColor: colours.accent,
  tabBarInactiveTintColor: colours.textMuted,
  tabBarLabelStyle: { fontSize: fontSize.body, fontWeight: '700' as const },
  tabBarIconStyle: { display: 'none' as const },
  tabBarLabelPosition: 'beside-icon' as const,
};
