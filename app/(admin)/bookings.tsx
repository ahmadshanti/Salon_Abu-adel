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
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CalendarDays, Clock, User, MessageCircle, X, Edit2, Search, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';
import { formatDate, formatTime } from '../../lib/utils/time';
import { sendPushNotification } from '../../lib/utils/notifications';

function openWhatsApp(phone: string, message = '') {
  const cleaned = phone.replace(/[^0-9]/g, '');
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  Linking.openURL(url);
}

interface Booking {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled';
  notes: string | null;
  services: { name: string; price_ils: number; duration_minutes: number } | null;
  users: { full_name: string; whatsapp_number: string } | null;
}

type StatusFilter = 'all' | 'confirmed' | 'cancelled';

export default function AdminBookings() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [editTarget, setEditTarget] = useState<Booking | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editTimeInput, setEditTimeInput] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = useCallback(async () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('bookings')
      .select('id, start_time, end_time, status, notes, user_id, services(name, price_ils, duration_minutes), users(full_name, whatsapp_number)')
      .gte('start_time', now.toISOString())
      .order('start_time', { ascending: true })
      .limit(50);

    setBookings((data ?? []) as Booking[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  function onRefresh() { setRefreshing(true); load(); }

  async function cancelBooking(booking: Booking) {
    Alert.alert('إلغاء الحجز', 'هل أنت متأكد من إلغاء هذا الحجز؟', [
      { text: 'رجوع', style: 'cancel' },
      {
        text: 'إلغاء الحجز',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', booking.id);
          if (!error) {
            setBookings((prev) =>
              prev.map((b) => (b.id === booking.id ? { ...b, status: 'cancelled' } : b)),
            );
            if (booking.user_id) {
              const { data: userData } = await supabase
                .from('users')
                .select('expo_push_token')
                .eq('id', booking.user_id)
                .single();
              if (userData?.expo_push_token) {
                sendPushNotification(
                  userData.expo_push_token,
                  'تم إلغاء حجزك',
                  `تم إلغاء حجزك بتاريخ ${formatDate(new Date(booking.start_time))}`,
                );
              }
            }
          }
        },
      },
    ]);
  }

  function openEdit(booking: Booking) {
    const d = new Date(booking.start_time);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    setEditTarget(booking);
    setEditTimeInput(`${hh}:${mm}`);
    setEditNotes(booking.notes ?? '');
  }

  async function handleEdit() {
    if (!editTarget) return;
    const parts = editTimeInput.split(':');
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1] ?? '0', 10);
    if (isNaN(hours) || isNaN(mins) || hours < 0 || hours > 23 || mins < 0 || mins > 59) {
      Alert.alert('خطأ', 'صيغة الوقت غير صحيحة (مثال: 14:30)');
      return;
    }
    setEditSaving(true);
    const newStart = new Date(editTarget.start_time);
    newStart.setHours(hours, mins, 0, 0);
    const duration = editTarget.services?.duration_minutes ?? 60;
    const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);

    const { error } = await supabase
      .from('bookings')
      .update({
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        notes: editNotes.trim() || null,
      })
      .eq('id', editTarget.id);

    setEditSaving(false);
    if (!error) {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === editTarget.id
            ? { ...b, start_time: newStart.toISOString(), end_time: newEnd.toISOString(), notes: editNotes.trim() || null }
            : b,
        ),
      );
      setEditTarget(null);
    }
  }

  const filtered = bookings.filter((b) => {
    const matchName = !searchText || (b.users?.full_name ?? '').toLowerCase().includes(searchText.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchName && matchStatus;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const grouped = groupByDate(filtered);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.gold} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconWrap}>
            <CalendarDays size={20} color={colors.gold} strokeWidth={1.5} />
          </View>
          <Text style={styles.headerTitle}>الحجوزات</Text>
        </View>
      </View>

      {/* Search + Filter */}
      <View style={styles.filterContainer}>
        <View style={styles.searchRow}>
          <Search size={16} color={colors.muted} strokeWidth={1.5} />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث بالاسم..."
            placeholderTextColor={colors.muted}
            value={searchText}
            onChangeText={setSearchText}
            textAlign="right"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <X size={16} color={colors.muted} strokeWidth={1.5} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.filterRow}>
          {(['all', 'confirmed', 'cancelled'] as StatusFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, statusFilter === f && styles.filterTabActive]}
              onPress={() => setStatusFilter(f)}
            >
              <Text style={[styles.filterTabText, statusFilter === f && styles.filterTabTextActive]}>
                {f === 'all' ? 'الكل' : f === 'confirmed' ? 'مؤكد' : 'ملغي'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
        keyboardShouldPersistTaps="handled"
      >
        {Object.keys(grouped).length === 0 ? (
          <View style={styles.emptyCard}>
            <CalendarDays size={40} color={colors.muted} strokeWidth={1} />
            <Text style={styles.emptyTitle}>لا توجد حجوزات</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([dateKey, dayBookings]) => (
            <View key={dateKey} style={styles.dayGroup}>
              <Text style={styles.dayLabel}>{dateKey}</Text>
              {dayBookings.map((booking) => (
                <BookingItem
                  key={booking.id}
                  booking={booking}
                  onCancel={() => cancelBooking(booking)}
                  onEdit={() => openEdit(booking)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={!!editTarget} transparent animationType="slide" onRequestClose={() => setEditTarget(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalSheet}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <TouchableOpacity style={styles.modalClose} onPress={() => setEditTarget(null)}>
                  <X size={20} color={colors.muted} strokeWidth={1.5} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>تعديل الحجز</Text>
              </View>

              {editTarget && (
                <View style={styles.editInfo}>
                  <Text style={styles.editInfoService}>{editTarget.services?.name ?? '—'}</Text>
                  <Text style={styles.editInfoDate}>{formatDate(new Date(editTarget.start_time))}</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>الوقت الجديد (HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={editTimeInput}
                onChangeText={setEditTimeInput}
                placeholder="مثال: 14:30"
                placeholderTextColor={colors.muted}
                textAlign="right"
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.inputLabel}>ملاحظات</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="ملاحظات (اختياري)..."
                placeholderTextColor={colors.muted}
                textAlign="right"
                multiline
              />

              <TouchableOpacity
                style={[styles.saveBtn, editSaving && styles.saveBtnDisabled]}
                onPress={handleEdit}
                disabled={editSaving}
              >
                {editSaving ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.saveBtnText}>حفظ التعديلات</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function BookingItem({
  booking,
  onCancel,
  onEdit,
}: {
  booking: Booking;
  onCancel: () => void;
  onEdit: () => void;
}) {
  const isCancelled = booking.status === 'cancelled';
  return (
    <View style={[styles.bookingCard, isCancelled && styles.bookingCancelled]}>
      <View style={styles.bookingTop}>
        <View style={styles.bookingTopLeft}>
          {!isCancelled ? (
            <View style={styles.actionBtns}>
              <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
                <Edit2 size={13} color={colors.gold} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <X size={13} color={colors.error} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          ) : (
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.goldFaint, borderWidth: 1, borderColor: colors.goldLight,
    justifyContent: 'center', alignItems: 'center',
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
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    paddingVertical: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  filterTab: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  filterTabActive: {
    backgroundColor: colors.goldTransparent,
    borderColor: colors.goldLight,
  },
  filterTabText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  filterTabTextActive: { color: colors.gold },
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
  actionBtns: { flexDirection: 'row', gap: 6 },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  serviceName: { color: colors.white, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.goldFaint,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.goldLight,
  },
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
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalScroll: {
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: colors.border,
  },
  modalSheet: { padding: 24, gap: 12, paddingBottom: 40 },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  editInfo: {
    backgroundColor: colors.background, borderRadius: 12, padding: 12,
    marginBottom: 4, alignItems: 'flex-end',
  },
  editInfoService: { color: colors.white, fontSize: 14, fontWeight: '700' },
  editInfoDate: { color: colors.muted, fontSize: 12, marginTop: 2 },
  inputLabel: { color: colors.muted, fontSize: 12, textAlign: 'right' },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, color: colors.white, fontSize: 14,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: colors.gold, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
});
