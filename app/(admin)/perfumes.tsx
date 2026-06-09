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
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Sparkles, Edit2, Plus, X, Check, ShoppingBag, Camera, TrendingDown, MessageCircle } from 'lucide-react-native';
import { Linking } from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';
import { sendPushNotification } from '../../lib/utils/notifications';

function openWhatsApp(phone: string, message = '') {
  const cleaned = phone.replace(/[^0-9]/g, '');
  Linking.openURL(`https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`);
}

interface Perfume {
  id: string;
  name: string;
  description: string;
  price_ils: number;
  cost_price_ils: number | null;
  stock_quantity: number;
  image_url: string | null;
  is_active: boolean;
}

interface PerfumeOrder {
  id: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  perfumes: { name: string; price_ils: number } | null;
  users: { full_name: string; whatsapp_number: string; expo_push_token: string | null } | null;
}

type Tab = 'perfumes' | 'orders';

export default function AdminPerfumes() {
  const [tab, setTab] = useState<Tab>('orders');
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [orders, setOrders] = useState<PerfumeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Perfume | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = useCallback(async () => {
    const [perfumesRes, ordersRes] = await Promise.all([
      supabase.from('perfumes').select('*').order('name'),
      supabase
        .from('perfume_orders')
        .select('id, quantity, status, created_at, perfumes(name, price_ils), users(full_name, whatsapp_number, expo_push_token)')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    setPerfumes(perfumesRes.data ?? []);
    setOrders((ordersRes.data ?? []) as PerfumeOrder[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  function onRefresh() { setRefreshing(true); load(); }

  function openAdd() {
    setEditTarget(null);
    setName(''); setDescription(''); setPrice(''); setCostPrice('');
    setStock(''); setIsActive(true); setLocalImageUri(null);
    setModalVisible(true);
  }

  function openEdit(p: Perfume) {
    setEditTarget(p);
    setName(p.name);
    setDescription(p.description ?? '');
    setPrice(String(p.price_ils));
    setCostPrice(p.cost_price_ils != null ? String(p.cost_price_ils) : '');
    setStock(String(p.stock_quantity));
    setIsActive(p.is_active);
    setLocalImageUri(p.image_url);
    setModalVisible(true);
  }

  function pickImage() {
    Alert.alert('إضافة صورة', 'اختر مصدر الصورة', [
      {
        text: 'من المكتبة',
        onPress: () => launchPicker('library'),
      },
      {
        text: 'التقط صورة',
        onPress: () => launchPicker('camera'),
      },
      { text: 'إلغاء', style: 'cancel' },
    ]);
  }

  async function launchPicker(source: 'library' | 'camera') {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه', 'يجب السماح بالوصول للكاميرا');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه', 'يجب السماح بالوصول للمكتبة');
        return;
      }
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
          aspect: [1, 1],
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
          aspect: [1, 1],
        });

    if (!result.canceled && result.assets[0]) {
      setLocalImageUri(result.assets[0].uri);
    }
  }

  async function uploadImageAndGetUrl(uri: string): Promise<string | null> {
    setUploadingImage(true);
    try {
      const filename = `perfume_${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('perfume-images')
        .upload(filename, blob, { contentType: 'image/jpeg', upsert: true });

      if (error || !data) return null;

      const { data: urlData } = supabase.storage
        .from('perfume-images')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch {
      return null;
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || !price.trim() || !stock.trim()) {
      Alert.alert('خطأ', 'اسم العطر والسعر والمخزون مطلوبة');
      return;
    }
    const priceNum = parseInt(price, 10);
    const stockNum = parseInt(stock, 10);
    if (isNaN(priceNum) || isNaN(stockNum)) {
      Alert.alert('خطأ', 'السعر والمخزون يجب أن تكون أرقام صحيحة');
      return;
    }

    setSaving(true);

    // Upload new image if a local URI was selected (not a remote URL)
    let imageUrl: string | null = editTarget?.image_url ?? null;
    if (localImageUri && !localImageUri.startsWith('http')) {
      const uploaded = await uploadImageAndGetUrl(localImageUri);
      if (uploaded) imageUrl = uploaded;
    } else if (localImageUri?.startsWith('http')) {
      imageUrl = localImageUri;
    }

    const costNum = costPrice.trim() ? parseInt(costPrice, 10) : null;

    const payload = {
      name: name.trim(),
      description: description.trim(),
      price_ils: priceNum,
      cost_price_ils: costNum,
      stock_quantity: stockNum,
      image_url: imageUrl,
      is_active: isActive,
    };

    if (editTarget) {
      const { error } = await supabase.from('perfumes').update(payload).eq('id', editTarget.id);
      if (!error) setPerfumes((prev) => prev.map((p) => p.id === editTarget.id ? { ...p, ...payload } : p));
    } else {
      const { data, error } = await supabase.from('perfumes').insert(payload).select().single();
      if (!error && data) setPerfumes((prev) => [...prev, data as Perfume]);
    }

    setSaving(false);
    setModalVisible(false);
  }

  async function deletePerfume(p: Perfume) {
    const { count } = await supabase
      .from('perfume_orders')
      .select('id', { count: 'exact', head: true })
      .eq('perfume_id', p.id)
      .eq('status', 'pending');

    if ((count ?? 0) > 0) {
      Alert.alert('تحذير', 'لا يمكن حذف عطر له طلبات معلقة');
      return;
    }

    Alert.alert('حذف العطر', `هل أنت متأكد من حذف "${p.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('perfumes').delete().eq('id', p.id);
          if (!error) setPerfumes((prev) => prev.filter((x) => x.id !== p.id));
        },
      },
    ]);
  }

  async function handleOrderAction(order: PerfumeOrder, action: 'approved' | 'rejected') {
    const { error } = await supabase
      .from('perfume_orders')
      .update({ status: action })
      .eq('id', order.id);

    if (error) { Alert.alert('خطأ', 'حدث خطأ أثناء تحديث الطلب'); return; }

    if (action === 'approved' && order.perfumes) {
      const perfume = perfumes.find((p) => p.name === order.perfumes?.name);
      if (perfume) {
        const newStock = Math.max(0, perfume.stock_quantity - order.quantity);
        await supabase.from('perfumes').update({ stock_quantity: newStock }).eq('id', perfume.id);
        setPerfumes((prev) => prev.map((p) => p.id === perfume.id ? { ...p, stock_quantity: newStock } : p));
      }
    }

    const token = order.users?.expo_push_token;
    if (token) {
      const msg = action === 'approved' ? 'تمت الموافقة على طلبك' : 'تم رفض طلبك';
      sendPushNotification(token, 'طلب العطر', `${msg}: ${order.perfumes?.name ?? ''}`);
    }

    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: action } : o));
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.gold} /></View>;
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const otherOrders = orders.filter((o) => o.status !== 'pending');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {tab === 'perfumes' && (
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Plus size={18} color={colors.background} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconWrap}>
            <Sparkles size={20} color={colors.gold} strokeWidth={1.5} />
          </View>
          <Text style={styles.headerTitle}>العطور</Text>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'orders' && styles.tabBtnActive]}
          onPress={() => setTab('orders')}
        >
          <Text style={[styles.tabBtnText, tab === 'orders' && styles.tabBtnTextActive]}>
            الطلبات {pendingOrders.length > 0 ? `(${pendingOrders.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'perfumes' && styles.tabBtnActive]}
          onPress={() => setTab('perfumes')}
        >
          <Text style={[styles.tabBtnText, tab === 'perfumes' && styles.tabBtnTextActive]}>
            العطور
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {tab === 'perfumes' ? (
          perfumes.map((p) => (
            <View key={p.id} style={[styles.perfumeCard, !p.is_active && styles.inactiveCard]}>
              {/* Thumbnail */}
              {p.image_url ? (
                <Image source={{ uri: p.image_url }} style={styles.thumbnail} />
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <Sparkles size={18} color={p.is_active ? colors.gold : colors.muted} strokeWidth={1.5} />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={[styles.perfumeName, !p.is_active && styles.inactiveText]}>{p.name}</Text>
                <Text style={styles.perfumePriceRow}>
                  بيع: <Text style={styles.sellPrice}>{p.price_ils} ₪</Text>
                  {p.cost_price_ils != null && (
                    <Text style={styles.costPrice}>  •  تكلفة: {p.cost_price_ils} ₪</Text>
                  )}
                </Text>
                <Text style={styles.perfumeMeta}>مخزون: {p.stock_quantity}</Text>
              </View>

              <View style={styles.perfumeActions}>
                <Switch
                  value={p.is_active}
                  onValueChange={async () => {
                    await supabase.from('perfumes').update({ is_active: !p.is_active }).eq('id', p.id);
                    setPerfumes((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
                  }}
                  trackColor={{ false: colors.border, true: colors.goldTransparent }}
                  thumbColor={p.is_active ? colors.gold : colors.muted}
                />
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(p)}>
                  <Edit2 size={14} color={colors.gold} strokeWidth={1.5} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deletePerfume(p)}>
                  <X size={14} color={colors.error} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <>
            {pendingOrders.length === 0 && otherOrders.length === 0 ? (
              <View style={styles.emptyCard}>
                <ShoppingBag size={40} color={colors.muted} strokeWidth={1} />
                <Text style={styles.emptyText}>لا توجد طلبات</Text>
              </View>
            ) : (
              <>
                {pendingOrders.length > 0 && (
                  <>
                    <Text style={styles.orderGroupLabel}>معلق</Text>
                    {pendingOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onApprove={() => handleOrderAction(order, 'approved')}
                        onReject={() => handleOrderAction(order, 'rejected')}
                      />
                    ))}
                  </>
                )}
                {otherOrders.length > 0 && (
                  <>
                    <Text style={[styles.orderGroupLabel, { marginTop: 16 }]}>السابقة</Text>
                    {otherOrders.map((order) => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScrollContainer}
            contentContainerStyle={styles.modalSheet}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalClose} onPress={() => setModalVisible(false)}>
                <X size={20} color={colors.muted} strokeWidth={1.5} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editTarget ? 'تعديل العطر' : 'إضافة عطر'}</Text>
            </View>

            {/* Image Picker */}
            <Text style={styles.inputLabel}>صورة العطر</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {localImageUri ? (
                <Image source={{ uri: localImageUri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Camera size={28} color={colors.muted} strokeWidth={1.5} />
                  <Text style={styles.imagePlaceholderText}>اضغط لإضافة صورة</Text>
                </View>
              )}
              {localImageUri && (
                <View style={styles.imageOverlay}>
                  <Camera size={20} color={colors.white} strokeWidth={1.5} />
                  <Text style={styles.imageOverlayText}>تغيير</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.inputLabel}>الاسم</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName}
              placeholder="اسم العطر" placeholderTextColor={colors.muted} textAlign="right" />

            <Text style={styles.inputLabel}>الوصف</Text>
            <TextInput style={[styles.input, styles.multilineInput]} value={description}
              onChangeText={setDescription} placeholder="وصف مختصر..."
              placeholderTextColor={colors.muted} textAlign="right" multiline textAlignVertical="top" />

            <Text style={styles.inputLabel}>سعر البيع للزبون (₪)</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice}
              keyboardType="number-pad" placeholder="50" placeholderTextColor={colors.muted} textAlign="right" />

            {/* Cost price - admin only, not shown to customers */}
            <View style={styles.costPriceLabel}>
              <View style={styles.adminBadge}>
                <TrendingDown size={11} color={colors.background} strokeWidth={2} />
                <Text style={styles.adminBadgeText}>أدمن فقط</Text>
              </View>
              <Text style={styles.inputLabel}>سعر التكلفة (شو دفعت عليه) (₪)</Text>
            </View>
            <TextInput style={[styles.input, styles.costInput]} value={costPrice}
              onChangeText={setCostPrice} keyboardType="number-pad"
              placeholder="اختياري" placeholderTextColor={colors.muted} textAlign="right" />

            <Text style={styles.inputLabel}>المخزون</Text>
            <TextInput style={styles.input} value={stock} onChangeText={setStock}
              keyboardType="number-pad" placeholder="10" placeholderTextColor={colors.muted} textAlign="right" />

            <View style={styles.switchRow}>
              <Switch value={isActive} onValueChange={setIsActive}
                trackColor={{ false: colors.border, true: colors.goldTransparent }}
                thumbColor={isActive ? colors.gold : colors.muted} />
              <Text style={styles.switchLabel}>نشط</Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, (saving || uploadingImage) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving || uploadingImage}
            >
              {saving || uploadingImage ? (
                <View style={styles.saveBtnLoading}>
                  <ActivityIndicator color={colors.background} />
                  <Text style={styles.saveBtnText}>
                    {uploadingImage ? 'جاري رفع الصورة...' : 'جاري الحفظ...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.saveBtnText}>{editTarget ? 'حفظ التعديلات' : 'إضافة'}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function OrderCard({
  order,
  onApprove,
  onReject,
}: {
  order: PerfumeOrder;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const isPending = order.status === 'pending';
  const statusColors: Record<string, string> = {
    pending: colors.gold, approved: colors.success,
    rejected: colors.error, cancelled: colors.muted,
  };
  const statusLabels: Record<string, string> = {
    pending: 'معلق', approved: 'موافق',
    rejected: 'مرفوض', cancelled: 'ملغي',
  };

  return (
    <View style={[styles.orderCard, !isPending && styles.orderCardDim]}>
      <View style={styles.orderTop}>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[order.status] + '22' }]}>
          <Text style={[styles.statusText, { color: statusColors[order.status] }]}>
            {statusLabels[order.status]}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.orderPerfumeName}>{order.perfumes?.name ?? '—'}</Text>
          <Text style={styles.orderCustomer}>{order.users?.full_name ?? '—'}</Text>
        </View>
      </View>
      <View style={styles.orderMeta}>
        <Text style={styles.orderTotal}>{(order.perfumes?.price_ils ?? 0) * order.quantity} ₪</Text>
        <Text style={styles.orderQty}>الكمية: {order.quantity}</Text>
      </View>
      {order.users?.whatsapp_number && (
        <TouchableOpacity
          style={styles.whatsappBtn}
          onPress={() => openWhatsApp(
            order.users!.whatsapp_number,
            `مرحباً ${order.users!.full_name}، بخصوص طلبك للعطر "${order.perfumes?.name ?? ''}" 🌹`,
          )}
        >
          <Text style={styles.whatsappBtnText}>فتح واتساب</Text>
          <MessageCircle size={15} color="#25D366" strokeWidth={1.5} />
        </TouchableOpacity>
      )}
      {isPending && (
        <View style={styles.orderActions}>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
            <X size={14} color={colors.error} strokeWidth={2} />
            <Text style={styles.rejectBtnText}>رفض</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.approveBtn} onPress={onApprove}>
            <Check size={14} color={colors.background} strokeWidth={2.5} />
            <Text style={styles.approveBtnText}>موافقة</Text>
          </TouchableOpacity>
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

  // Perfume list card
  perfumeCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 12, flexDirection: 'row',
    alignItems: 'center', marginBottom: 10, gap: 10,
  },
  inactiveCard: { opacity: 0.5 },
  thumbnail: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: colors.heroCard,
  },
  thumbnailPlaceholder: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: colors.goldFaint, justifyContent: 'center', alignItems: 'center',
  },
  perfumeName: { color: colors.white, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  inactiveText: { color: colors.muted },
  perfumePriceRow: { color: colors.muted, fontSize: 12, marginTop: 2, textAlign: 'right' },
  sellPrice: { color: colors.gold, fontWeight: '700' },
  costPrice: { color: '#888' },
  perfumeMeta: { color: colors.muted, fontSize: 11, marginTop: 1, textAlign: 'right' },
  perfumeActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.goldFaint, justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E0525211', justifyContent: 'center', alignItems: 'center',
  },

  emptyCard: {
    backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 40, alignItems: 'center', gap: 12, marginTop: 20,
  },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: 'center' },

  // Orders
  orderGroupLabel: {
    color: colors.gold, fontSize: 12, fontWeight: '700',
    textAlign: 'right', marginBottom: 8, paddingRight: 4,
  },
  orderCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.goldLight,
    borderRadius: 16, padding: 14, marginBottom: 10, gap: 8,
  },
  orderCardDim: { borderColor: colors.border, opacity: 0.7 },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statusBadge: { borderRadius: 10, paddingVertical: 4, paddingHorizontal: 10 },
  statusText: { fontSize: 11, fontWeight: '700' },
  orderPerfumeName: { color: colors.white, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  orderCustomer: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 2 },
  orderMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderQty: { color: colors.muted, fontSize: 13 },
  orderTotal: { color: colors.gold, fontSize: 15, fontWeight: '700' },
  orderWhatsapp: { color: colors.text.secondary, fontSize: 12, textAlign: 'right' },
  orderActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
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

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalScrollContainer: {
    maxHeight: '92%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalSheet: { padding: 24, gap: 12, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },

  // Image picker
  imagePicker: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePlaceholderText: { color: colors.muted, fontSize: 13 },
  imagePreview: { width: '100%', height: '100%' },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000AA',
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  imageOverlayText: { color: colors.white, fontSize: 12, fontWeight: '600' },

  inputLabel: { color: colors.muted, fontSize: 12, textAlign: 'right' },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, color: colors.white, fontSize: 14,
  },
  multilineInput: { minHeight: 70, textAlignVertical: 'top' },

  // Cost price field
  costPriceLabel: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  adminBadgeText: { color: colors.background, fontSize: 10, fontWeight: '700' },
  costInput: { borderColor: colors.goldLight },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  switchLabel: { color: colors.white, fontSize: 14 },
  saveBtn: {
    backgroundColor: colors.gold, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saveBtnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
});
