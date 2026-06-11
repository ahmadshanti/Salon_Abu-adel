import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  return token;
}

export async function savePushToken(userId: string, token: string) {
  await supabase.from('users').update({ expo_push_token: token }).eq('id', userId);
}

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  const message = {
    to: expoPushToken,
    sound: 'default' as const,
    title,
    body,
    data: data ?? {},
  };

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch {
    // Notification delivery is best-effort
  }
}

/** Push a best-effort notification to every admin device. */
export async function notifyAdmins(title: string, body: string): Promise<void> {
  try {
    const { data: admins } = await supabase
      .from('users')
      .select('expo_push_token')
      .eq('role', 'admin')
      .not('expo_push_token', 'is', null);
    admins?.forEach((a) => {
      if (a.expo_push_token) sendPushNotification(a.expo_push_token, title, body);
    });
  } catch {
    // Notification delivery is best-effort
  }
}

const reminderKey = (bookingId: string) => `reminder_${bookingId}`;

/** Schedule a local "30 minutes before" reminder for a booking.
    Skipped when the booking is less than 30 minutes away. Best-effort. */
export async function scheduleBookingReminder(bookingId: string, startTime: Date): Promise<void> {
  try {
    const reminderTime = new Date(startTime.getTime() - 30 * 60 * 1000);
    const seconds = (reminderTime.getTime() - Date.now()) / 1000;
    if (seconds <= 0) return;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'تذكير بموعدك',
        body: 'موعدك في صالون أبو عادل بعد 30 دقيقة',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.floor(seconds),
        repeats: false,
      },
    });
    await AsyncStorage.setItem(reminderKey(bookingId), id);
  } catch {
    // Reminders are best-effort
  }
}

/** Cancel the scheduled reminder for a booking (after cancel/reschedule). */
export async function cancelBookingReminder(bookingId: string): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(reminderKey(bookingId));
    if (!id) return;
    await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(reminderKey(bookingId));
  } catch {
    // Reminders are best-effort
  }
}
