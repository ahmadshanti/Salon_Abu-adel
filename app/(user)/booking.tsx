import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, KeyboardAvoidingView,
  Platform, Dimensions,
} from 'react-native';
import {
  CheckCircle, ChevronLeft, CalendarDays,
  Clock, Scissors, Crown, ArrowLeft,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import {
  getNext14Days, getDayOfWeek, getAvailableSlots,
  formatDate, formatTime,
  type WorkingHours, type BookingSlot, type BlockedSlot,
} from '../../lib/utils/time';
import { sendPushNotification } from '../../lib/utils/notifications';

const { width } = Dimensions.get('window');
const GOLD      = '#D4AF37';
const BG        = '#0B0B0F';
const CARD      = 'rgba(255,255,255,0.05)';
const BORDER    = 'rgba(255,255,255,0.08)';
const GOLD_BG   = 'rgba(212,175,55,0.10)';
const GOLD_BD   = 'rgba(212,175,55,0.28)';
const WHITE     = '#FFFFFF';
const MUTED     = 'rgba(255,255,255,0.42)';

interface Service { id: string; name: string; price_ils: number; duration_minutes: number; }
type Step = 1 | 2 | 3 | 4;
type Mode = 'choose' | 'regular' | 'groom';

export default function Booking() {
  /* ─ groom ─ */
  const [mode,         setMode]         = useState<Mode>('choose');
  const [groomTime,    setGroomTime]    = useState('');
  const [groomNotes,   setGroomNotes]   = useState('');
  const [groomBusy,    setGroomBusy]    = useState(false);
  const [groomDone,    setGroomDone]    = useState(false);
  /* ─ regular ─ */
  const [step,         setStep]         = useState<Step>(1);
  const [services,     setServices]     = useState<Service[]>([]);
  const [service,      setService]      = useState<Service | null>(null);
  const [lastId,       setLastId]       = useState<string | null>(null);
  const [dates,        setDates]        = useState<Date[]>([]);
  const [date,         setDate]         = useState<Date | null>(null);
  const [wh,           setWh]           = useState<WorkingHours[]>([]);
  const [slots,        setSlots]        = useState<Date[]>([]);
  const [slot,         setSlot]         = useState<Date | null>(null);
  const [notes,        setNotes]        = useState('');
  const [busy,         setBusy]         = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [success,      setSuccess]      = useState(false);

  useEffect(() => { boot(); }, []);

  async function boot() {
    const [svcRes, whRes] = await Promise.all([
      supabase.from('services').select('*').eq('is_active', true).order('name'),
      supabase.from('working_hours').select('*'),
    ]);
    setServices(svcRes.data ?? []);
    const hours: WorkingHours[] = whRes.data ?? [];
    setWh(hours);
    const closed = new Set(hours.filter((h) => h.is_closed).map((h) => h.day_of_week));
    setDates(getNext14Days().filter((d) => !closed.has(getDayOfWeek(d))));
    setLastId(await AsyncStorage.getItem('lastServiceId'));
    setLoading(false);
  }

  async function fetchSlots(d: Date, svc: Service) {
    setSlotsLoading(true);
    setSlots([]);
    setSlot(null);
    const s0 = new Date(d); s0.setHours(0, 0, 0, 0);
    const s1 = new Date(d); s1.setHours(23, 59, 59, 999);
    const [bkRes, blRes] = await Promise.all([
      supabase.from('bookings').select('start_time, end_time').eq('status', 'confirmed')
        .gte('start_time', s0.toISOString()).lte('start_time', s1.toISOString()),
      supabase.from('blocked_slots').select('start_time, end_time')
        .gte('start_time', s0.toISOString()).lte('start_time', s1.toISOString()),
    ]);
    setSlots(getAvailableSlots(d, svc.duration_minutes,
      (bkRes.data ?? []) as BookingSlot[],
      (blRes.data ?? []) as BlockedSlot[], wh));
    setSlotsLoading(false);
  }

  function pickService(svc: Service) {
    setService(svc); setLastId(svc.id);
    AsyncStorage.setItem('lastServiceId', svc.id);
    setStep(2);
  }
  function pickDate(d: Date) { setDate(d); if (service) fetchSlots(d, service); setStep(3); }
  function pickSlot(s: Date) { setSlot(s); setStep(4); }

  async function confirm() {
    if (!service || !slot) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const end = new Date(slot.getTime() + service.duration_minutes * 60000);
    const { error } = await supabase.from('bookings').insert({
      user_id: user.id, service_id: service.id,
      start_time: slot.toISOString(), end_time: end.toISOString(),
      status: 'confirmed', notes: notes.trim() || null,
    });
    if (error) { Alert.alert('خطأ', 'حدث خطأ، حاول مجدداً'); setBusy(false); return; }
    const { data: admins } = await supabase.from('users').select('expo_push_token')
      .eq('role', 'admin').not('expo_push_token', 'is', null);
    admins?.forEach((a) => {
      if (a.expo_push_token)
        sendPushNotification(a.expo_push_token, 'حجز جديد',
          `${service.name} — ${formatDate(slot)} ${formatTime(slot)}`);
    });
    setBusy(false); setSuccess(true);
  }

  async function submitGroom() {
    if (!groomTime.trim()) return;
    setGroomBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setGroomBusy(false); return; }
    await supabase.from('groom_requests').insert({
      user_id: user.id, preferred_time_text: groomTime.trim(),
      notes: groomNotes.trim() || null, status: 'pending',
    });
    setGroomBusy(false); setGroomDone(true);
  }

  function goBack() {
    if (step === 1) setMode('choose');
    else if (step === 2) setStep(1);
    else if (step === 3) { setStep(2); setSlot(null); }
    else setStep(3);
  }

  function reset() {
    setStep(1); setService(null); setDate(null); setSlot(null); setNotes('');
    setSuccess(false); setMode('choose'); setGroomTime(''); setGroomNotes(''); setGroomDone(false);
  }

  /* ─── loading ─── */
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={GOLD} /></View>;

  /* ─── success ─── */
  if (success) return (
    <View style={s.center}>
      <View style={s.ring}><CheckCircle size={48} color={GOLD} strokeWidth={1.5} /></View>
      <Text style={s.doneTitle}>تم الحجز بنجاح!</Text>
      <Text style={s.doneSub}>{service?.name}{'\n'}{date && formatDate(date)} • {slot && formatTime(slot)}</Text>
      <TouchableOpacity style={s.goldBtn} onPress={reset}><Text style={s.goldBtnTxt}>حجز جديد</Text></TouchableOpacity>
    </View>
  );

  /* ─── mode chooser ─── */
  if (mode === 'choose') return (
    <View style={s.screen}>
      <View style={s.topPad} />
      <Text style={s.pageTitle}>احجز موعد</Text>
      <Text style={s.pageSub}>اختر نوع الخدمة التي تريدها</Text>
      <View style={s.modeList}>
        <TouchableOpacity style={s.modeCard} onPress={() => setMode('regular')} activeOpacity={0.8}>
          <View style={s.modeRow}>
            <View style={s.modeIcon}><Scissors size={28} color={GOLD} strokeWidth={1.5} /></View>
            <View style={s.modeText}>
              <Text style={s.modeTitle}>حجز موعد عادي</Text>
              <Text style={s.modeSub}>اختر الخدمة والتاريخ والوقت</Text>
            </View>
            <View style={s.modeArrow}><ChevronLeft size={18} color={GOLD} strokeWidth={2} /></View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[s.modeCard, s.modeCardGold]} onPress={() => setMode('groom')} activeOpacity={0.8}>
          <View style={s.modeRow}>
            <View style={[s.modeIcon, { backgroundColor: 'rgba(212,175,55,0.2)' }]}>
              <Crown size={28} color={GOLD} strokeWidth={1.5} />
            </View>
            <View style={s.modeText}>
              <Text style={s.modeTitle}>طلب عريس خاص</Text>
              <Text style={s.modeSub}>خدمة مميزة ومخصصة للعرسان</Text>
            </View>
            <View style={s.modeArrow}><ChevronLeft size={18} color={GOLD} strokeWidth={2} /></View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  /* ─── groom form ─── */
  if (mode === 'groom') {
    if (groomDone) return (
      <View style={s.center}>
        <View style={s.ring}><Crown size={44} color={GOLD} strokeWidth={1.5} /></View>
        <Text style={s.doneTitle}>تم الإرسال!</Text>
        <Text style={s.doneSub}>سيتم التواصل معك لتأكيد الموعد</Text>
        <TouchableOpacity style={s.goldBtn} onPress={reset}><Text style={s.goldBtnTxt}>العودة</Text></TouchableOpacity>
      </View>
    );
    return (
      <View style={s.screen}>
        <View style={s.stepHeader}>
          <TouchableOpacity style={s.backBtn} onPress={() => setMode('choose')}>
            <ArrowLeft size={20} color={GOLD} strokeWidth={2} />
          </TouchableOpacity>
          <View>
            <Text style={s.stepTitle}>طلب عريس</Text>
            <Text style={s.stepSub}>خدمة مخصصة للعرسان</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.label}>الوقت المفضل</Text>
          <TextInput style={s.input} placeholder="مثال: الجمعة صباحاً..."
            placeholderTextColor={MUTED} value={groomTime} onChangeText={setGroomTime} textAlign="right" multiline />
          <Text style={s.label}>ملاحظات (اختياري)</Text>
          <TextInput style={[s.input, { minHeight: 90 }]} placeholder="أي تفاصيل أو طلبات..."
            placeholderTextColor={MUTED} value={groomNotes} onChangeText={setGroomNotes}
            textAlign="right" multiline numberOfLines={3} />
          <TouchableOpacity style={[s.goldBtn, (!groomTime.trim() || groomBusy) && s.goldBtnOff]}
            onPress={submitGroom} disabled={!groomTime.trim() || groomBusy}>
            {groomBusy ? <ActivityIndicator color={BG} /> : <Text style={s.goldBtnTxt}>إرسال الطلب</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  /* ─── regular booking ─── */
  const stepTitles  = ['اختر الخدمة', 'اختر التاريخ', 'اختر الوقت', 'تأكيد الحجز'];

  return (
    <KeyboardAvoidingView style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>

      {/* Step header */}
      <View style={s.stepHeader}>
        <TouchableOpacity style={s.backBtn} onPress={goBack}>
          <ArrowLeft size={20} color={GOLD} strokeWidth={2} />
        </TouchableOpacity>
        <View>
          <Text style={s.stepTitle}>{stepTitles[step - 1]}</Text>
          <Text style={s.stepSub}>الخطوة {step} من 4</Text>
        </View>
      </View>

      {/* Progress dots */}
      <View style={s.dotsRow}>
        {[1, 2, 3, 4].map((n) => (
          <View key={n} style={[s.dotSeg, step >= n && s.dotSegOn]} />
        ))}
      </View>

      {/* ── Step 1: Service ── */}
      {step === 1 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {services.map((sv) => {
            const isLast = lastId === sv.id;
            return (
              <TouchableOpacity key={sv.id} style={[s.svcCard, isLast && s.svcCardLast]}
                onPress={() => pickService(sv)} activeOpacity={0.75}>
                <View style={s.svcIcon}>
                  <Scissors size={22} color={GOLD} strokeWidth={1.5} />
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={s.svcName}>{sv.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                    {isLast && <View style={s.lastTag}><Text style={s.lastTagTxt}>آخر اختيار</Text></View>}
                    <Clock size={11} color={MUTED} strokeWidth={1.5} />
                    <Text style={s.svcDur}>{sv.duration_minutes} دقيقة</Text>
                  </View>
                </View>
                <Text style={s.svcPrice}>{sv.price_ils} ₪</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Step 2: Date ── */}
      {step === 2 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.chip}>
            <Scissors size={13} color={GOLD} strokeWidth={1.5} />
            <Text style={s.chipTxt}>{service?.name} • {service?.price_ils} ₪</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.datesRow}>
            {dates.map((d, i) => {
              const on = date?.toDateString() === d.toDateString();
              return (
                <TouchableOpacity key={i} style={[s.dateCard, on && s.dateCardOn]} onPress={() => pickDate(d)} activeOpacity={0.7}>
                  <Text style={[s.dateWeekday, on && s.dateOn]}>
                    {d.toLocaleDateString('ar-PS', { weekday: 'short', timeZone: 'Asia/Hebron' })}
                  </Text>
                  <Text style={[s.dateNum, on && s.dateOn]}>{d.getDate()}</Text>
                  <Text style={[s.dateMon, on && s.dateOn]}>
                    {d.toLocaleDateString('ar-PS', { month: 'short', timeZone: 'Asia/Hebron' })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </ScrollView>
      )}

      {/* ── Step 3: Time ── */}
      {step === 3 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.chip}>
            <CalendarDays size={13} color={GOLD} strokeWidth={1.5} />
            <Text style={s.chipTxt}>{date && formatDate(date)}</Text>
          </View>
          {slotsLoading ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator color={GOLD} size="large" />
            </View>
          ) : slots.length === 0 ? (
            <View style={s.emptySlots}>
              <Clock size={34} color={MUTED} strokeWidth={1} />
              <Text style={s.emptySlotsMsg}>لا توجد أوقات متاحة</Text>
            </View>
          ) : (
            <View style={s.slotsGrid}>
              {slots.map((sl, i) => (
                <TouchableOpacity key={i} style={s.slotCard} onPress={() => pickSlot(sl)} activeOpacity={0.7}>
                  <Clock size={13} color={GOLD} strokeWidth={1.5} />
                  <Text style={s.slotTime}>{formatTime(sl)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Step 4: Confirm ── */}
      {step === 4 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.summaryCard}>
            <View style={s.summaryTitleRow}>
              <CalendarDays size={16} color={GOLD} strokeWidth={1.5} />
              <Text style={s.summaryTitle}>ملخص الحجز</Text>
            </View>
            {[
              { k: 'الخدمة',  v: service?.name },
              { k: 'التاريخ', v: date && formatDate(date) },
              { k: 'الوقت',   v: slot && formatTime(slot) },
            ].map(({ k, v }) => (
              <View key={k} style={s.summaryRow}>
                <Text style={s.summaryVal}>{v}</Text>
                <Text style={s.summaryKey}>{k}</Text>
              </View>
            ))}
            <View style={[s.summaryRow, { borderBottomWidth: 0, marginTop: 4 }]}>
              <Text style={s.summaryPrice}>{service?.price_ils} ₪</Text>
              <Text style={s.summaryKey}>السعر</Text>
            </View>
          </View>

          <Text style={s.label}>ملاحظات (اختياري)</Text>
          <TextInput style={s.input} placeholder="أي طلبات خاصة..."
            placeholderTextColor={MUTED} value={notes} onChangeText={setNotes}
            multiline numberOfLines={3} textAlign="right" />

          <TouchableOpacity style={[s.goldBtn, busy && s.goldBtnOff]} onPress={confirm} disabled={busy}>
            {busy ? <ActivityIndicator color={BG} /> : <Text style={s.goldBtnTxt}>تأكيد الحجز</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

/* ─────────────── styles ─────────────── */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 18 },
  scroll: { padding: 20, paddingBottom: 48 },
  topPad: { height: Platform.OS === 'ios' ? 62 : 38 },

  /* Page title (mode chooser) */
  pageTitle: { color: WHITE, fontSize: 26, fontWeight: '800', textAlign: 'right', paddingHorizontal: 20, marginBottom: 4 },
  pageSub:   { color: MUTED, fontSize: 14, textAlign: 'right', paddingHorizontal: 20, marginBottom: 28 },
  modeList:  { paddingHorizontal: 20, gap: 14 },
  modeCard: {
    backgroundColor: CARD, borderRadius: 22,
    borderWidth: 1, borderColor: BORDER, padding: 20,
  },
  modeCardGold: { borderColor: GOLD_BD, backgroundColor: GOLD_BG },
  modeRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  modeIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: GOLD_BG, justifyContent: 'center', alignItems: 'center' },
  modeText: { flex: 1, alignItems: 'flex-end', gap: 4 },
  modeTitle: { color: WHITE, fontSize: 16, fontWeight: '700' },
  modeSub:   { color: MUTED, fontSize: 12 },
  modeArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: GOLD_BG, justifyContent: 'center', alignItems: 'center' },

  /* Step header */
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: Platform.OS === 'ios' ? 58 : 36,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, justifyContent: 'center', alignItems: 'center' },
  stepTitle: { color: WHITE, fontSize: 20, fontWeight: '800', textAlign: 'right' },
  stepSub:   { color: MUTED, fontSize: 12, textAlign: 'right', marginTop: 2 },

  /* Progress dots */
  dotsRow:   { flexDirection: 'row', paddingHorizontal: 20, gap: 6, marginBottom: 4 },
  dotSeg:    { flex: 1, height: 3, borderRadius: 2, backgroundColor: BORDER },
  dotSegOn:  { backgroundColor: GOLD },

  /* Chip (selected summary) */
  chip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, backgroundColor: GOLD_BG, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: GOLD_BD, marginBottom: 20 },
  chipTxt: { color: GOLD, fontSize: 13, fontWeight: '600' },

  /* Service cards */
  svcCard: {
    backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10,
  },
  svcCardLast: { borderColor: GOLD_BD, backgroundColor: GOLD_BG },
  svcIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: GOLD_BG, borderWidth: 1, borderColor: GOLD_BD, justifyContent: 'center', alignItems: 'center' },
  svcName:  { color: WHITE, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  svcDur:   { color: MUTED, fontSize: 11 },
  svcPrice: { color: GOLD, fontSize: 17, fontWeight: '800' },
  lastTag:  { backgroundColor: GOLD_BG, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7, borderWidth: 1, borderColor: GOLD_BD },
  lastTagTxt: { color: GOLD, fontSize: 9, fontWeight: '700' },

  /* Dates */
  datesRow: { gap: 10, paddingBottom: 2 },
  dateCard: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 14, alignItems: 'center', minWidth: 68, gap: 3 },
  dateCardOn: { backgroundColor: GOLD_BG, borderColor: GOLD },
  dateWeekday: { color: MUTED, fontSize: 11 },
  dateNum:     { color: WHITE, fontSize: 22, fontWeight: '800' },
  dateMon:     { color: MUTED, fontSize: 10 },
  dateOn:      { color: GOLD },

  /* Slots */
  slotsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotCard:     { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: CARD, borderWidth: 1, borderColor: GOLD_BD, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18 },
  slotTime:     { color: WHITE, fontSize: 14, fontWeight: '700' },
  emptySlots:   { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptySlotsMsg:{ color: MUTED, fontSize: 14 },

  /* Summary */
  summaryCard: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: GOLD_BD, padding: 20, marginBottom: 20, gap: 12 },
  summaryTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 4 },
  summaryTitle: { color: GOLD, fontSize: 14, fontWeight: '700' },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  summaryKey:   { color: MUTED, fontSize: 13 },
  summaryVal:   { color: WHITE, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 8 },
  summaryPrice: { color: GOLD, fontSize: 20, fontWeight: '800' },

  /* Inputs */
  label: { color: WHITE, fontSize: 14, fontWeight: '600', textAlign: 'right', marginBottom: 10 },
  input: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 14, color: WHITE, fontSize: 14, minHeight: 54, textAlignVertical: 'top', marginBottom: 16 },

  /* Buttons */
  goldBtn:    { backgroundColor: GOLD, borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  goldBtnOff: { opacity: 0.5 },
  goldBtnTxt: { color: BG, fontSize: 16, fontWeight: '800' },

  /* Success */
  ring:      { width: 96, height: 96, borderRadius: 48, backgroundColor: GOLD_BG, borderWidth: 1.5, borderColor: GOLD_BD, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  doneTitle: { color: WHITE, fontSize: 24, fontWeight: '800' },
  doneSub:   { color: MUTED, fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
