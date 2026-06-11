import { useEffect, useState, useRef } from 'react';
import { Image, Text, StyleSheet, Animated, View } from 'react-native';
import { Slot, router, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import { registerForPushNotifications, savePushToken } from '../lib/utils/notifications';
import type { Session } from '@supabase/supabase-js';

type Role = 'customer' | 'admin' | null;

/* Auth screens that manage their own navigation (register signs out then goes
   to login; the reset flow holds a temporary recovery session). The root
   layout must not auto-redirect away from them. */
const SELF_MANAGED_AUTH_SCREENS = ['register', 'forgot-password', 'reset-password'];

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [role, setRole] = useState<Role>(null);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const segments = useSegments();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Logo fade-in + scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Load auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      if (session) fetchRole(session.user.id);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      if (session) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
      }
    });

    // Minimum splash duration
    const timer = setTimeout(() => setMinSplashDone(true), 2500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function fetchRole(userId: string) {
    try {
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
      setRole((data?.role as Role) ?? 'customer');
    } catch {
      setRole('customer');
    }

    registerForPushNotifications().then((token) => {
      if (token) savePushToken(userId, token);
    }).catch(() => {});
  }

  /* ── Route guard: runs while the splash still covers the screen,
     so the user never sees the wrong screen flash. ── */
  useEffect(() => {
    if (session === undefined) return;

    const inAuthGroup = segments[0] === '(auth)';
    const authScreen = inAuthGroup ? segments[1] : null;

    if (!session) {
      // Logged out → only auth screens are allowed
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    // Logged in but on a self-managed auth screen → leave it alone
    if (authScreen && SELF_MANAGED_AUTH_SCREENS.includes(authScreen)) return;

    if (!role) return; // wait until we know who the user is

    const homeGroup = role === 'admin' ? '(admin)' : '(user)';
    if (segments[0] !== homeGroup) {
      router.replace(role === 'admin' ? '/(admin)' : '/(user)');
    }
  }, [session, role, segments]);

  /* ── Hide splash only after the minimum time AND auth is resolved ── */
  const authReady = session !== undefined && (!session || role !== null);
  useEffect(() => {
    if (!showSplash || !minSplashDone || !authReady) return;
    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => setShowSplash(false));
  }, [minSplashDone, authReady, showSplash]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <Slot />
      {showSplash && (
        <Animated.View style={[styles.splash, { opacity: splashOpacity }]}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center', gap: 8 }}>
            <Text style={styles.salonName}>صالون أبو عادل</Text>
            <Image source={require('../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
          </Animated.View>
          <Animated.View style={[styles.goldLine, { opacity: fadeAnim }]} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  salonName: {
    color: '#C9A84C',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  logo: {
    width: 240,
    height: 240,
  },
  goldLine: {
    position: 'absolute',
    bottom: 60,
    width: 60,
    height: 2,
    backgroundColor: '#C9A84C',
    borderRadius: 1,
  },
});
