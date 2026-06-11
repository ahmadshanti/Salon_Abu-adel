import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Users, Clock, Check, X, Calendar, MessageCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';
import { sendPushNotification } from '../../lib/utils/notifications';
import { openWhatsApp } from '../../lib/utils/whatsapp';
import { AdminHeader } from '../../components/AdminHeader';
import { LoadingScreen } from '../../components/LoadingScreen';

interface GroomRequest {
  id: string;
  preferred_time_text: string;
  status: 'pending' | 'confirmed' | 'rejected';
  confirmed_time: string | null;
  notes: string | null;
  created_at: string;
  users: { full_name: string; whatsapp_number: string; expo_push_token: string | null } | null;
}

export default function AdminGroomRequests() {
  const [requests, setRequests] = useState<GroomRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<GroomRequest | null>(null);
  const [confirmedTime, setConfirmedTime] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('groom_requests')
      .select('id, preferred_time_text, status, confirmed_time, notes, created_at, users(full_name, whatsapp_number, expo_push_token)')
      .order('created_at', { ascending: false })
      .limit(50);
    setRequests((data ?? []) as unknown as GroomRequest[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  function onRefresh() { setRefreshing(true); load(); }

  function openConfirm(req: GroomRequest) {
    setConfirmTarget(req);
    setConfirmedTime('');
    setAdminNotes('');
  }

  async function handleConfirm() {
    if (!confirmTarget) return;
    if (!confirmedTime.trim()) {
      Alert.alert('خطأ', 'يرجى تحديد وقت التأكيد');
      return;
    }

    setSaving(true);

    const confirmedDate = new Date(confirmedTime.trim());
    const isValidDate = !isNaN(confirmedDate.getTime());

    const { error } = await supabase
      .from('groom_requests')
      .update({
        status: 'confirmed',
        confirmed_time: isValidDate ? confirmedDate.toISOString() : null,
        notes: adminNotes.trim() || null,
      })
      .eq('id', confirmTarget.id);

    if (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء تأكيد الطلب');
      setSaving(false);
      return;
    }

    const token = confirmTarget.users?.expo_push_token;
    if (token) {
      sendPushNotification(
        token,
        'تم تأكيد طلب العريس',
        `موعدك: ${confirmedTime.trim()}${adminNotes.trim() ? ` — ${adminNotes.trim()}` : ''}`,
      );
    }

    setRequests((prev) =>
      prev.map((r) =>
        r.id === confirmTarget.id
          ? { ...r, status: 'confirmed', confirmed_time: isValidDate ? confirmedDate.toISOString() : null, notes: adminNotes.trim() || null }
          : r,
      ),
    );
    setSaving(false);
    setConfirmTarget(null);
  }

  async function handleReject(req: GroomRequest) {
    Alert.alert('رفض الطلب', 'هل أنت متأكد من رفض هذا الطلب؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'رفض',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('groom_requests')
            .update({ status: 'rejected' })
            .eq('id', req.id);

          if (!error) {
            const token = req.users?.expo_push_token;
            if (token) {
              sendPushNotification(token, 'طلب العريس', 'نأسف، تم رفض طلبك. يرجى التواصل معنا.');
            }
            setRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: 'rejected' } : r));
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingScreen />;

  const pending = requests.filter((r) => r.status === 'pending');
  const others = requests.filter((r) => r.status !== 'pending');

  return (
    <View style={styles.container}>
      <AdminHeader icon={Users} title="طلبات العريس" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {pending.length === 0 && others.length === 0 ? (
          <View style={styles.emptyCard}>
            <Users size={40} color={colors.muted} strokeWidth={1} />
            <Text style={styles.emptyText}>لا توجد طلبات</Text>
          </View>
        ) : (
          <>
            {pending.length > 0 && (
              <>
                <Text style={styles.groupLabel}>طلبات معلقة</Text>
                {pending.map((req) => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    onConfirm={() => openConfirm(req)}
                    onReject={() => handleReject(req)}
                  />
                ))}
              </>
            )}
            {others.length > 0 && (
              <>
                <Text style={[styles.groupLabel, { marginTop: 20 }]}>السابقة</Text>
                {others.map((req) => (
                  <RequestCard key={req.id} request={req} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Confirm Modal */}
      <Modal
        visible={!!confirmTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalClose} onPress={() => setConfirmTarget(null)}>
                <X size={20} color={colors.muted} strokeWidth={1.5} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تأكيد الطلب</Text>
            </View>

            <View style={styles.modalInfo}>
              <Text style={styles.modalInfoLabel}>العميل</Text>
              <Text style={styles.modalInfoValue}>{confirmTarget?.users?.full_name}</Text>
            </View>
            <View style={styles.modalInfo}>
              <Text style={styles.modalInfoLabel}>الوقت المطلوب</Text>
              <Text style={styles.modalInfoValue}>{confirmTarget?.preferred_time_text}</Text>
            </View>

            <Text style={styles.inputLabel}>وقت التأكيد</Text>
            <TextInput
              style={styles.input}
              value={confirmedTime}
              onChangeText={setConfirmedTime}
              placeholder="مثال: الجمعة 14 يونيو الساعة 3 م"
              placeholderTextColor={colors.muted}
              textAlign="right"
            />

            <Text style={styles.inputLabel}>ملاحظات (اختياري)</Text>
            <TextInput
              style={[styles.input, { minHeight: 70 }]}
              value={adminNotes}
              onChangeText={setAdminNotes}
              placeholder="أي تعليمات للعميل..."
              placeholderTextColor={colors.muted}
              textAlign="right"
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.confirmBtnText}>تأكيد وإرسال إشعار</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RequestCard({
  request,
  onConfirm,
  onReject,
}: {
  request: GroomRequest;
  onConfirm?: () => void;
  onReject?: () => void;
}) {
  const isPending = request.status === 'pending';
  const statusColors: Record<string, string> = {
    pending: colors.gold,
    confirmed: colors.success,
    rejected: colors.error,
  };
  const statusLabels: Record<string, string> = {
    pending: 'معلق',
    confirmed: 'مؤكد',
    rejected: 'مرفوض',
  };

  return (
    <View style={[styles.requestCard, !isPending && styles.requestCardDim]}>
      <View style={styles.requestTop}>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[request.status] + '22' }]}>
          <Text style={[styles.statusText, { color: statusColors[request.status] }]}>
            {statusLabels[request.status]}
          </Text>
        </View>
        <Text style={styles.requestName}>{request.users?.full_name ?? '—'}</Text>
      </View>

      <View style={styles.requestRow}>
        <Text style={styles.requestPreferredTime}>{request.preferred_time_text}</Text>
        <View style={styles.requestRowLabel}>
          <Clock size={13} color={colors.muted} strokeWidth={1.5} />
          <Text style={styles.requestLabel}>الوقت المطلوب</Text>
        </View>
      </View>

      {request.users?.whatsapp_number && (
        <TouchableOpacity
          style={styles.whatsappBtn}
          onPress={() => openWhatsApp(
            request.users!.whatsapp_number,
            `مرحباً ${request.users!.full_name}، بخصوص طلب العريس الخاص بك في صالون أبو عادل 💈`,
          )}
        >
          <Text style={styles.whatsappBtnText}>فتح واتساب</Text>
          <MessageCircle size={15} color="#25D366" strokeWidth={1.5} />
        </TouchableOpacity>
      )}

      {request.confirmed_time && (
        <View style={styles.requestRow}>
          <Text style={styles.confirmedTimeText}>{request.confirmed_time}</Text>
          <View style={styles.requestRowLabel}>
            <Calendar size={13} color={colors.success} strokeWidth={1.5} />
            <Text style={[styles.requestLabel, { color: colors.success }]}>وقت التأكيد</Text>
          </View>
        </View>
      )}

      {request.notes && (
        <Text style={styles.requestNotes}>{request.notes}</Text>
      )}

      {isPending && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
            <X size={14} color={colors.error} strokeWidth={2} />
            <Text style={styles.rejectBtnText}>رفض</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.approveBtn} onPress={onConfirm}>
            <Check size={14} color={colors.background} strokeWidth={2.5} />
            <Text style={styles.approveBtnText}>تأكيد</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  emptyCard: {
    backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 40, alignItems: 'center', gap: 12, marginTop: 20,
  },
  emptyText: { color: colors.muted, fontSize: 15 },
  groupLabel: {
    color: colors.gold, fontSize: 12, fontWeight: '700',
    textAlign: 'right', marginBottom: 8, paddingRight: 4,
  },
  requestCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.goldLight,
    borderRadius: 16, padding: 14, marginBottom: 10, gap: 10,
  },
  requestCardDim: { borderColor: colors.border, opacity: 0.7 },
  requestTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { borderRadius: 10, paddingVertical: 4, paddingHorizontal: 10 },
  statusText: { fontSize: 11, fontWeight: '700' },
  requestName: { color: colors.white, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  requestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestRowLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  requestLabel: { color: colors.muted, fontSize: 12 },
  requestPreferredTime: { color: colors.white, fontSize: 13, flex: 1, textAlign: 'left' },
  confirmedTimeText: { color: colors.success, fontSize: 13, flex: 1, textAlign: 'left' },
  requestNotes: {
    color: colors.text.secondary, fontSize: 12, textAlign: 'right',
    backgroundColor: colors.background, borderRadius: 10, padding: 10,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  approveBtn: {
    flex: 1, backgroundColor: colors.gold, borderRadius: 10,
    paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  approveBtnText: { color: colors.background, fontSize: 13, fontWeight: '700' },
  rejectBtn: {
    flex: 1, backgroundColor: '#E0525211', borderRadius: 10, borderWidth: 1, borderColor: '#E0525233',
    paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  rejectBtnText: { color: colors.error, fontSize: 13, fontWeight: '700' },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 6, backgroundColor: '#25D36615', borderWidth: 1,
    borderColor: '#25D36633', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
  },
  whatsappBtnText: { color: '#25D366', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12, borderTopWidth: 1, borderColor: colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  modalInfo: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 10, padding: 12,
  },
  modalInfoLabel: { color: colors.muted, fontSize: 12 },
  modalInfoValue: { color: colors.white, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 8 },
  inputLabel: { color: colors.muted, fontSize: 12, textAlign: 'right' },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, color: colors.white, fontSize: 14,
  },
  confirmBtn: {
    backgroundColor: colors.gold, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
});
