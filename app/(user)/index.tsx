import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Scissors, Sparkles, CalendarDays, ChevronRight, Clock, User } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';
import { formatDate, formatTime } from '../../lib/utils/time';

const { width } = Dimensions.get('window');

interface Service {
  id: string;
  name: string;
  price_ils: number;
  duration_minutes: number;
}

interface Booking {
  id: string;
  start_time: string;
  services: { name: string } | null;
  status: string;
}

interface UserProfile {
  full_name: string;
}

export default function Home() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [nextBooking, setNextBooking] = useState<Booking | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, servicesRes, bookingRes] = await Promise.all([
      supabase.from('users').select('full_name').eq('id', user.id).single(),
      supabase.from('services').select('*').eq('is_active', true).limit(5),
      supabase
        .from('bookings')
        .select('id, start_time, status, services(name)')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(1)
        .single(),
    ]);

    setProfile(profileRes.data);
    setServices(servicesRes.data ?? []);
    setNextBooking(bookingRes.data ?? null);
    setLoading(false);
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? '';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>مرحباً،</Text>
            <Text style={styles.name}>{firstName || 'صالون أبو عادل'}</Text>
          </View>
          <TouchableOpacity style={styles.avatarBtn} onPress={() => router.push('/(user)/profile')}>
            <User size={18} color={colors.gold} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroDeco1} />
          <View style={styles.heroDeco2} />
          <Text style={styles.heroLabel}>خدمة فاخرة</Text>
          <Text style={styles.heroTitle}>احجز موعدك الآن</Text>
          <Text style={styles.heroSub}>خدمة فاخرة بأفضل الأسعار</Text>
          <TouchableOpacity
            style={styles.heroBtn}
            onPress={() => router.push('/(user)/booking')}
          >
            <Text style={styles.heroBtnText}>احجز الآن</Text>
            <ChevronRight size={14} color={colors.background} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Services */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>خدماتنا</Text>
            <TouchableOpacity onPress={() => router.push('/(user)/booking')}>
              <Text style={styles.seeAll}>عرض الكل</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 10 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.serviceCard}
                  onPress={() => router.push('/(user)/booking')}
                >
                  <View style={styles.serviceIconWrap}>
                    <Scissors size={20} color={colors.gold} strokeWidth={1.5} />
                  </View>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  <Text style={styles.servicePrice}>{service.price_ils} ₪</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Next Booking */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>موعدك القادم</Text>
          {nextBooking ? (
            <View style={styles.bookingCard}>
              <View style={styles.bookingLeft}>
                <View style={styles.bookingIconWrap}>
                  <CalendarDays size={20} color={colors.gold} strokeWidth={1.5} />
                </View>
                <View>
                  <Text style={styles.bookingTitle}>
                    {nextBooking.services?.name ?? 'موعد'}
                  </Text>
                  <View style={styles.bookingTimeRow}>
                    <Clock size={12} color={colors.muted} strokeWidth={1.5} />
                    <Text style={styles.bookingTime}>
                      {formatDate(new Date(nextBooking.start_time))} • {formatTime(new Date(nextBooking.start_time))}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.bookingBadge}>
                <Text style={styles.bookingBadgeText}>مؤكد</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.emptyBooking}
              onPress={() => router.push('/(user)/booking')}
            >
              <CalendarDays size={24} color={colors.muted} strokeWidth={1.5} />
              <Text style={styles.emptyText}>لا يوجد موعد قادم</Text>
              <Text style={styles.emptyAction}>احجز الآن</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Perfumes Banner */}
        <TouchableOpacity
          style={styles.perfumeBanner}
          onPress={() => router.push('/(user)/perfumes')}
        >
          <View>
            <Text style={styles.perfumeLabel}>متجر العطور</Text>
            <Text style={styles.perfumeTitle}>اكتشف عطورنا الفاخرة</Text>
          </View>
          <View style={styles.perfumeBtnWrap}>
            <Sparkles size={18} color={colors.gold} strokeWidth={1.5} />
          </View>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  greeting: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: 2,
    textAlign: 'right',
  },
  name: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'right',
  },
  avatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.goldTransparent,
    borderWidth: 1,
    borderColor: colors.goldLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    margin: 20,
    backgroundColor: colors.heroCard,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.goldLight,
    overflow: 'hidden',
  },
  heroDeco1: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 120,
    height: 120,
    backgroundColor: colors.goldFaint,
    borderRadius: 60,
  },
  heroDeco2: {
    position: 'absolute',
    right: 30,
    top: 20,
    width: 60,
    height: 60,
    backgroundColor: '#C9A84C0A',
    borderRadius: 30,
  },
  heroLabel: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 8,
    fontWeight: '600',
    textAlign: 'right',
  },
  heroTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'right',
  },
  heroSub: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: 20,
    textAlign: 'right',
  },
  heroBtn: {
    backgroundColor: colors.gold,
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'right',
  },
  seeAll: {
    color: colors.gold,
    fontSize: 13,
  },
  serviceCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    width: 110,
  },
  serviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.goldFaint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceName: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  servicePrice: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  bookingCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.goldLight,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.goldFaint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'right',
  },
  bookingTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookingTime: {
    color: colors.muted,
    fontSize: 11,
  },
  bookingBadge: {
    backgroundColor: colors.goldTransparent,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  bookingBadgeText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyBooking: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
  },
  emptyAction: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '600',
  },
  perfumeBanner: {
    marginHorizontal: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  perfumeLabel: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 4,
    fontWeight: '600',
    textAlign: 'right',
  },
  perfumeTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  perfumeBtnWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.goldFaint,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
