import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colours } from '@/constants/theme';
import { SessionProvider } from '@/hooks/useSession';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colours.accent,
    background: colours.background,
    card: colours.background,
    text: colours.text,
    border: colours.border,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colours.background },
            headerTintColor: colours.text,
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colours.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="verify" options={{ title: 'Verify your number' }} />
          <Stack.Screen name="company-login" options={{ title: 'Partners' }} />
          <Stack.Screen name="company-profile" options={{ title: 'Company profile' }} />
          <Stack.Screen name="customer" options={{ headerShown: false }} />
          <Stack.Screen name="company" options={{ headerShown: false }} />
          <Stack.Screen name="job/[id]/index" options={{ title: 'Job' }} />
          <Stack.Screen name="job/[id]/quote" options={{ title: 'Send a quote' }} />
          <Stack.Screen name="job/[id]/chat" options={{ title: 'Messages' }} />
        </Stack>
      </SessionProvider>
    </ThemeProvider>
  );
}
