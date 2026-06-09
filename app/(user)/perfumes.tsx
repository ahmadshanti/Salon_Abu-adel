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
  TextInput,
  Image,
} from 'react-native';
import { Sparkles, ShoppingBag, Package, X, Plus, Minus } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';

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
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Perfume | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    loadPerfumes();
  }, []);

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

  function closeOrder() {
    setSelected(null);
  }

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

    Alert.alert(
      'تم إرسال الطلب',
      'سيتم التواصل معك بعد مراجعة الطلب من قبل الإدارة',
      [{ text: 'حسناً' }],
    );
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
        <View style={styles.headerIconWrap}>
          <Sparkles size={20} color={colors.gold} strokeWidth={1.5} />
        </View>
        <Text style={styles.headerTitle}>متجر العطور</Text>
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
            {perfumes.map((perfume) => (
              <View key={perfume.id} style={styles.perfumeCard}>
                <View style={styles.perfumeImageWrap}>
                  {perfume.image_url ? (
                    <Image source={{ uri: perfume.image_url }} style={styles.perfumeImage} />
                  ) : (
                    <Sparkles size={32} color={colors.gold} strokeWidth={1} />
                  )}
                </View>
                <View style={styles.perfumeBody}>
                  <Text style={styles.perfumeName}>{perfume.name}</Text>
                  {perfume.description ? (
                    <Text style={styles.perfumeDesc} numberOfLines={2}>
                      {perfume.description}
                    </Text>
                  ) : null}
                  <View style={styles.perfumeFooter}>
                    <TouchableOpacity
                      style={[styles.orderBtn, perfume.stock_quantity === 0 && styles.orderBtnDisabled]}
                      onPress={() => perfume.stock_quantity > 0 && openOrder(perfume)}
                      disabled={perfume.stock_quantity === 0}
                    >
                      <ShoppingBag size={14} color={colors.background} strokeWidth={2} />
                      <Text style={styles.orderBtnText}>اطلب</Text>
                    </TouchableOpacity>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.perfumePrice}>{perfume.price_ils} ₪</Text>
                      {perfume.stock_quantity === 0 ? (
                        <Text style={styles.stockOut}>نفذت الكمية</Text>
                      ) : perfume.stock_quantity <= 2 ? (
                        <Text style={styles.stockLow}>متبقي قليل</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Order Modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={closeOrder}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalClose} onPress={closeOrder}>
                <X size={20} color={colors.muted} strokeWidth={1.5} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تفاصيل الطلب</Text>
            </View>

            <View style={styles.modalPerfumeRow}>
              {selected?.image_url ? (
                <Image source={{ uri: selected.image_url }} style={styles.modalPerfumeImage} />
              ) : (
                <View style={styles.modalPerfumeIcon}>
                  <Sparkles size={24} color={colors.gold} strokeWidth={1} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.modalPerfumeName}>{selected?.name}</Text>
                <Text style={styles.modalPerfumePrice}>{selected?.price_ils} ₪ للقطعة</Text>
              </View>
            </View>

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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  headerTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  grid: {
    gap: 14,
  },
  perfumeCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  perfumeImageWrap: {
    width: 100,
    height: 110,
    backgroundColor: colors.heroCard,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  perfumeImage: {
    width: 100,
    height: 110,
    resizeMode: 'cover',
  },
  perfumeBody: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  perfumeName: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  perfumeDesc: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 18,
  },
  perfumeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  perfumePrice: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  perfumeStock: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'right',
  },
  orderBtn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderBtnDisabled: {
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  orderBtnText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
  stockOut: {
    color: '#E05252',
    fontSize: 11,
    fontWeight: '600',
  },
  stockLow: {
    color: '#F5A623',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000AA',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  modalPerfumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
  },
  modalPerfumeIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.heroCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.goldLight,
  },
  modalPerfumeImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  modalPerfumeName: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  modalPerfumePrice: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'right',
    marginTop: 2,
  },
  modalLabel: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'right',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyValue: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center',
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalTotalLabel: {
    color: colors.muted,
    fontSize: 14,
  },
  modalTotal: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: '700',
  },
  confirmBtn: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
