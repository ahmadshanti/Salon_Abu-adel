import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CalendarDays,
  ShoppingBag,
  Users,
  Scissors,
  Clock,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  TrendingUp,
  Megaphone,
  type LucideIcon,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';
import { formatTime, getHebronDayBounds } from '../../lib/utils/time';
import { AdminHeader } from '../../components/AdminHeader';
import { LoadingScreen } from '../../components/LoadingScreen';

interface Stats {
  todayBookings: number;
  pendingOrders: number;
  pendingGroom: number;
  weekRevenue: number;
  monthRevenue: number;
}

interface TodayBooking {
  id: string;
  start_time: string;
  services: { name: string } | null;
  users: { full_name: string } | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    todayBookings: 0,
    pendingOrders: 0,
    pendingGroom: 0,
    weekRevenue: 0,
    monthRevenue: 0,
  });
  const [todayBookings, setTodayBookings] = useState<TodayBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  const load = useCallback(async () => {
    // "Today" is the salon's calendar day (Asia/Hebron), not the device timezone.
    const { start: todayStart, end: todayEnd } = getHebronDayBounds(new Date());

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [bookingsRes, ordersRes, groomRes, todayBookingsRes, revenueRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .gte('start_time', todayStart.toISOString())
        .lt('start_time', todayEnd.toISOString()),
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
        .lt('start_time', todayEnd.toISOString())
        .order('start_time', { ascending: true })
        .limit(10),
      supabase
        .from('perfume_orders')
        .select('quantity, created_at, final_price_ils, perfumes(price_ils)')
        .eq('status', 'approved')
        .gte('created_at', monthStart.toISOString()),
    ]);

    type RevenueRow = { quantity: number; created_at: string; final_price_ils: number | null; perfumes: { price_ils: number } | null };
    const allRevenue = (revenueRes.data ?? []) as unknown as RevenueRow[];
    // Approved orders carry the price confirmed at approval; old rows fall back to the perfume's current price.
    const rowTotal = (o: RevenueRow) => (o.final_price_ils ?? o.perfumes?.price_ils ?? 0) * o.quantity;
    const weekRevenue = allRevenue
      .filter((o) => new Date(o.created_at) >= weekStart)
      .reduce((sum, o) => sum + rowTotal(o), 0);
    const monthRevenue = allRevenue.reduce((sum, o) => sum + rowTotal(o), 0);

    setStats({
      todayBookings: bookingsRes.count ?? 0,
      pendingOrders: ordersRes.count ?? 0,
      pendingGroom: groomRes.count ?? 0,
      weekRevenue,
      monthRevenue,
    });
    setTodayBookings((todayBookingsRes.data ?? []) as unknown as TodayBooking[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        <AdminHeader
          icon={LayoutDashboard}
          title="لوحة التحكم"
          fallbackToDashboard={false}
          right={
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
                    },
                  },
                ]);
              }}
            >
              <LogOut size={18} color={colors.error} strokeWidth={1.5} />
            </TouchableOpacity>
          }
        />

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

        {/* Revenue Section */}
        <View style={styles.revenueSection}>
          <View style={styles.revenueTitleRow}>
            <TrendingUp size={16} color={colors.gold} strokeWidth={1.5} />
            <Text style={styles.revenueSectionTitle}>مبيعات العطور</Text>
          </View>
          <View style={styles.revenueRow}>
            <View style={styles.revenueCard}>
              <Text style={styles.revenueLabel}>هذا الأسبوع</Text>
              <Text style={styles.revenueValue}>{stats.weekRevenue} ₪</Text>
            </View>
            <View style={[styles.revenueCard, styles.revenueCardHighlight]}>
              <Text style={styles.revenueLabel}>هذا الشهر</Text>
              <Text style={[styles.revenueValue, styles.revenueValueHighlight]}>{stats.monthRevenue} ₪</Text>
            </View>
          </View>
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
          <ActionCard
            icon={Megaphone}
            label="إشعار عام"
            onPress={() => router.push('/(admin)/broadcast')}
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
  icon: LucideIcon;
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
  icon: LucideIcon;
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
  scroll: { paddingBottom: 40 },
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
    marginBottom: 16,
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
  revenueSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  revenueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  revenueSectionTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  revenueRow: {
    flexDirection: 'row',
    gap: 10,
  },
  revenueCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-end',
    gap: 6,
  },
  revenueCardHighlight: {
    borderColor: colors.goldLight,
    backgroundColor: colors.heroCard,
  },
  revenueLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  revenueValue: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
  },
  revenueValueHighlight: {
    color: colors.gold,
  },
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
