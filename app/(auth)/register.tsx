import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, Image, Easing, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { User, Phone, Mail, Lock, ChevronLeft } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

const { height: SCREEN_H } = Dimensions.get('window');

const GOLD    = '#D4AF37';
const BG      = '#0B0B0F';
const BORDER  = 'rgba(255,255,255,0.08)';
const GOLD_BD = 'rgba(212,175,55,0.30)';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.40)';

export default function Register() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [focused,  setFocused]  = useState<string | null>(null);

  /* ── Animated values ── */
  const glowOpacity  = useRef(new Animated.Value(0)).current;
  const glowScale    = useRef(new Animated.Value(0.6)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const logoScale    = useRef(new Animated.Value(0.5)).current;
  const logoFloat    = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide   = useRef(new Animated.Value(16)).current;
  const formOpacity  = useRef(new Animated.Value(0)).current;
  const formSlide    = useRef(new Animated.Value(70)).current;
  const btnScale     = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0.7, duration: 900, useNativeDriver: true }),
        Animated.spring(glowScale, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
          Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(titleOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
          Animated.timing(titleSlide, { toValue: 0, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(formOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
          Animated.timing(formSlide, { toValue: 0, duration: 550, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        ]),
      ]),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoFloat, { toValue: -8, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(logoFloat, { toValue: 0,  duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 1,    duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.4,  duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ).start();
    });
  }, []);

  function pressIn()  { Animated.spring(btnScale, { toValue: 0.95, friction: 5, tension: 200, useNativeDriver: true }).start(); }
  function pressOut() { Animated.spring(btnScale, { toValue: 1,    friction: 5, tension: 200, useNativeDriver: true }).start(); }

  async function handleRegister() {
    if (!fullName.trim() || !email.trim() || !whatsapp.trim() || !password.trim()) {
      Alert.alert('خطأ', 'يرجى تعبئة جميع الحقول');
      return;
    }
    if (password.length < 6) {
      Alert.alert('خطأ', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), whatsapp_number: whatsapp.trim() } },
    });
    setLoading(false);
    if (error) { Alert.alert('خطأ', error.message); return; }
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
    Alert.alert('تم التسجيل', 'تم إنشاء حسابك بنجاح، يمكنك الآن تسجيل الدخول.');
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ═══ HERO (smaller for register) ═══ */}
        <View style={s.hero}>
          <View style={s.ringOuter} />
          <View style={s.ringMid} />
          <Animated.View style={[s.glowContainer, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
            <View style={s.glowRing3} />
            <View style={s.glowRing2} />
            <View style={s.glowRing1} />
          </Animated.View>
          <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }, { translateY: logoFloat }] }}>
            <Image source={require('../../assets/images/logo.png')} style={s.logo} resizeMode="contain" />
          </Animated.View>
          <Animated.View style={[s.titleWrap, { opacity: titleOpacity, transform: [{ translateY: titleSlide }] }]}>
            <Text style={s.salonName}>صالون أبو عادل</Text>
            <Text style={s.tagline}>إنشاء حساب جديد</Text>
          </Animated.View>
        </View>

        {/* ═══ FORM CARD ═══ */}
        <Animated.View style={[s.card, { opacity: formOpacity, transform: [{ translateY: formSlide }] }]}>
          <Text style={s.cardTitle}>بيانات التسجيل</Text>

          {[
            { key: 'name',  placeholder: 'الاسم الكامل',                    Icon: User,  type: 'default',   secure: false },
            { key: 'email', placeholder: 'البريد الإلكتروني',               Icon: Mail,  type: 'email-address', secure: false },
            { key: 'wa',    placeholder: 'رقم الواتساب (مثال: 970591234567)', Icon: Phone, type: 'phone-pad',  secure: false },
            { key: 'pass',  placeholder: 'كلمة المرور (6 أحرف على الأقل)',   Icon: Lock,  type: 'default',   secure: true  },
          ].map(({ key, placeholder, Icon, type, secure }) => (
            <View key={key} style={[s.inputWrap, focused === key && s.inputFocused]}>
              <TextInput
                style={s.input}
                placeholder={placeholder}
                placeholderTextColor={MUTED}
                value={key === 'name' ? fullName : key === 'email' ? email : key === 'wa' ? whatsapp : password}
                onChangeText={key === 'name' ? setFullName : key === 'email' ? setEmail : key === 'wa' ? setWhatsapp : setPassword}
                keyboardType={type as any}
                autoCapitalize={type === 'email-address' ? 'none' : 'words'}
                secureTextEntry={secure}
                textAlign="right"
                returnKeyType={key === 'pass' ? 'done' : 'next'}
                onSubmitEditing={key === 'pass' ? handleRegister : undefined}
                onFocus={() => setFocused(key)}
                onBlur={() => setFocused(null)}
              />
              <View style={s.iconWrap}>
                <Icon size={17} color={focused === key ? GOLD : MUTED} strokeWidth={1.5} />
              </View>
            </View>
          ))}

          {/* Button */}
          <Animated.View style={{ transform: [{ scale: btnScale }], marginTop: 4 }}>
            <TouchableOpacity
              style={[s.btn, loading && s.btnOff]}
              onPress={handleRegister}
              onPressIn={pressIn}
              onPressOut={pressOut}
              disabled={loading}
              activeOpacity={1}
            >
              {loading
                ? <ActivityIndicator color={BG} />
                : <Text style={s.btnTxt}>إنشاء الحساب</Text>}
            </TouchableOpacity>
          </Animated.View>

          {/* Login link */}
          <TouchableOpacity style={s.linkRow} onPress={() => router.back()}>
            <ChevronLeft size={14} color={GOLD} strokeWidth={2} />
            <Text style={s.linkTxt}>
              عندك حساب؟{' '}<Text style={s.linkHi}>دخول</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ═══════════════════ STYLES ═══════════════════ */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1 },

  /* ── Hero ── */
  hero: {
    height: SCREEN_H * 0.36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ringOuter: {
    position: 'absolute',
    width: 300, height: 300, borderRadius: 150,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.05)',
  },
  ringMid: {
    position: 'absolute',
    width: 210, height: 210, borderRadius: 105,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.08)',
  },
  glowContainer: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
  },
  glowRing3: {
    position: 'absolute',
    width: 270, height: 270, borderRadius: 135,
    backgroundColor: 'rgba(212,175,55,0.04)',
  },
  glowRing2: {
    position: 'absolute',
    width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(212,175,55,0.07)',
  },
  glowRing1: {
    position: 'absolute',
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(212,175,55,0.13)',
  },
  logo: { width: 140, height: 140 },
  titleWrap: { alignItems: 'center', gap: 4, marginTop: 8 },
  salonName: { color: GOLD, fontSize: 20, fontWeight: '800', letterSpacing: 0.4 },
  tagline:   { color: MUTED, fontSize: 12 },

  /* ── Card ── */
  card: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    gap: 13,
  },
  cardTitle: {
    color: WHITE, fontSize: 20, fontWeight: '800',
    textAlign: 'right', marginBottom: 2,
  },

  /* ── Inputs ── */
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 16, paddingHorizontal: 16,
  },
  inputFocused: {
    borderColor: GOLD_BD,
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  input: { flex: 1, paddingVertical: 14, color: WHITE, fontSize: 15 },
  iconWrap: { paddingLeft: 10 },

  /* ── Button ── */
  btn: {
    backgroundColor: GOLD, borderRadius: 16,
    paddingVertical: 17, alignItems: 'center',
  },
  btnOff: { opacity: 0.55 },
  btnTxt: { color: BG, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },

  /* ── Link ── */
  linkRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 3,
  },
  linkTxt: { color: MUTED, fontSize: 14 },
  linkHi:  { color: GOLD, fontWeight: '700' },
});
