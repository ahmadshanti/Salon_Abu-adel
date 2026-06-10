import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { Sparkles, ShoppingBag, Package, X, Plus, Minus, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = (SCREEN_W - 16 * 2 - 12) / 2;

interface Perfume {
  id: string;
  name: string;
  description: string;
  price_ils: number;
  stock_quantity: number;
  image_url: string | null;
  is_active: boolean;
}

export default function Perfumes() {
  const router = useRouter();
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Perfume | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [ordering, setOrdering] = useState(false);

  useEffect(() => { loadPerfumes(); }, []);

  async function loadPerfumes() {
    const { data } = await supabase
      .from('perfumes')
      .select('id, name, description, price_ils, stock_quantity, image_url, is_active')
      .eq('is_active', true)
      .order('name');
    setPerfumes(data ?? []);
    setLoading(false);
  }

  function openOrder(perfume: Perfume) {
    setSelected(perfume);
    setQuantity(1);
  }

  function closeOrder() { setSelected(null); }

  async function submitOrder() {
    if (!selected) return;
    setOrdering(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setOrdering(false); return; }

    const { error } = await supabase.from('perfume_orders').insert({
      user_id: user.id,
      perfume_id: selected.id,
      quantity,
      status: 'pending',
    });

    setOrdering(false);
    closeOrder();

    if (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء إرسال الطلب');
      return;
    }
    Alert.alert('تم إرسال الطلب', 'سيتم التواصل معك بعد مراجعة الطلب من قبل الإدارة', [{ text: 'حسناً' }]);
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.gold} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconWrap}>
            <Sparkles size={20} color={colors.gold} strokeWidth={1.5} />
          </View>
          <Text style={styles.headerTitle}>متجر العطور</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {perfumes.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={48} color={colors.muted} strokeWidth={1} />
            <Text style={styles.emptyTitle}>لا توجد عطور متاحة</Text>
            <Text style={styles.emptySub}>تحقق لاحقاً للاطلاع على العروض الجديدة</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {perfumes.map((perfume) => {
              const outOfStock = perfume.stock_quantity === 0;
              const lowStock = perfume.stock_quantity > 0 && perfume.stock_quantity <= 2;
              return (
                <View key={perfume.id} style={[styles.perfumeCard, outOfStock && styles.perfumeCardDim]}>
                  {/* Image */}
                  <View style={styles.imageWrap}>
                    {perfume.image_url ? (
                      <Image source={{ uri: perfume.image_url }} style={styles.perfumeImage} />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Sparkles size={36} color={colors.gold} strokeWidth={1} />
                      </View>
                    )}

                    {/* Stock badge — overlaid on image */}
                    {outOfStock && (
                      <View style={[styles.stockBadge, styles.stockBadgeOut]}>
                        <Text style={styles.stockBadgeText}>نفذت الكمية</Text>
                      </View>
                    )}
                    {lowStock && (
                      <View style={[styles.stockBadge, styles.stockBadgeLow]}>
                        <Text style={styles.stockBadgeText}>متبقي قليل</Text>
                      </View>
                    )}
                  </View>

                  {/* Card body */}
                  <View style={styles.cardBody}>
                    <Text style={styles.perfumeName} numberOfLines={1}>{perfume.name}</Text>
                    {perfume.description ? (
                      <Text style={styles.perfumeDesc} numberOfLines={1}>{perfume.description}</Text>
                    ) : null}

                    <View style={styles.cardFooter}>
                      <Text style={styles.perfumePrice}>{perfume.price_ils} ₪</Text>
                      <TouchableOpacity
                        style={[styles.orderBtn, outOfStock && styles.orderBtnDisabled]}
                        onPress={() => !outOfStock && openOrder(perfume)}
                        disabled={outOfStock}
                        activeOpacity={0.8}
                      >
                        <ShoppingBag size={14} color={colors.background} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Order Modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeOrder}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Handle */}
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalClose} onPress={closeOrder}>
                <X size={18} color={colors.muted} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تفاصيل الطلب</Text>
            </View>

            {/* Perfume preview */}
            <View style={styles.modalPreview}>
              {selected?.image_url ? (
                <Image source={{ uri: selected.image_url }} style={styles.modalImage} />
              ) : (
                <View style={styles.modalImagePlaceholder}>
                  <Sparkles size={40} color={colors.gold} strokeWidth={1} />
                </View>
              )}
              <Text style={styles.modalPerfumeName}>{selected?.name}</Text>
              <Text style={styles.modalPerfumePrice}>{selected?.price_ils} ₪ للقطعة</Text>
            </View>

            {/* Quantity */}
            <Text style={styles.modalLabel}>الكمية</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus size={16} color={colors.white} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => Math.min(selected?.stock_quantity ?? 1, q + 1))}
              >
                <Plus size={16} color={colors.white} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalTotalRow}>
              <Text style={styles.modalTotal}>{(selected?.price_ils ?? 0) * quantity} ₪</Text>
              <Text style={styles.modalTotalLabel}>الإجمالي</Text>
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, ordering && styles.confirmBtnDisabled]}
              onPress={submitOrder}
              disabled={ordering}
            >
              {ordering ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.confirmBtnText}>إرسال الطلب</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.goldFaint, borderWidth: 1, borderColor: colors.goldLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.goldFaint, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: colors.white, fontSize: 22, fontWeight: '700' },

  scroll: { padding: 16, paddingBottom: 40 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  perfumeCard: {
    width: CARD_W,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
  perfumeCardDim: { opacity: 0.65 },

  imageWrap: {
    width: CARD_W,
    height: CARD_W,
    position: 'relative',
    backgroundColor: colors.heroCard,
  },
  perfumeImage: {
    width: CARD_W,
    height: CARD_W,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: CARD_W,
    height: CARD_W,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.heroCard,
  },

  stockBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stockBadgeOut: { backgroundColor: '#E0525266' },
  stockBadgeLow: { backgroundColor: '#F5A62366' },
  stockBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  cardBody: { padding: 12, gap: 4 },
  perfumeName: { color: colors.white, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  perfumeDesc: { color: colors.muted, fontSize: 11, textAlign: 'right' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 6,
  },
  perfumePrice: { color: colors.gold, fontSize: 15, fontWeight: '700' },
  orderBtn: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: colors.gold,
    justifyContent: 'center', alignItems: 'center',
  },
  orderBtnDisabled: { backgroundColor: colors.border },

  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { color: colors.white, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: colors.muted, fontSize: 13, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, gap: 16,
    borderTopWidth: 1, borderColor: colors.border,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  modalClose: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },

  modalPreview: { alignItems: 'center', gap: 10 },
  modalImage: {
    width: 130, height: 130,
    borderRadius: 20,
    borderWidth: 1.5, borderColor: colors.goldLight,
  },
  modalImagePlaceholder: {
    width: 130, height: 130,
    borderRadius: 20,
    backgroundColor: colors.heroCard,
    borderWidth: 1.5, borderColor: colors.goldLight,
    justifyContent: 'center', alignItems: 'center',
  },
  modalPerfumeName: { color: colors.white, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  modalPerfumePrice: { color: colors.muted, fontSize: 13, textAlign: 'center' },

  modalLabel: { color: colors.muted, fontSize: 13, textAlign: 'right' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  qtyBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  qtyValue: { color: colors.white, fontSize: 24, fontWeight: '700', minWidth: 40, textAlign: 'center' },

  modalTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border,
  },
  modalTotalLabel: { color: colors.muted, fontSize: 14 },
  modalTotal: { color: colors.gold, fontSize: 24, fontWeight: '700' },

  confirmBtn: {
    backgroundColor: colors.gold, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
});
