import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Linking,
} from 'react-native';
import { UserCircle, MessageCircle, Search, CalendarDays, ShoppingBag } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';

interface Customer {
  id: string;
  full_name: string;
  whatsapp_number: string;
  created_at: string;
  booking_count?: number;
  order_count?: number;
}

function openWhatsApp(phone: string, message = '') {
  const cleaned = phone.replace(/[^0-9]/g, '');
  Linking.openURL(`https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`);
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(customers);
    } else {
      const q = search.trim().toLowerCase();
      setFiltered(customers.filter(
        (c) =>
          c.full_name?.toLowerCase().includes(q) ||
          c.whatsapp_number?.includes(q),
      ));
    }
  }, [search, customers]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, whatsapp_number, created_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); setRefreshing(false); return; }

    // Fetch booking and order counts per user
    const ids = data.map((u) => u.id);

    const [bookingsRes, ordersRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('user_id')
        .in('user_id', ids)
        .eq('status', 'confirmed'),
      supabase
        .from('perfume_orders')
        .select('user_id')
        .in('user_id', ids)
        .eq('status', 'approved'),
    ]);

    const bookingCounts: Record<string, number> = {};
    const orderCounts: Record<string, number> = {};

    (bookingsRes.data ?? []).forEach((b) => {
      bookingCounts[b.user_id] = (bookingCounts[b.user_id] ?? 0) + 1;
    });
    (ordersRes.data ?? []).forEach((o) => {
      orderCounts[o.user_id] = (orderCounts[o.user_id] ?? 0) + 1;
    });

    const enriched: Customer[] = data.map((u) => ({
      ...u,
      booking_count: bookingCounts[u.id] ?? 0,
      order_count: orderCounts[u.id] ?? 0,
    }));

    setCustomers(enriched);
    setFiltered(enriched);
    setLoading(false);
    setRefreshing(false);
  }, []);

  function onRefresh() { setRefreshing(true); load(); }

  function formatJoinDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.gold} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <UserCircle size={20} color={colors.gold} strokeWidth={1.5} />
        </View>
        <Text style={styles.headerTitle}>الزبائن</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="ابحث بالاسم أو رقم الواتساب..."
          placeholderTextColor={colors.muted}
          textAlign="right"
        />
        <Search size={16} color={colors.muted} strokeWidth={1.5} />
      </View>

      <Text style={styles.countLabel}>
        {filtered.length} زبون{filtered.length !== customers.length ? ` من ${customers.length}` : ''}
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <UserCircle size={40} color={colors.muted} strokeWidth={1} />
            <Text style={styles.emptyText}>لا يوجد زبائن</Text>
          </View>
        ) : (
          filtered.map((customer) => (
            <View key={customer.id} style={styles.customerCard}>
              {/* Avatar */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {customer.full_name?.charAt(0) ?? '؟'}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{customer.full_name ?? '—'}</Text>
                <Text style={styles.customerPhone}>{customer.whatsapp_number ?? '—'}</Text>
                <Text style={styles.joinDate}>انضم: {formatJoinDate(customer.created_at)}</Text>

                {/* Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statChip}>
                    <ShoppingBag size={11} color={colors.muted} strokeWidth={1.5} />
                    <Text style={styles.statChipText}>{customer.order_count} طلب عطر</Text>
                  </View>
                  <View style={styles.statChip}>
                    <CalendarDays size={11} color={colors.muted} strokeWidth={1.5} />
                    <Text style={styles.statChipText}>{customer.booking_count} حجز</Text>
                  </View>
                </View>
              </View>

              {/* WhatsApp Button */}
              {customer.whatsapp_number && (
                <TouchableOpacity
                  style={styles.waBtn}
                  onPress={() => openWhatsApp(
                    customer.whatsapp_number,
                    `مرحباً ${customer.full_name}، من صالون أبو عادل 💈`,
                  )}
                >
                  <MessageCircle size={18} color="#25D366" strokeWidth={1.5} />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.goldFaint, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: colors.white, fontSize: 22, fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1, paddingVertical: 12, color: colors.white, fontSize: 14,
  },
  countLabel: {
    color: colors.muted, fontSize: 12, textAlign: 'right',
    marginHorizontal: 20, marginTop: 8, marginBottom: 4,
  },
  scroll: { padding: 16, paddingBottom: 40 },
  emptyCard: {
    backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 40, alignItems: 'center', gap: 12, marginTop: 20,
  },
  emptyText: { color: colors.muted, fontSize: 15 },
  customerCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.goldFaint, borderWidth: 1, borderColor: colors.goldLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: colors.gold, fontSize: 18, fontWeight: '700' },
  customerName: { color: colors.white, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  customerPhone: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 2 },
  joinDate: { color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 6, marginTop: 6, justifyContent: 'flex-end' },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.background, borderRadius: 8,
    paddingVertical: 3, paddingHorizontal: 7,
  },
  statChipText: { color: colors.muted, fontSize: 10 },
  waBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#25D36615', borderWidth: 1, borderColor: '#25D36633',
    justifyContent: 'center', alignItems: 'center',
  },
});
