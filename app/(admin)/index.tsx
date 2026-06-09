import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CalendarDays,
  ShoppingBag,
  Users,
  Scissors,
  Clock,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';
import { formatTime } from '../../lib/utils/time';

interface Stats {
  todayBookings: number;
  pendingOrders: number;
  pendingGroom: number;
}

interface TodayBooking {
  id: string;
  start_time: string;
  services: { name: string } | null;
  users: { full_name: string } | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ todayBookings: 0, pendingOrders: 0, pendingGroom: 0 });
  const [todayBookings, setTodayBookings] = useState<TodayBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  const load = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [bookingsRes, ordersRes, groomRes, todayBookingsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString()),
      supabase
        .from('perfume_orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('groom_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('bookings')
        .select('id, start_time, services(name), users(full_name)')
        .eq('status', 'confirmed')
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .order('start_time', { ascending: true })
        .limit(10),
    ]);

    setStats({
      todayBookings: bookingsRes.count ?? 0,
      pendingOrders: ordersRes.count ?? 0,
      pendingGroom: groomRes.count ?? 0,
    });
    setTodayBookings((todayBookingsRes.data ?? []) as TodayBooking[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => {
              Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [
                { text: 'إلغاء', style: 'cancel' },
                {
                  text: 'خروج',
                  style: 'destructive',
                  onPress: async () => {
                    await supabase.auth.signOut();
                    window.location.replace('/');
                  },
                },
              ]);
            }}
          >
            <LogOut size={18} color={colors.error} strokeWidth={1.5} />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconWrap}>
              <LayoutDashboard size={20} color={colors.gold} strokeWidth={1.5} />
            </View>
            <Text style={styles.headerTitle}>لوحة التحكم</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            icon={CalendarDays}
            value={stats.todayBookings}
            label="حجوزات اليوم"
            onPress={() => router.push('/(admin)/bookings')}
          />
          <StatCard
            icon={ShoppingBag}
            value={stats.pendingOrders}
            label="طلبات معلقة"
            onPress={() => router.push('/(admin)/perfumes')}
            highlight={stats.pendingOrders > 0}
          />
          <StatCard
            icon={Users}
            value={stats.pendingGroom}
            label="طلبات العريس"
            onPress={() => router.push('/(admin)/groom-requests')}
            highlight={stats.pendingGroom > 0}
          />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
        <View style={styles.actionsGrid}>
          <ActionCard
            icon={CalendarDays}
            label="الحجوزات"
            onPress={() => router.push('/(admin)/bookings')}
          />
          <ActionCard
            icon={Scissors}
            label="الخدمات"
            onPress={() => router.push('/(admin)/services')}
          />
          <ActionCard
            icon={ShoppingBag}
            label="العطور"
            onPress={() => router.push('/(admin)/perfumes')}
          />
          <ActionCard
            icon={Users}
            label="طلبات العريس"
            onPress={() => router.push('/(admin)/groom-requests')}
          />
          <ActionCard
            icon={Clock}
            label="الجدول"
            onPress={() => router.push('/(admin)/schedule')}
          />
        </View>

        {/* Today's Bookings */}
        <Text style={styles.sectionTitle}>مواعيد اليوم</Text>
        {todayBookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <CalendarDays size={28} color={colors.muted} strokeWidth={1} />
            <Text style={styles.emptyText}>لا توجد مواعيد اليوم</Text>
          </View>
        ) : (
          todayBookings.map((b) => (
            <View key={b.id} style={styles.bookingRow}>
              <View style={styles.bookingTimeWrap}>
                <Text style={styles.bookingTime}>{formatTime(new Date(b.start_time))}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bookingCustomer}>{b.users?.full_name ?? '—'}</Text>
                <Text style={styles.bookingService}>{b.services?.name ?? '—'}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  onPress,
  highlight = false,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  value: number;
  label: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.statCard, highlight && styles.statCardHighlight]}
      onPress={onPress}
    >
      <View style={[styles.statIconWrap, highlight && styles.statIconWrapHighlight]}>
        <Icon size={18} color={colors.gold} strokeWidth={1.5} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActionCard({
  icon: Icon,
  label,
  onPress,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={styles.actionIconWrap}>
        <Icon size={20} color={colors.gold} strokeWidth={1.5} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <ChevronLeft size={14} color={colors.muted} strokeWidth={1.5} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.goldFaint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { color: colors.white, fontSize: 22, fontWeight: '700' },
  signOutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0525211',
    borderWidth: 1,
    borderColor: '#E0525233',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statCardHighlight: {
    borderColor: colors.goldLight,
    backgroundColor: colors.heroCard,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.goldFaint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIconWrapHighlight: {
    backgroundColor: colors.goldTransparent,
  },
  statValue: { color: colors.white, fontSize: 22, fontWeight: '700' },
  statLabel: { color: colors.muted, fontSize: 10, textAlign: 'center' },
  sectionTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  actionsGrid: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  actionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.goldFaint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: { flex: 1, color: colors.white, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
  },
  emptyText: { color: colors.muted, fontSize: 13 },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  bookingTimeWrap: {
    backgroundColor: colors.goldFaint,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.goldLight,
  },
  bookingTime: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  bookingCustomer: { color: colors.white, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  bookingService: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 2 },
});
