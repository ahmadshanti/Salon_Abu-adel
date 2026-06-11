import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Megaphone, Send } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';
import { formatDateTime } from '../../lib/utils/time';
import { broadcastToAllUsers } from '../../lib/utils/notifications';
import { AdminHeader } from '../../components/AdminHeader';

interface Broadcast {
  id: string;
  title: string;
  body: string;
  recipient_count: number;
  created_at: string;
}

export default function AdminBroadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('broadcasts')
      .select('id, title, body, recipient_count, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory((data ?? []) as Broadcast[]);
    setRefreshing(false);
  }, []);

  function onRefresh() {
    setRefreshing(true);
    loadHistory();
  }

  function confirmSend() {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      Alert.alert('خطأ', 'يرجى إدخال العنوان ونص الرسالة');
      return;
    }
    Alert.alert('إرسال إشعار', 'سيتم إرسال هذا الإشعار لجميع المستخدمين. هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إرسال', onPress: () => send(trimmedTitle, trimmedBody) },
    ]);
  }

  async function send(trimmedTitle: string, trimmedBody: string) {
    setSending(true);
    try {
      const count = await broadcastToAllUsers(trimmedTitle, trimmedBody);

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('broadcasts').insert({
        title: trimmedTitle,
        body: trimmedBody,
        sent_by: user?.id ?? null,
        recipient_count: count,
      });
      if (error) throw error;

      setTitle('');
      setBody('');
      loadHistory();
      Alert.alert('تم الإرسال', `تم إرسال الإشعار إلى ${count} جهاز`);
    } catch {
      Alert.alert('خطأ', 'تعذر إرسال الإشعار، حاول مرة أخرى');
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        <AdminHeader icon={Megaphone} title="إشعار عام" />

        <View style={styles.form}>
          <Text style={styles.inputLabel}>العنوان</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="مثال: عرض خاص هذا الأسبوع"
            placeholderTextColor={colors.muted}
            textAlign="right"
            maxLength={100}
          />

          <Text style={styles.inputLabel}>نص الرسالة</Text>
          <TextInput
            style={[styles.input, styles.bodyInput]}
            value={body}
            onChangeText={setBody}
            placeholder="اكتب رسالتك هنا..."
            placeholderTextColor={colors.muted}
            textAlign="right"
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[styles.saveBtn, sending && styles.saveBtnDisabled]}
            onPress={confirmSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <View style={styles.saveBtnRow}>
                <Send size={16} color={colors.background} strokeWidth={2} />
                <Text style={styles.saveBtnText}>إرسال للجميع</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>الإشعارات السابقة</Text>
        {history.length === 0 ? (
          <View style={styles.emptyCard}>
            <Megaphone size={28} color={colors.muted} strokeWidth={1} />
            <Text style={styles.emptyText}>لا توجد إشعارات سابقة</Text>
          </View>
        ) : (
          history.map((b) => (
            <View key={b.id} style={styles.historyCard}>
              <Text style={styles.historyTitle}>{b.title}</Text>
              <Text style={styles.historyBody}>{b.body}</Text>
              <View style={styles.historyMetaRow}>
                <Text style={styles.historyMeta}>{b.recipient_count} جهاز</Text>
                <Text style={styles.historyMeta}>{formatDateTime(new Date(b.created_at))}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 40 },
  form: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 8,
    marginBottom: 28,
  },
  inputLabel: { color: colors.muted, fontSize: 12, textAlign: 'right' },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, color: colors.white, fontSize: 14,
  },
  bodyInput: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: colors.gold, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  sectionTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
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
  historyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 8,
    gap: 6,
  },
  historyTitle: { color: colors.white, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  historyBody: { color: colors.muted, fontSize: 13, textAlign: 'right', lineHeight: 19 },
  historyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  historyMeta: { color: colors.muted, fontSize: 11 },
});
