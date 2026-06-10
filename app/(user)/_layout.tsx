import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Home, CalendarDays, Sparkles, User } from 'lucide-react-native';
import { colors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

function TabIcon({
  Icon,
  label,
  focused,
}: {
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={styles.tabItem}>
      <Icon
        size={22}
        color={focused ? '#D4AF37' : 'rgba(255,255,255,0.28)'}
        strokeWidth={focused ? 2 : 1.5}
      />
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
      {focused && <View style={styles.dot} />}
    </View>
  );
}

function ProfileTabIcon({ focused }: { focused: boolean }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('users')
        .select('avatar_url')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setAvatarUrl(data?.avatar_url ?? null));
    });
  }, []);

  return (
    <View style={styles.tabItem}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.profileAvatar, focused && styles.profileAvatarFocused]}
        />
      ) : (
        <User size={22} color={focused ? colors.gold : '#555'} strokeWidth={focused ? 2 : 1.5} />
      )}
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
        حسابي
      </Text>
      {focused && <View style={styles.dot} />}
    </View>
  );
}

export default function UserLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Home} label="الرئيسية" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="booking"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={CalendarDays} label="حجز" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfumes"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Sparkles} label="عطور" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <ProfileTabIcon focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(11,11,15,0.96)',
    borderTopColor: 'rgba(255,255,255,0.07)',
    borderTopWidth: 1,
    height: 78,
    paddingBottom: 12,
    paddingTop: 8,
    elevation: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: 72,
  },
  tabLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
    textAlign: 'center',
    width: 70,
  },
  tabLabelActive: {
    color: '#D4AF37',
    fontWeight: '700',
  },
  dot: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#D4AF37',
    marginTop: 2,
  },
  profileAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#555',
  },
  profileAvatarFocused: {
    borderColor: colors.gold,
  },
});
