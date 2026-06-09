import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { CalendarDays, Clock, User, MessageCircle, X } from 'lucide-react-native';
import { Linking } from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';
import { formatDate, formatTime } from '../../lib/utils/time';

function openWhatsApp(phone: string, message = '') {
  const cleaned = phone.replace(/[^0-9]/g, '');
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  Linking.openURL(url);
}

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled';
  notes: string | null;
  services: { name: string; price_ils: number } | null;
  users: { full_name: string; whatsapp_number: string } | null;
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  const load = useCallback(async () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('bookings')
      .select('id, start_time, end_time, status, notes, services(name, price_ils), users(full_name, whatsapp_number)')
      .gte('start_time', now.toISOString())
      .order('start_time', { ascending: true })
      .limit(50);

    setBookings((data ?? []) as Booking[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  function onRefresh() { setRefreshing(true); load(); }

  async function cancelBooking(id: string) {
    Alert.alert('إلغاء الحجز', 'هل أنت متأكد من إلغاء هذا الحجز؟', [
      { text: 'رجوع', style: 'cancel' },
      {
        text: 'إلغاء الحجز',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', id);
          if (!error) {
            setBookings((prev) =>
              prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)),
            );
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const grouped = groupByDate(bookings);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <CalendarDays size={20} color={colors.gold} strokeWidth={1.5} />
        </View>
        <Text style={styles.headerTitle}>الحجوزات</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {Object.keys(grouped).length === 0 ? (
          <View style={styles.emptyCard}>
            <CalendarDays size={40} color={colors.muted} strokeWidth={1} />
            <Text style={styles.emptyTitle}>لا توجد حجوزات قادمة</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([dateKey, dayBookings]) => (
            <View key={dateKey} style={styles.dayGroup}>
              <Text style={styles.dayLabel}>{dateKey}</Text>
              {dayBookings.map((booking) => (
                <BookingItem
                  key={booking.id}
                  booking={booking}
                  onCancel={() => cancelBooking(booking.id)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function BookingItem({
  booking,
  onCancel,
}: {
  booking: Booking;
  onCancel: () => void;
}) {
  const isCancelled = booking.status === 'cancelled';
  return (
    <View style={[styles.bookingCard, isCancelled && styles.bookingCancelled]}>
      <View style={styles.bookingTop}>
        <View style={styles.bookingTopLeft}>
          {!isCancelled && (
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <X size={14} color={colors.error} strokeWidth={2} />
            </TouchableOpacity>
          )}
          {isCancelled && (
            <View style={styles.cancelledBadge}>
              <Text style={styles.cancelledText}>ملغي</Text>
            </View>
          )}
        </View>
        <View style={styles.bookingTopRight}>
          <View style={styles.timeWrap}>
            <Clock size={12} color={colors.gold} strokeWidth={1.5} />
            <Text style={styles.timeText}>{formatTime(new Date(booking.start_time))}</Text>
          </View>
          <Text style={styles.serviceName}>{booking.services?.name ?? '—'}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.customerRow}>
        <Text style={styles.customerName}>{booking.users?.full_name ?? '—'}</Text>
        <View style={styles.customerRight}>
          <User size={13} color={colors.muted} strokeWidth={1.5} />
          <Text style={styles.customerLabel}>العميل</Text>
        </View>
      </View>

      {booking.users?.whatsapp_number && (
        <TouchableOpacity
          style={styles.whatsappBtn}
          onPress={() => openWhatsApp(
            booking.users!.whatsapp_number,
            `مرحباً ${booking.users!.full_name}، بخصوص حجزك في صالون أبو عادل 💈`,
          )}
        >
          <Text style={styles.whatsappBtnText}>فتح واتساب</Text>
          <MessageCircle size={15} color="#25D366" strokeWidth={1.5} />
        </TouchableOpacity>
      )}

      {booking.notes && (
        <View style={styles.notesRow}>
          <Text style={styles.notesText}>{booking.notes}</Text>
          <Text style={styles.notesLabel}>ملاحظات</Text>
        </View>
      )}

      <View style={styles.priceRow}>
        <Text style={styles.priceValue}>{booking.services?.price_ils ?? 0} ₪</Text>
      </View>
    </View>
  );
}

function groupByDate(bookings: Booking[]): Record<string, Booking[]> {
  const groups: Record<string, Booking[]> = {};
  bookings.forEach((b) => {
    const date = new Date(b.start_time);
    const key = formatDate(date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(b);
  });
  return groups;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  scroll: { padding: 16, paddingBottom: 40 },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 40,
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  emptyTitle: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  dayGroup: { marginBottom: 20 },
  dayLabel: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
    paddingRight: 4,
  },
  bookingCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.goldLight,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  bookingCancelled: {
    borderColor: colors.border,
    opacity: 0.6,
  },
  bookingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bookingTopRight: { alignItems: 'flex-end', gap: 4 },
  bookingTopLeft: { alignItems: 'flex-start' },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  serviceName: { color: colors.white, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  cancelBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0525211',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0525233',
  },
  cancelledBadge: {
    backgroundColor: '#E0525211',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  cancelledText: { color: colors.error, fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  customerLabel: { color: colors.muted, fontSize: 12 },
  customerName: { color: colors.white, fontSize: 14, fontWeight: '600' },
  whatsappNum: { color: colors.text.secondary, fontSize: 13 },
  notesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
  },
  notesLabel: { color: colors.muted, fontSize: 12, marginLeft: 8 },
  notesText: { color: colors.text.secondary, fontSize: 12, flex: 1, textAlign: 'right' },
  priceRow: { alignItems: 'flex-start' },
  priceValue: { color: colors.gold, fontSize: 15, fontWeight: '700' },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    backgroundColor: '#25D36615',
    borderWidth: 1,
    borderColor: '#25D36633',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  whatsappBtnText: { color: '#25D366', fontSize: 13, fontWeight: '700' },
});
