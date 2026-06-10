import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import {
  LayoutDashboard,
  CalendarDays,
  Scissors,
  Sparkles,
  Users,
  Clock,
  UserCircle,
  LayoutGrid,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';

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
        size={19}
        color={focused ? colors.gold : '#555'}
        strokeWidth={focused ? 2 : 1.5}
      />
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
      {focused && <View style={styles.dot} />}
    </View>
  );
}

export default function AdminLayout() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/(auth)/login');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

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
            <TabIcon Icon={LayoutDashboard} label="الرئيسية" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={CalendarDays} label="حجوزات" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Scissors} label="خدمات" focused={focused} />
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
        name="groom-requests"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Users} label="عريس" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={UserCircle} label="زبائن" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Clock} label="الجدول" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={LayoutGrid} label="الصور" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0E0E13',
    borderTopColor: '#1e1e24',
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 8,
    paddingTop: 6,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    width: 50,
  },
  tabLabel: {
    fontSize: 9,
    color: '#444',
    fontWeight: '500',
    textAlign: 'center',
    width: 50,
  },
  tabLabelActive: {
    color: colors.gold,
    fontWeight: '700',
  },
  dot: {
    width: 12,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginTop: 1,
  },
});
