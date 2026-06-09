import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { CheckCircle, ChevronRight, ChevronLeft, CalendarDays, Clock, Scissors, Crown } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/theme';
import {
  getNext14Days,
  getDayOfWeek,
  getAvailableSlots,
  formatDate,
  formatDateShort,
  formatTime,
  type WorkingHours,
  type BookingSlot,
  type BlockedSlot,
} from '../../lib/utils/time';
import { sendPushNotification } from '../../lib/utils/notifications';

interface Service {
  id: string;
  name: string;
  price_ils: number;
  duration_minutes: number;
}

type Step = 1 | 2 | 3 | 4;
type BookingMode = 'choose' | 'regular' | 'groom';

export default function Booking() {
  const [mode, setMode] = useState<BookingMode>('choose');
  const [groomTimeText, setGroomTimeText] = useState('');
  const [groomNotes, setGroomNotes] = useState('');
  const [submittingGroom, setSubmittingGroom] = useState(false);
  const [groomSuccess, setGroomSuccess] = useState(false);

  const [step, setStep] = useState<Step>(1);

  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const [dates, setDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [closedDays, setClosedDays] = useState<Set<number>>(new Set());

  const [timeSlots, setTimeSlots] = useState<Date[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [existingBookings, setExistingBookings] = useState<BookingSlot[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    const [servicesRes, whRes] = await Promise.all([
      supabase.from('services').select('*').eq('is_active', true).order('name'),
      supabase.from('working_hours').select('*'),
    ]);

    setServices(servicesRes.data ?? []);
    const wh: WorkingHours[] = whRes.data ?? [];
    setWorkingHours(wh);

    const closed = new Set(wh.filter((w) => w.is_closed).map((w) => w.day_of_week));
    setClosedDays(closed);

    const allDays = getNext14Days();
    const available = allDays.filter((d) => !closed.has(getDayOfWeek(d)));
    setDates(available);
    setLoading(false);
  }

  async function loadSlots(date: Date, service: Service) {
    setLoadingSlots(true);
    setTimeSlots([]);
    setSelectedSlot(null);

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const [bookingsRes, blockedRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('status', 'confirmed')
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString()),
      supabase
        .from('blocked_slots')
        .select('start_time, end_time')
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString()),
    ]);

    const bookings: BookingSlot[] = bookingsRes.data ?? [];
    const blocked: BlockedSlot[] = blockedRes.data ?? [];

    setExistingBookings(bookings);
    setBlockedSlots(blocked);

    const slots = getAvailableSlots(date, service.duration_minutes, bookings, blocked, workingHours);
    setTimeSlots(slots);
    setLoadingSlots(false);
  }

  function handleSelectService(service: Service) {
    setSelectedService(service);
    setStep(2);
  }

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    if (selectedService) {
      loadSlots(date, selectedService);
    }
    setStep(3);
  }

  function handleSelectSlot(slot: Date) {
    setSelectedSlot(slot);
    setStep(4);
  }

  async function handleConfirm() {
    if (!selectedService || !selectedSlot) return;

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const endTime = new Date(selectedSlot.getTime() + selectedService.duration_minutes * 60 * 1000);

    const { error } = await supabase.from('bookings').insert({
      user_id: user.id,
      service_id: selectedService.id,
      start_time: selectedSlot.toISOString(),
      end_time: endTime.toISOString(),
      status: 'confirmed',
      notes: notes.trim() || null,
    });

    if (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء الحجز، حاول مرة أخرى');
      setSubmitting(false);
      return;
    }

    // Send push notification to admin
    const { data: admins } = await supabase
      .from('users')
      .select('expo_push_token')
      .eq('role', 'admin')
      .not('expo_push_token', 'is', null);

    admins?.forEach((admin) => {
      if (admin.expo_push_token) {
        sendPushNotification(
          admin.expo_push_token,
          'حجز جديد',
          `${selectedService.name} — ${formatDate(selectedSlot)} ${formatTime(selectedSlot)}`,
        );
      }
    });

    setSubmitting(false);
    setSuccess(true);
  }

  async function submitGroomRequest() {
    if (!groomTimeText.trim()) return;
    setSubmittingGroom(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmittingGroom(false); return; }
    await supabase.from('groom_requests').insert({
      user_id: user.id,
      preferred_time_text: groomTimeText.trim(),
      notes: groomNotes.trim() || null,
      status: 'pending',
    });
    setSubmittingGroom(false);
    setGroomSuccess(true);
  }

  function goBack() {
    if (step === 1) setMode('choose');
    else if (step === 2) { setStep(1); setSelectedDate(null); setSelectedSlot(null); }
    else if (step === 3) { setStep(2); setSelectedSlot(null); }
    else if (step === 4) setStep(3);
  }

  function reset() {
    setStep(1);
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setNotes('');
    setSuccess(false);
    setMode('choose');
    setGroomTimeText('');
    setGroomNotes('');
    setGroomSuccess(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  // Mode chooser
  if (mode === 'choose') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>حجز موعد</Text>
        </View>
        <View style={styles.center}>
          <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 24, textAlign: 'center' }}>
            اختر نوع الحجز
          </Text>
          <TouchableOpacity style={styles.modeCard} onPress={() => setMode('regular')}>
            <View style={styles.modeIconWrap}>
              <Scissors size={28} color={colors.gold} strokeWidth={1.5} />
            </View>
            <Text style={styles.modeTitle}>حجز موعد عادي</Text>
            <Text style={styles.modeSub}>اختر الخدمة والوقت المناسب</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeCard, styles.modeCardGroom]} onPress={() => setMode('groom')}>
            <View style={[styles.modeIconWrap, styles.modeIconWrapGroom]}>
              <Crown size={28} color={colors.gold} strokeWidth={1.5} />
            </View>
            <Text style={styles.modeTitle}>طلب عريس خاص</Text>
            <Text style={styles.modeSub}>خدمة مخصصة للعرسان</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Groom request form
  if (mode === 'groom') {
    if (groomSuccess) {
      return (
        <View style={styles.center}>
          <View style={styles.successIconWrap}>
            <Crown size={40} color={colors.gold} strokeWidth={1.5} />
          </View>
          <Text style={styles.successTitle}>تم إرسال الطلب!</Text>
          <Text style={styles.successSub}>سيتم التواصل معك لتأكيد الموعد</Text>
          <TouchableOpacity style={styles.goldBtn} onPress={reset}>
            <Text style={styles.goldBtnText}>العودة</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('choose')}>
            <Text style={{ color: colors.gold, fontSize: 14 }}>رجوع</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>طلب عريس</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.stepSection}>
            <Text style={styles.stepLabel}>الوقت المفضّل</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="مثال: الجمعة صباحاً، أو 2024-06-21..."
              placeholderTextColor={colors.muted}
              value={groomTimeText}
              onChangeText={setGroomTimeText}
              textAlign="right"
              multiline
            />
          </View>
          <View style={styles.stepSection}>
            <Text style={styles.stepLabel}>ملاحظات إضافية (اختياري)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="أي تفاصيل أو طلبات خاصة..."
              placeholderTextColor={colors.muted}
              value={groomNotes}
              onChangeText={setGroomNotes}
              textAlign="right"
              multiline
              numberOfLines={3}
            />
          </View>
          <TouchableOpacity
            style={[styles.goldBtn, (!groomTimeText.trim() || submittingGroom) && styles.goldBtnDisabled]}
            onPress={submitGroomRequest}
            disabled={!groomTimeText.trim() || submittingGroom}
          >
            {submittingGroom ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.goldBtnText}>إرسال الطلب</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (success) {
    return (
      <View style={styles.center}>
        <View style={styles.successIconWrap}>
          <CheckCircle size={48} color={colors.gold} strokeWidth={1.5} />
        </View>
        <Text style={styles.successTitle}>تم الحجز بنجاح!</Text>
        <Text style={styles.successSub}>
          {selectedService?.name} — {selectedDate && formatDate(selectedDate)}
          {'\n'}
          {selectedSlot && formatTime(selectedSlot)}
        </Text>
        <TouchableOpacity style={styles.goldBtn} onPress={reset}>
          <Text style={styles.goldBtnText}>حجز جديد</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stepTitles = ['اختر الخدمة', 'اختر التاريخ', 'اختر الوقت', 'تأكيد الحجز'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <ChevronLeft size={22} color={colors.gold} strokeWidth={2} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{stepTitles[step - 1]}</Text>
          <View style={styles.stepsRow}>
            {([1, 2, 3, 4] as Step[]).map((s) => (
              <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]} />
            ))}
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Step 1: Select Service */}
      {step === 1 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {services.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceCard}
              onPress={() => handleSelectService(service)}
              activeOpacity={0.7}
            >
              <View style={styles.serviceIconWrap}>
                <Scissors size={24} color={colors.gold} strokeWidth={1.5} />
              </View>
              <View style={styles.serviceBody}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <View style={styles.serviceMeta}>
                  <Clock size={12} color={colors.muted} strokeWidth={1.5} />
                  <Text style={styles.serviceMetaText}>{service.duration_minutes} دقيقة</Text>
                </View>
              </View>
              <View style={styles.servicePriceWrap}>
                <Text style={styles.servicePrice}>{service.price_ils} ₪</Text>
                <ChevronRight size={16} color={colors.muted} strokeWidth={2} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Step 2: Select Date */}
      {step === 2 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.selectedSummary}>
            <Scissors size={15} color={colors.gold} strokeWidth={1.5} />
            <Text style={styles.selectedSummaryText}>{selectedService?.name} • {selectedService?.price_ils} ₪</Text>
          </View>
          <View style={styles.datesGrid}>
            {dates.map((date, i) => {
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                  onPress={() => handleSelectDate(date)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateDayName, isSelected && styles.dateTextActive]}>
                    {date.toLocaleDateString('ar-PS', { weekday: 'short', timeZone: 'Asia/Hebron' })}
                  </Text>
                  <Text style={[styles.dateNum, isSelected && styles.dateTextActive]}>
                    {date.getDate()}
                  </Text>
                  <Text style={[styles.dateMonth, isSelected && styles.dateTextActive]}>
                    {date.toLocaleDateString('ar-PS', { month: 'short', timeZone: 'Asia/Hebron' })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Step 3: Select Time */}
      {step === 3 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.selectedSummary}>
            <CalendarDays size={15} color={colors.gold} strokeWidth={1.5} />
            <Text style={styles.selectedSummaryText}>{selectedDate && formatDate(selectedDate)}</Text>
          </View>
          {loadingSlots ? (
            <View style={styles.centerPad}>
              <ActivityIndicator color={colors.gold} size="large" />
            </View>
          ) : timeSlots.length === 0 ? (
            <View style={styles.emptySlots}>
              <Clock size={36} color={colors.muted} strokeWidth={1} />
              <Text style={styles.emptySlotsText}>لا توجد مواعيد متاحة في هذا اليوم</Text>
            </View>
          ) : (
            <View style={styles.slotsGrid}>
              {timeSlots.map((slot, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.slotChip}
                  onPress={() => handleSelectSlot(slot)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.slotChipText}>{formatTime(slot)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>ملخص الحجز</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>{selectedService?.name}</Text>
              <Text style={styles.summaryKey}>الخدمة</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>{selectedDate && formatDate(selectedDate)}</Text>
              <Text style={styles.summaryKey}>التاريخ</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>{selectedSlot && formatTime(selectedSlot)}</Text>
              <Text style={styles.summaryKey}>الوقت</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryRowLast]}>
              <Text style={styles.summaryPrice}>{selectedService?.price_ils} ₪</Text>
              <Text style={styles.summaryKey}>السعر</Text>
            </View>
          </View>

          <Text style={[styles.stepLabel, { marginBottom: 8 }]}>ملاحظات (اختياري)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="أي طلبات خاصة..."
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlign="right"
          />

          <TouchableOpacity
            style={[styles.goldBtn, submitting && styles.goldBtnDisabled]}
            onPress={handleConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.goldBtnText}>تأكيد الحجز</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
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
    padding: 24,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.gold,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  stepSection: {
    marginBottom: 28,
  },
  stepLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  changeBtn: {
    color: colors.gold,
    fontSize: 13,
  },
  serviceCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 14,
  },
  serviceIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.goldFaint,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.goldLight,
  },
  serviceBody: {
    flex: 1,
    gap: 6,
  },
  serviceName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  serviceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
  serviceMetaText: {
    color: colors.muted,
    fontSize: 12,
  },
  servicePriceWrap: {
    alignItems: 'center',
    gap: 4,
  },
  servicePrice: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
  },
  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginBottom: 16,
    backgroundColor: colors.heroCard,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.goldLight,
  },
  selectedSummaryText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '600',
  },
  datesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
  },
  centerPad: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  optionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionCardSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.heroCard,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.goldFaint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  optionSub: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
  },
  optionPrice: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.goldLight,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    minWidth: 68,
  },
  dateCardSelected: {
    backgroundColor: colors.heroCard,
    borderColor: colors.gold,
  },
  dateDayName: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  dateNum: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  dateMonth: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  dateTextActive: {
    color: colors.gold,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
  },
  slotChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  slotChipText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  emptySlots: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptySlotsText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    color: colors.white,
    fontSize: 14,
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.goldLight,
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    gap: 12,
  },
  summaryTitle: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  summaryKey: {
    color: colors.muted,
    fontSize: 13,
  },
  summaryValue: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
  summaryPrice: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
  },
  goldBtn: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  goldBtnDisabled: {
    opacity: 0.6,
  },
  goldBtnText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  modeCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    width: '85%',
    marginBottom: 16,
  },
  modeCardGroom: {
    borderColor: colors.goldLight,
  },
  modeIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.goldFaint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  modeIconWrapGroom: {
    backgroundColor: colors.heroCard,
    borderWidth: 1,
    borderColor: colors.goldLight,
  },
  modeTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  modeSub: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  successIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.goldFaint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  successTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  successSub: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
