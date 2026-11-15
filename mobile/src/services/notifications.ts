import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Remote push does not work inside Expo Go or on the web, so those are skipped. In Expo Go
// the app still updates live through realtime while it is open.
function pushIsSupported(): boolean {
  return (
    Platform.OS !== 'web' &&
    Device.isDevice &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  );
}

function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

/**
 * Asks for permission and stores this device's Expo push token against the user.
 * Push is a nice-to-have, so every failure here is swallowed: the app must work without it.
 */
export async function registerForPush(userId: string): Promise<void> {
  const projectId = easProjectId();
  if (!pushIsSupported() || !projectId) return;
  try {
    // Loaded lazily so the module is never touched where push is unsupported.
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase
      .from('push_tokens')
      .upsert({ user_id: userId, token }, { onConflict: 'user_id,token', ignoreDuplicates: true });
  } catch {
    // Deliberately ignored; see the function comment.
  }
}

/** Stops notifications for this account on sign-out (shared phones, switching logins). */
export async function unregisterPush(userId: string): Promise<void> {
  try {
    await supabase.from('push_tokens').delete().eq('user_id', userId);
  } catch {
    // Signing out must never fail because of push clean-up.
  }
}
