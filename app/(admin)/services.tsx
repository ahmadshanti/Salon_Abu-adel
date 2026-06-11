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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Scissors, Edit2, Plus, X, Clock } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';
import { AdminHeader } from '../../components/AdminHeader';
import { LoadingScreen } from '../../components/LoadingScreen';
import type { Service } from '../../lib/types';

export default function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = useCallback(async () => {
    const { data } = await supabase.from('services').select('*').order('name');
    setServices(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  function onRefresh() { setRefreshing(true); load(); }

  function openAdd() {
    setEditTarget(null);
    setName(''); setPrice(''); setDuration(''); setIsActive(true);
    setModalVisible(true);
  }

  function openEdit(service: Service) {
    setEditTarget(service);
    setName(service.name);
    setPrice(String(service.price_ils));
    setDuration(String(service.duration_minutes));
    setIsActive(service.is_active);
    setModalVisible(true);
  }

  async function handleSave() {
    if (!name.trim() || !price.trim() || !duration.trim()) {
      Alert.alert('خطأ', 'يرجى تعبئة جميع الحقول');
      return;
    }
    const priceNum = parseInt(price, 10);
    const durationNum = parseInt(duration, 10);
    if (isNaN(priceNum) || isNaN(durationNum)) {
      Alert.alert('خطأ', 'السعر والمدة يجب أن تكون أرقام صحيحة');
      return;
    }
    if (priceNum < 0) {
      Alert.alert('خطأ', 'السعر لا يمكن أن يكون سالباً');
      return;
    }
    if (durationNum <= 0) {
      Alert.alert('خطأ', 'المدة يجب أن تكون أكبر من صفر');
      return;
    }
    setSaving(true);
    const payload = { name: name.trim(), price_ils: priceNum, duration_minutes: durationNum, is_active: isActive };

    if (editTarget) {
      const { error } = await supabase.from('services').update(payload).eq('id', editTarget.id);
      if (error) {
        setSaving(false);
        Alert.alert('خطأ', 'تعذر حفظ التعديلات، تأكد من الاتصال وحاول مجدداً');
        return;
      }
      setServices((prev) => prev.map((s) => s.id === editTarget.id ? { ...s, ...payload } : s));
    } else {
      const { data, error } = await supabase.from('services').insert(payload).select().single();
      if (error || !data) {
        setSaving(false);
        Alert.alert('خطأ', 'تعذر إضافة الخدمة، تأكد من الاتصال وحاول مجدداً');
        return;
      }
      setServices((prev) => [...prev, data as Service]);
    }
    setSaving(false);
    setModalVisible(false);
  }

  async function toggleActive(service: Service) {
    const { error } = await supabase.from('services').update({ is_active: !service.is_active }).eq('id', service.id);
    if (!error) setServices((prev) => prev.map((s) => s.id === service.id ? { ...s, is_active: !s.is_active } : s));
  }

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <AdminHeader
        icon={Scissors}
        title="الخدمات"
        right={
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Plus size={18} color={colors.background} strokeWidth={2.5} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {services.map((service) => (
          <View key={service.id} style={[styles.serviceCard, !service.is_active && styles.serviceCardInactive]}>
            <View style={styles.serviceLeft}>
              <View style={styles.serviceIconWrap}>
                <Scissors size={18} color={service.is_active ? colors.gold : colors.muted} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.serviceName, !service.is_active && styles.inactiveText]}>
                  {service.name}
                </Text>
                <View style={styles.serviceMeta}>
                  <Clock size={11} color={colors.muted} strokeWidth={1.5} />
                  <Text style={styles.serviceMetaText}>{service.duration_minutes} دقيقة</Text>
                  <Text style={styles.servicePrice}>{service.price_ils} ₪</Text>
                </View>
              </View>
            </View>
            <View style={styles.serviceActions}>
              <Switch
                value={service.is_active}
                onValueChange={() => toggleActive(service)}
                trackColor={{ false: colors.border, true: colors.goldTransparent }}
                thumbColor={service.is_active ? colors.gold : colors.muted}
              />
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(service)}>
                <Edit2 size={15} color={colors.gold} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
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
                <TouchableOpacity style={styles.modalClose} onPress={() => setModalVisible(false)}>
                  <X size={20} color={colors.muted} strokeWidth={1.5} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{editTarget ? 'تعديل الخدمة' : 'إضافة خدمة'}</Text>
              </View>

              <Text style={styles.inputLabel}>اسم الخدمة</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName}
                placeholder="مثال: حلاقة كاملة" placeholderTextColor={colors.muted} textAlign="right" />

              <Text style={styles.inputLabel}>السعر (₪)</Text>
              <TextInput style={styles.input} value={price} onChangeText={setPrice}
                keyboardType="number-pad" placeholder="25" placeholderTextColor={colors.muted} textAlign="right" />

              <Text style={styles.inputLabel}>المدة (دقيقة)</Text>
              <TextInput style={styles.input} value={duration} onChangeText={setDuration}
                keyboardType="number-pad" placeholder="30" placeholderTextColor={colors.muted} textAlign="right" />

              <View style={styles.switchRow}>
                <Switch
                  value={isActive} onValueChange={setIsActive}
                  trackColor={{ false: colors.border, true: colors.goldTransparent }}
                  thumbColor={isActive ? colors.gold : colors.muted}
                />
                <Text style={styles.switchLabel}>نشط</Text>
              </View>

              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.background} /> : (
                  <Text style={styles.saveBtnText}>{editTarget ? 'حفظ التعديلات' : 'إضافة'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center',
  },
  scroll: { padding: 16, paddingBottom: 40 },
  serviceCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 14, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  serviceCardInactive: { opacity: 0.5 },
  serviceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  serviceIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.goldFaint, justifyContent: 'center', alignItems: 'center',
  },
  serviceName: { color: colors.white, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  inactiveText: { color: colors.muted },
  serviceMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  serviceMetaText: { color: colors.muted, fontSize: 12 },
  servicePrice: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  serviceActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.goldFaint, justifyContent: 'center', alignItems: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalScroll: {
    maxHeight: '90%',
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
  inputLabel: { color: colors.muted, fontSize: 12, textAlign: 'right' },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, color: colors.white, fontSize: 14,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  switchLabel: { color: colors.white, fontSize: 14 },
  saveBtn: {
    backgroundColor: colors.gold, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
});
