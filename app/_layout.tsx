import { useEffect, useState, useRef } from 'react';
import { Image, Text, StyleSheet, Animated } from 'react-native';
import { Slot, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import Logo from '../assets';
import { registerForPushNotifications, savePushToken } from '../lib/utils/notifications';
import type { Session } from '@supabase/supabase-js';

type Role = 'customer' | 'admin' | null;

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [role, setRole] = useState<Role>(null);
  const [showSplash, setShowSplash] = useState(true);

  const didNavigate = useRef(false);
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
        didNavigate.current = false;
      }
    });

    // Hide splash after 2.5s minimum
    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setShowSplash(false));
    }, 2500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function fetchRole(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    setRole((data?.role as Role) ?? 'customer');

    registerForPushNotifications().then((token) => {
      if (token) savePushToken(userId, token);
    }).catch(() => {});
  }

  // Navigate once splash is gone and we know who the user is
  useEffect(() => {
    if (showSplash || session === undefined) return;

    if (!session) {
      router.replace('/(auth)/login');
      return;
    }

    if (!role) return;
    if (didNavigate.current) return;
    didNavigate.current = true;

    router.replace(role === 'admin' ? '/(admin)' : '/(user)');
  }, [showSplash, session, role]);

  if (showSplash) {
    return (
      <Animated.View style={[styles.splash, { opacity: splashOpacity }]}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center', gap: 8 }}>
          <Text style={styles.salonName}>صالون أبو عادل</Text>
          <Image source={Logo} style={styles.logo} resizeMode="contain" />
        </Animated.View>
        <Animated.View style={[styles.goldLine, { opacity: fadeAnim }]} />
      </Animated.View>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  salonName: {
    color: '#C9A84C',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 4,
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
