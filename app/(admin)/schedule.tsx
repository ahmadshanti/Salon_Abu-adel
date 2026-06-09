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
  Switch,
  RefreshControl,
} from 'react-native';
import { Clock, Plus, X, Ban } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';

interface WorkingHours {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

interface BlockedSlot {
  id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

type Tab = 'hours' | 'blocked';

export default function AdminSchedule() {
  const [tab, setTab] = useState<Tab>('hours');
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const [addBlockedVisible, setAddBlockedVisible] = useState(false);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [addingBlock, setAddingBlock] = useState(false);

  useEffect(() => { load(); }, []);

  const load = useCallback(async () => {
    const [whRes, bsRes] = await Promise.all([
      supabase.from('working_hours').select('*').order('day_of_week'),
      supabase
        .from('blocked_slots')
        .select('*')
        .gte('end_time', new Date().toISOString())
        .order('start_time'),
    ]);
    setWorkingHours(whRes.data ?? []);
    setBlockedSlots(bsRes.data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  function onRefresh() { setRefreshing(true); load(); }

  async function toggleDayClosed(wh: WorkingHours) {
    setSaving(wh.id);
    await supabase.from('working_hours').update({ is_closed: !wh.is_closed }).eq('id', wh.id);
    setWorkingHours((prev) => prev.map((w) => w.id === wh.id ? { ...w, is_closed: !w.is_closed } : w));
    setSaving(null);
  }

  async function updateTime(wh: WorkingHours, field: 'open_time' | 'close_time', value: string) {
    const trimmed = value.trim();
    if (!/^\d{2}:\d{2}$/.test(trimmed)) return;
    setSaving(wh.id + field);
    await supabase.from('working_hours').update({ [field]: trimmed }).eq('id', wh.id);
    setWorkingHours((prev) => prev.map((w) => w.id === wh.id ? { ...w, [field]: trimmed } : w));
    setSaving(null);
  }

  async function addBlockedSlot() {
    if (!blockStart.trim() || !blockEnd.trim()) {
      Alert.alert('خطأ', 'يرجى تحديد وقت البداية والنهاية');
      return;
    }

    const startDate = new Date(blockStart.trim());
    const endDate = new Date(blockEnd.trim());

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      Alert.alert('خطأ', 'صيغة التاريخ غير صحيحة. استخدم مثلاً: 2024-06-14T10:00');
      return;
    }

    if (endDate <= startDate) {
      Alert.alert('خطأ', 'وقت النهاية يجب أن يكون بعد وقت البداية');
      return;
    }

    setAddingBlock(true);
    const { data, error } = await supabase
      .from('blocked_slots')
      .insert({
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        reason: blockReason.trim() || null,
      })
      .select()
      .single();

    setAddingBlock(false);

    if (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء إضافة الفترة المحجوبة');
      return;
    }

    setBlockedSlots((prev) => [...prev, data as BlockedSlot]);
    setAddBlockedVisible(false);
    setBlockStart(''); setBlockEnd(''); setBlockReason('');
  }

  async function deleteBlockedSlot(id: string) {
    Alert.alert('حذف الفترة', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('blocked_slots').delete().eq('id', id);
          setBlockedSlots((prev) => prev.filter((b) => b.id !== id));
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.gold} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconWrap}>
            <Clock size={20} color={colors.gold} strokeWidth={1.5} />
          </View>
          <Text style={styles.headerTitle}>الجدول</Text>
        </View>
        {tab === 'blocked' && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddBlockedVisible(true)}>
            <Plus size={18} color={colors.background} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'blocked' && styles.tabBtnActive]} onPress={() => setTab('blocked')}>
          <Text style={[styles.tabBtnText, tab === 'blocked' && styles.tabBtnTextActive]}>فترات محجوبة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'hours' && styles.tabBtnActive]} onPress={() => setTab('hours')}>
          <Text style={[styles.tabBtnText, tab === 'hours' && styles.tabBtnTextActive]}>أوقات العمل</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {tab === 'hours' ? (
          workingHours.map((wh) => (
            <WorkingHoursRow
              key={wh.id}
              wh={wh}
              saving={saving === wh.id}
              onToggle={() => toggleDayClosed(wh)}
              onUpdateTime={(field, val) => updateTime(wh, field, val)}
            />
          ))
        ) : (
          blockedSlots.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ban size={40} color={colors.muted} strokeWidth={1} />
              <Text style={styles.emptyText}>لا توجد فترات محجوبة</Text>
            </View>
          ) : (
            blockedSlots.map((bs) => (
              <View key={bs.id} style={styles.blockedCard}>
                <TouchableOpacity style={styles.deleteBlockBtn} onPress={() => deleteBlockedSlot(bs.id)}>
                  <X size={14} color={colors.error} strokeWidth={2} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
                  {bs.reason && <Text style={styles.blockReason}>{bs.reason}</Text>}
                  <Text style={styles.blockTime}>
                    {new Date(bs.start_time).toLocaleString('ar-PS', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Hebron',
                    })}
                  </Text>
                  <Text style={styles.blockTimeSep}>حتى</Text>
                  <Text style={styles.blockTime}>
                    {new Date(bs.end_time).toLocaleString('ar-PS', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Hebron',
                    })}
                  </Text>
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>

      {/* Add Blocked Slot Modal */}
      <Modal visible={addBlockedVisible} transparent animationType="slide" onRequestClose={() => setAddBlockedVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalClose} onPress={() => setAddBlockedVisible(false)}>
                <X size={20} color={colors.muted} strokeWidth={1.5} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>إضافة فترة محجوبة</Text>
            </View>

            <Text style={styles.inputLabel}>وقت البداية</Text>
            <TextInput
              style={styles.input}
              value={blockStart}
              onChangeText={setBlockStart}
              placeholder="2024-06-14T10:00"
              placeholderTextColor={colors.muted}
              textAlign="right"
            />

            <Text style={styles.inputLabel}>وقت النهاية</Text>
            <TextInput
              style={styles.input}
              value={blockEnd}
              onChangeText={setBlockEnd}
              placeholder="2024-06-14T12:00"
              placeholderTextColor={colors.muted}
              textAlign="right"
            />

            <Text style={styles.inputLabel}>السبب (اختياري)</Text>
            <TextInput
              style={styles.input}
              value={blockReason}
              onChangeText={setBlockReason}
              placeholder="إجازة، صيانة..."
              placeholderTextColor={colors.muted}
              textAlign="right"
            />

            <TouchableOpacity
              style={[styles.saveBtn, addingBlock && styles.saveBtnDisabled]}
              onPress={addBlockedSlot}
              disabled={addingBlock}
            >
              {addingBlock ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.saveBtnText}>إضافة</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function WorkingHoursRow({
  wh,
  saving,
  onToggle,
  onUpdateTime,
}: {
  wh: WorkingHours;
  saving: boolean;
  onToggle: () => void;
  onUpdateTime: (field: 'open_time' | 'close_time', val: string) => void;
}) {
  const [openTime, setOpenTime] = useState(wh.open_time.slice(0, 5));
  const [closeTime, setCloseTime] = useState(wh.close_time.slice(0, 5));

  return (
    <View style={[styles.dayCard, wh.is_closed && styles.dayCardClosed]}>
      <View style={styles.dayTop}>
        {saving ? (
          <ActivityIndicator size="small" color={colors.gold} />
        ) : (
          <Switch
            value={!wh.is_closed}
            onValueChange={onToggle}
            trackColor={{ false: colors.border, true: colors.goldTransparent }}
            thumbColor={!wh.is_closed ? colors.gold : colors.muted}
          />
        )}
        <Text style={[styles.dayName, wh.is_closed && styles.dayNameClosed]}>
          {DAY_NAMES[wh.day_of_week]}
        </Text>
      </View>

      {!wh.is_closed && (
        <View style={styles.timesRow}>
          <View style={styles.timeField}>
            <Text style={styles.timeFieldLabel}>يغلق</Text>
            <TextInput
              style={styles.timeInput}
              value={closeTime}
              onChangeText={setCloseTime}
              onBlur={() => onUpdateTime('close_time', closeTime)}
              placeholder="18:00"
              placeholderTextColor={colors.muted}
              textAlign="center"
              maxLength={5}
            />
          </View>
          <View style={styles.timeDivider} />
          <View style={styles.timeField}>
            <Text style={styles.timeFieldLabel}>يفتح</Text>
            <TextInput
              style={styles.timeInput}
              value={openTime}
              onChangeText={setOpenTime}
              onBlur={() => onUpdateTime('open_time', openTime)}
              placeholder="09:00"
              placeholderTextColor={colors.muted}
              textAlign="center"
              maxLength={5}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.goldFaint, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: colors.white, fontSize: 22, fontWeight: '700' },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center',
  },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 12,
    backgroundColor: colors.card, borderRadius: 12, padding: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  tabBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.gold },
  tabBtnText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  tabBtnTextActive: { color: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  dayCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 16, marginBottom: 10, gap: 12,
  },
  dayCardClosed: { opacity: 0.5 },
  dayTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayName: { color: colors.white, fontSize: 15, fontWeight: '700' },
  dayNameClosed: { color: colors.muted },
  timesRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  timeField: { flex: 1, alignItems: 'center', gap: 4 },
  timeFieldLabel: { color: colors.muted, fontSize: 11 },
  timeInput: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 10, color: colors.white, fontSize: 16,
    fontWeight: '700', width: '80%',
  },
  timeDivider: { width: 1, height: 40, backgroundColor: colors.border, marginHorizontal: 8 },
  emptyCard: {
    backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 40, alignItems: 'center', gap: 12, marginTop: 20,
  },
  emptyText: { color: colors.muted, fontSize: 15 },
  blockedCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: '#E0525233',
    borderRadius: 16, padding: 14, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  deleteBlockBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E0525211', justifyContent: 'center', alignItems: 'center',
  },
  blockReason: { color: colors.white, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  blockTime: { color: colors.muted, fontSize: 12, textAlign: 'right' },
  blockTimeSep: { color: colors.border, fontSize: 11, textAlign: 'right' },
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
  inputLabel: { color: colors.muted, fontSize: 12, textAlign: 'right' },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, color: colors.white, fontSize: 14,
  },
  saveBtn: {
    backgroundColor: colors.gold, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
});
