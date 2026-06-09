import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { User, Phone, Mail, CalendarDays, Clock, LogOut, Camera } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';
import { formatDate, formatTime } from '../../lib/utils/time';

interface UserProfile {
  full_name: string;
  whatsapp_number: string;
  avatar_url: string | null;
}

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled';
  notes: string | null;
  services: { name: string; price_ils: number } | null;
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setEmail(user.email ?? '');
    setUserId(user.id);

    const [profileRes, bookingsRes] = await Promise.all([
      supabase.from('users').select('full_name, whatsapp_number, avatar_url').eq('id', user.id).single(),
      supabase
        .from('bookings')
        .select('id, start_time, end_time, status, notes, services(name, price_ils)')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })
        .limit(20),
    ]);

    setProfile(profileRes.data);
    setBookings((bookingsRes.data ?? []) as Booking[]);
    setLoading(false);
  }

  async function handleSignOut() {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('تنبيه', 'يجب السماح بالوصول للمكتبة');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const uri = result.assets[0].uri;
      const filename = `avatar_${userId}_${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filename, blob, { contentType: 'image/jpeg', upsert: true });

      if (error || !data) {
        Alert.alert('خطأ', 'فشل رفع الصورة');
        return;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path);
      const avatarUrl = urlData.publicUrl;

      await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', userId);
      setProfile((prev) => prev ? { ...prev, avatar_url: avatarUrl } : prev);
    } catch {
      Alert.alert('خطأ', 'حدث خطأ أثناء رفع الصورة');
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const upcoming = bookings.filter(
    (b) => b.status === 'confirmed' && new Date(b.start_time) >= new Date(),
  );
  const past = bookings.filter(
    (b) => b.status !== 'confirmed' || new Date(b.start_time) < new Date(),
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} disabled={signingOut}>
            {signingOut ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <LogOut size={18} color={colors.error} strokeWidth={1.5} />
            )}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>حسابي</Text>
        </View>

        {/* Avatar + Name */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrap} onPress={handlePickAvatar} disabled={uploadingAvatar}>
            {uploadingAvatar ? (
              <View style={styles.avatarCircle}>
                <ActivityIndicator color={colors.gold} />
              </View>
            ) : profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <User size={36} color={colors.gold} strokeWidth={1.5} />
              </View>
            )}
            <View style={styles.cameraBtn}>
              <Camera size={14} color={colors.background} strokeWidth={2} />
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{profile?.full_name ?? '—'}</Text>
        </View>

        {/* Info Cards */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoValue}>{profile?.whatsapp_number ?? '—'}</Text>
              <View style={styles.infoLabelRow}>
                <Phone size={14} color={colors.gold} strokeWidth={1.5} />
                <Text style={styles.infoLabel}>واتساب</Text>
              </View>
            </View>
            <View style={[styles.infoRow, styles.infoRowBorderless]}>
              <Text style={styles.infoValue}>{email}</Text>
              <View style={styles.infoLabelRow}>
                <Mail size={14} color={colors.gold} strokeWidth={1.5} />
                <Text style={styles.infoLabel}>البريد الإلكتروني</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Upcoming Bookings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>المواعيد القادمة</Text>
          {upcoming.length === 0 ? (
            <View style={styles.emptyCard}>
              <CalendarDays size={28} color={colors.muted} strokeWidth={1} />
              <Text style={styles.emptyText}>لا يوجد مواعيد قادمة</Text>
            </View>
          ) : (
            upcoming.map((b) => <BookingCard key={b.id} booking={b} />)
          )}
        </View>

        {/* Past Bookings */}
        {past.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>السجل</Text>
            {past.map((b) => <BookingCard key={b.id} booking={b} past />)}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

function BookingCard({ booking, past = false }: { booking: Booking; past?: boolean }) {
  const isCancelled = booking.status === 'cancelled';
  return (
    <View style={[styles.bookingCard, past && styles.bookingCardPast]}>
      <View style={styles.bookingCardLeft}>
        <View style={[styles.bookingIconWrap, isCancelled && styles.bookingIconWrapCancelled]}>
          <CalendarDays
            size={18}
            color={isCancelled ? colors.error : colors.gold}
            strokeWidth={1.5}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookingServiceName}>
            {booking.services?.name ?? 'خدمة'}
          </Text>
          <View style={styles.bookingTimeRow}>
            <Clock size={11} color={colors.muted} strokeWidth={1.5} />
            <Text style={styles.bookingTime}>
              {formatDate(new Date(booking.start_time))} • {formatTime(new Date(booking.start_time))}
            </Text>
          </View>
          {booking.services?.price_ils && (
            <Text style={styles.bookingPrice}>{booking.services.price_ils} ₪</Text>
          )}
        </View>
      </View>
      <View style={[styles.statusBadge, isCancelled && styles.statusBadgeCancelled]}>
        <Text style={[styles.statusText, isCancelled && styles.statusTextCancelled]}>
          {isCancelled ? 'ملغي' : 'مؤكد'}
        </Text>
      </View>
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
    paddingTop: 60,
    paddingBottom: 10,
  },
  headerTitle: { color: colors.white, fontSize: 22, fontWeight: '700' },
  signOutBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E0525211', justifyContent: 'center', alignItems: 'center',
  },
  avatarSection: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  avatarWrap: { position: 'relative' },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.goldTransparent,
    borderWidth: 2, borderColor: colors.goldLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImage: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2, borderColor: colors.goldLight,
  },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.gold,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  profileName: { color: colors.white, fontSize: 20, fontWeight: '700' },
  infoSection: { paddingHorizontal: 20, marginBottom: 24 },
  infoCard: {
    backgroundColor: colors.card, borderWidth: 1,
    borderColor: colors.border, borderRadius: 18, overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoRowBorderless: { borderBottomWidth: 0 },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: { color: colors.muted, fontSize: 13 },
  infoValue: { color: colors.white, fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'left', marginRight: 12 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { color: colors.white, fontSize: 16, fontWeight: '700', textAlign: 'right', marginBottom: 12 },
  emptyCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 24, alignItems: 'center', gap: 10,
  },
  emptyText: { color: colors.muted, fontSize: 13 },
  bookingCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.goldLight,
    borderRadius: 16, padding: 14, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  bookingCardPast: { borderColor: colors.border, opacity: 0.7 },
  bookingCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  bookingIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.goldFaint, justifyContent: 'center', alignItems: 'center',
  },
  bookingIconWrapCancelled: { backgroundColor: '#E0525211' },
  bookingServiceName: { color: colors.white, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  bookingTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  bookingTime: { color: colors.muted, fontSize: 11 },
  bookingPrice: { color: colors.gold, fontSize: 12, fontWeight: '700', marginTop: 2, textAlign: 'right' },
  statusBadge: { backgroundColor: colors.goldTransparent, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  statusBadgeCancelled: { backgroundColor: '#E0525211' },
  statusText: { color: colors.gold, fontSize: 11, fontWeight: '700' },
  statusTextCancelled: { color: colors.error },
});
