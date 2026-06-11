import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Plus, Trash2, LayoutGrid, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';
import { uploadImage } from '../../lib/utils/uploadImage';
import { navigateBack } from '../../lib/utils/navigation';

const { width } = Dimensions.get('window');
const IMG_SIZE = (width - 52) / 2;

interface GalleryImage {
  id: string;
  image_url: string;
  display_order: number;
}

export default function AdminGallery() {
  const router = useRouter();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('gallery')
      .select('id, image_url, display_order')
      .order('display_order', { ascending: true });
    setImages(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  async function pickAndUpload() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('الصلاحيات', 'يرجى السماح بالوصول إلى الصور');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled) return;

    setUploading(true);
    const uri = result.assets[0].uri;
    const { url, error } = await uploadImage(uri, 'gallery-images', 'gallery');
    if (error || !url) {
      Alert.alert('خطأ', error ?? 'فشل رفع الصورة');
      setUploading(false);
      return;
    }
    const maxOrder = images.reduce((m, img) => Math.max(m, img.display_order), 0);
    const { error: insertError } = await supabase
      .from('gallery')
      .insert({ image_url: url, display_order: maxOrder + 1 });

    if (insertError) {
      Alert.alert('خطأ', `فشل حفظ الصورة: ${insertError.message}`);
      setUploading(false);
      return;
    }
    setUploading(false);
    load();
  }

  async function deleteImage(id: string) {
    Alert.alert('حذف الصورة', 'هل أنت متأكد من حذف هذه الصورة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('gallery').delete().eq('id', id);
          setImages((prev) => prev.filter((img) => img.id !== id));
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

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.gold}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigateBack(router, '/(admin)')}>
            <ArrowLeft size={18} color={colors.gold} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconWrap}>
              <LayoutGrid size={20} color={colors.gold} strokeWidth={1.5} />
            </View>
            <Text style={styles.headerTitle}>معرض الصور</Text>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, uploading && styles.addBtnDisabled]}
            onPress={pickAndUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <>
                <Plus size={16} color={colors.background} strokeWidth={2.5} />
                <Text style={styles.addBtnText}>إضافة</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Count badge */}
        {images.length > 0 && (
          <View style={styles.countRow}>
            <Text style={styles.countText}>{images.length} صورة • تظهر في الصفحة الرئيسية</Text>
          </View>
        )}

        {/* Grid */}
        {images.length === 0 ? (
          <View style={styles.emptyWrap}>
            <LayoutGrid size={44} color={colors.muted} strokeWidth={1} />
            <Text style={styles.emptyTitle}>لا توجد صور</Text>
            <Text style={styles.emptySubText}>أضف صوراً لعرضها في الصفحة الرئيسية للزبائن</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {images.map((img) => (
              <View key={img.id} style={[styles.imgWrap, { width: IMG_SIZE, height: IMG_SIZE }]}>
                <Image source={{ uri: img.image_url }} style={styles.img} resizeMode="cover" />
                <View style={styles.imgOverlay} />
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteImage(img.id)}>
                  <Trash2 size={14} color="#fff" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 40 },
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
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.goldFaint, borderWidth: 1, borderColor: colors.goldLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  addBtnDisabled: { opacity: 0.6 },
  addBtnText: { color: colors.background, fontSize: 13, fontWeight: '700' },
  countRow: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  countText: { color: colors.muted, fontSize: 12, textAlign: 'right' },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  emptySubText: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  imgWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
  },
  img: { width: '100%', height: '100%' },
  imgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  deleteBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(224,82,82,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
