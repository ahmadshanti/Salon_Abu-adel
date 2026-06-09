import { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors } from '../constants/theme';
import type { Session } from '@supabase/supabase-js';

type Role = 'customer' | 'admin' | null;

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [role, setRole] = useState<Role>(null);
  const didNavigate = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      if (session) fetchRole(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      if (session) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
        didNavigate.current = false;
        router.replace('/(auth)/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchRole(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    setRole((data?.role as Role) ?? 'customer');
  }

  useEffect(() => {
    if (session === undefined || !session || !role) return;
    if (didNavigate.current) return;
    didNavigate.current = true;
    if (role === 'admin') {
      router.replace('/(admin)');
    } else {
      router.replace('/(user)');
    }
  }, [session, role]);

  if (session === undefined || (session !== null && !role)) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
