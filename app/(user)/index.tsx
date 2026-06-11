import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Image,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Scissors, Sparkles, CalendarDays, ChevronLeft, Clock, User } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { formatDate, formatTime } from '../../lib/utils/time';
import type { Service as ServiceRow, Perfume as PerfumeRow, GalleryImage } from '../../lib/types';

const { width } = Dimensions.get('window');

const GOLD       = '#D4AF37';
const BG         = '#0B0B0F';
const CARD       = 'rgba(255,255,255,0.05)';
const BORDER     = 'rgba(255,255,255,0.08)';
const GOLD_BG    = 'rgba(212,175,55,0.10)';
const GOLD_BORD  = 'rgba(212,175,55,0.25)';
const WHITE      = '#FFFFFF';
const MUTED      = 'rgba(255,255,255,0.42)';
const HERO_H     = 300;   // pure image height below navbar

type Service = Pick<ServiceRow, 'id' | 'name' | 'price_ils' | 'duration_minutes'>;
type Perfume = Pick<PerfumeRow, 'id' | 'name' | 'price_ils' | 'image_url'>;
interface Booking { id: string; start_time: string; services: { name: string } | null; status: string; }

export default function Home() {
  const router = useRouter();
  const [services,    setServices]    = useState<Service[]>([]);
  const [nextBooking, setNextBooking] = useState<Booking | null>(null);
  const [gallery,     setGallery]     = useState<GalleryImage[]>([]);
  const [perfumes,    setPerfumes]    = useState<Perfume[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [idx,         setIdx]         = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    if (gallery.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIdx((p) => {
        const n = (p + 1) % gallery.length;
        scrollRef.current?.scrollTo({ x: n * width, animated: true });
        return n;
      });
    }, 4500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gallery.length]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [svcRes, bkRes, galRes, perfRes] = await Promise.all([
      supabase.from('services').select('*').eq('is_active', true).limit(6),
      supabase.from('bookings')
        .select('id, start_time, status, services(name)')
        .eq('user_id', user.id)
        .in('status', ['confirmed', 'pending'])
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(1).single(),
      supabase.from('gallery')
        .select('id, image_url, display_order')
        .order('display_order', { ascending: true }).limit(10),
      supabase.from('perfumes')
        .select('id, name, price_ils, image_url')
        .eq('is_active', true).limit(6),
    ]);
    setServices(svcRes.data ?? []);
    setNextBooking((bkRes.data ?? null) as unknown as Booking | null);
    setGallery(galRes.data ?? []);
    setPerfumes(perfRes.data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  return (
    <View style={s.screen}>

      {/* ═══════════════════════════
          FIXED TOP NAVBAR — in normal flow, images start below it
      ═══════════════════════════ */}
      <View style={s.navbar}>
        <TouchableOpacity style={s.profileBtn} onPress={() => router.push('/(user)/profile')}>
          <User size={16} color={GOLD} strokeWidth={1.5} />
        </TouchableOpacity>
        <View style={s.navTitleRow}>
          <View style={s.navDot} />
          <Text style={s.navTitle}>صالون أبو عادل</Text>
        </View>
      </View>

      {/* ═══════════════════════════
          SCROLL CONTENT — starts right below navbar
      ═══════════════════════════ */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GOLD} />
        }
      >

        {/* ── Carousel (starts at top, image goes behind navbar) ── */}
        <View style={s.carouselWrap}>
          {gallery.length > 0 ? (
            <ScrollView
              ref={scrollRef}
              horizontal pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
              scrollEventThrottle={16}
              style={{ height: HERO_H }}
            >
              {gallery.map((img) => (
                <Image
                  key={img.id}
                  source={{ uri: img.image_url }}
                  style={{ width, height: HERO_H }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={[{ width, height: HERO_H }, s.heroPlaceholder]} />
          )}

          {/* Dots — bottom of carousel */}
          {gallery.length > 1 && (
            <View style={s.dotsRow}>
              {gallery.map((_, i) => (
                <View key={i} style={[s.dot, i === idx && s.dotOn]} />
              ))}
            </View>
          )}

          {/* Book CTA — bottom-left of carousel */}
          <TouchableOpacity
            style={s.heroCtaBtn}
            onPress={() => router.push('/(user)/booking')}
          >
            <Text style={s.heroCtaText}>احجز الآن</Text>
            <ChevronLeft size={14} color={BG} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* ── Next Booking ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>موعدك القادم</Text>
          {loading ? (
            <ActivityIndicator color={GOLD} style={{ marginTop: 12 }} />
          ) : nextBooking ? (
            <View style={s.bookingCard}>
              <View style={s.bookRow}>
                <View style={s.bookIcon}>
                  <CalendarDays size={20} color={GOLD} strokeWidth={1.5} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.bookName}>{nextBooking.services?.name ?? 'موعد'}</Text>
                  <View style={s.timeRow}>
                    <Clock size={11} color={MUTED} strokeWidth={1.5} />
                    <Text style={s.timeText}>
                      {formatDate(new Date(nextBooking.start_time))} • {formatTime(new Date(nextBooking.start_time))}
                    </Text>
                  </View>
                </View>
                <View style={[s.badge, nextBooking.status === 'pending' ? s.badgePend : s.badgeConf]}>
                  <Text style={s.badgeTxt}>{nextBooking.status === 'pending' ? 'معلق' : 'مؤكد'}</Text>
                </View>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={s.emptyCard} onPress={() => router.push('/(user)/booking')}>
              <View style={s.emptyIcon}>
                <CalendarDays size={24} color={GOLD} strokeWidth={1} />
              </View>
              <Text style={s.emptyMsg}>لا يوجد موعد قادم</Text>
              <Text style={s.emptyLink}>احجز الآن ←</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Services ── */}
        <View style={s.section}>
          <View style={s.rowBetween}>
            <TouchableOpacity onPress={() => router.push('/(user)/booking')}>
              <Text style={s.seeAll}>عرض الكل</Text>
            </TouchableOpacity>
            <Text style={s.sectionTitle}>خدماتنا</Text>
          </View>
          {loading ? (
            <ActivityIndicator color={GOLD} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 2 }}>
              {services.map((sv) => (
                <TouchableOpacity key={sv.id} style={s.svcCard} onPress={() => router.push('/(user)/booking')}>
                  <View style={s.svcIcon}>
                    <Scissors size={20} color={GOLD} strokeWidth={1.5} />
                  </View>
                  <Text style={s.svcName} numberOfLines={2}>{sv.name}</Text>
                  <Text style={s.svcPrice}>{sv.price_ils} ₪</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Clock size={10} color={MUTED} strokeWidth={1.5} />
                    <Text style={s.svcDur}>{sv.duration_minutes} د</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Perfumes Section ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>متجر العطور</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
            {perfumes.length === 0 ? (
              <View style={s.perfEmpty}>
                <Sparkles size={26} color={GOLD} strokeWidth={1.5} />
                <Text style={s.perfEmptyText}>لا توجد عطور حالياً</Text>
              </View>
            ) : perfumes.map((p) => (
              <TouchableOpacity key={p.id} style={s.perfCard} onPress={() => router.push('/(user)/perfumes')}>
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} style={s.perfCardImg} resizeMode="cover" />
                ) : (
                  <View style={s.perfCardPlaceholder}>
                    <Sparkles size={24} color={GOLD} strokeWidth={1.5} />
                  </View>
                )}
                <View style={s.perfCardBody}>
                  <Text style={s.perfCardName} numberOfLines={2}>{p.name}</Text>
                  <Text style={s.perfCardPrice}>{p.price_ils} ₪</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* CTA */}
          <TouchableOpacity style={s.exploreBtn} onPress={() => router.push('/(user)/perfumes')}>
            <Sparkles size={15} color={BG} strokeWidth={2} />
            <Text style={s.exploreBtnTxt}>استكشف باقي العطور</Text>
            <ChevronLeft size={13} color={BG} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scroll: { paddingBottom: 40 },

  /* ── Navbar — sits above carousel in normal flow ── */
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 32,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(212,175,55,0.18)',
  },
  navTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  navTitle: { color: WHITE, fontSize: 16, fontWeight: '700' },
  navDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GOLD_BG,
    borderWidth: 1,
    borderColor: GOLD_BORD,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Carousel ── */
  carouselWrap: { position: 'relative', width },
  heroPlaceholder: { backgroundColor: '#18181f' },
  dotsRow: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { width: 18, backgroundColor: GOLD },
  heroCtaBtn: {
    position: 'absolute',
    bottom: 14,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GOLD,
    borderRadius: 30,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  heroCtaText: { color: BG, fontSize: 13, fontWeight: '700' },

  /* ── Sections ── */
  section: { paddingHorizontal: 20, marginTop: 26 },
  sectionTitle: { color: WHITE, fontSize: 16, fontWeight: '700', textAlign: 'right', marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAll: { color: GOLD, fontSize: 13 },

  /* ── Booking card ── */
  bookingCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GOLD_BORD,
    padding: 16,
  },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bookIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: GOLD_BG,
    borderWidth: 1,
    borderColor: GOLD_BORD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookName:  { color: WHITE, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  timeRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  timeText:  { color: MUTED, fontSize: 11 },
  badge:     { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 11, borderWidth: 1 },
  badgeConf: { backgroundColor: GOLD_BG, borderColor: GOLD_BORD },
  badgePend: { backgroundColor: 'rgba(255,200,50,0.07)', borderColor: 'rgba(255,200,50,0.28)' },
  badgeTxt:  { color: GOLD, fontSize: 11, fontWeight: '700' },

  /* ── Empty booking ── */
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 26,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: GOLD_BG,
    borderWidth: 1,
    borderColor: GOLD_BORD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMsg:  { color: MUTED, fontSize: 13 },
  emptyLink: { color: GOLD, fontSize: 13, fontWeight: '700' },

  /* ── Service cards ── */
  svcCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    width: 118,
    gap: 7,
  },
  svcIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: GOLD_BG,
    borderWidth: 1,
    borderColor: GOLD_BORD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  svcName:  { color: WHITE, fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 15 },
  svcPrice: { color: GOLD, fontSize: 13, fontWeight: '800' },
  svcDur:   { color: MUTED, fontSize: 10 },

  /* ── Perfume cards ── */
  perfCard: {
    width: 136,
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  perfCardImg:         { width: 136, height: 120 },
  perfCardPlaceholder: { width: 136, height: 120, backgroundColor: GOLD_BG, justifyContent: 'center', alignItems: 'center' },
  perfCardBody:        { padding: 10, gap: 4 },
  perfCardName:        { color: WHITE, fontSize: 11.5, fontWeight: '600', textAlign: 'right', lineHeight: 16 },
  perfCardPrice:       { color: GOLD, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  perfEmpty:           { width: 180, backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 28, alignItems: 'center', gap: 10 },
  perfEmptyText:       { color: MUTED, fontSize: 13 },
  exploreBtn: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  exploreBtnTxt: { color: BG, fontSize: 14, fontWeight: '800' },
});
