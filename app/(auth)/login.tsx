import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, Image, Easing, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Mail, ChevronLeft } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

const { height: SCREEN_H } = Dimensions.get('window');

const GOLD    = '#D4AF37';
const BG      = '#0B0B0F';
const BORDER  = 'rgba(255,255,255,0.08)';
const GOLD_BD = 'rgba(212,175,55,0.30)';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.40)';

export default function Login() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [focused,  setFocused]  = useState<'email' | 'pass' | null>(null);

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
      /* glow */
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0.75, duration: 900, useNativeDriver: true }),
        Animated.spring(glowScale, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
      ]),
      /* logo — delayed 150ms */
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
          Animated.timing(logoOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
        ]),
      ]),
      /* title — delayed 420ms */
      Animated.sequence([
        Animated.delay(420),
        Animated.parallel([
          Animated.timing(titleOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(titleSlide, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
      /* form card — delayed 320ms */
      Animated.sequence([
        Animated.delay(320),
        Animated.parallel([
          Animated.timing(formOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
          Animated.timing(formSlide, { toValue: 0, duration: 550, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        ]),
      ]),
    ]).start(() => {
      /* float loop after entrance */
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoFloat, { toValue: -9, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(logoFloat, { toValue: 0,  duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ).start();
      /* glow pulse loop */
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 1,    duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.45, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ).start();
    });
  }, []);

  function pressIn()  { Animated.spring(btnScale, { toValue: 0.95, friction: 5, tension: 200, useNativeDriver: true }).start(); }
  function pressOut() { Animated.spring(btnScale, { toValue: 1,    friction: 5, tension: 200, useNativeDriver: true }).start(); }

  async function handleLogin() {
    setErrorMsg('');
    if (!email.trim() || !password.trim()) { setErrorMsg('يرجى تعبئة جميع الحقول'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setErrorMsg(error.message === 'Email not confirmed'
        ? 'يرجى تأكيد البريد الإلكتروني أولاً'
        : 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
      return;
    }
    const userId = data.user?.id;
    if (userId) {
      const { data: ud } = await supabase.from('users').select('role').eq('id', userId).single();
      setLoading(false);
      router.replace(ud?.role === 'admin' ? '/(admin)' : '/(user)');
    } else { setLoading(false); router.replace('/(user)'); }
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ═══ HERO ═══ */}
        <View style={s.hero}>

          {/* Decorative bg rings */}
          <View style={s.ringOuter} />
          <View style={s.ringMid} />

          {/* Animated glow */}
          <Animated.View style={[s.glowContainer, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
            <View style={s.glowRing3} />
            <View style={s.glowRing2} />
            <View style={s.glowRing1} />
          </Animated.View>

          {/* Logo */}
          <Animated.View style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }, { translateY: logoFloat }],
          }}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Salon name + tagline */}
          <Animated.View style={[s.titleWrap, { opacity: titleOpacity, transform: [{ translateY: titleSlide }] }]}>
            <Text style={s.salonName}>صالون أبو عادل</Text>
            <Text style={s.tagline}>أهلاً وسهلاً بك</Text>
          </Animated.View>
        </View>

        {/* ═══ FORM CARD ═══ */}
        <Animated.View style={[s.card, { opacity: formOpacity, transform: [{ translateY: formSlide }] }]}>

          <Text style={s.cardTitle}>تسجيل الدخول</Text>

          {/* Email */}
          <View style={[s.inputWrap, focused === 'email' && s.inputFocused]}>
            <TextInput
              style={s.input}
              placeholder="البريد الإلكتروني"
              placeholderTextColor={MUTED}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              textAlign="right"
              returnKeyType="next"
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
            />
            <View style={s.iconWrap}>
              <Mail size={17} color={focused === 'email' ? GOLD : MUTED} strokeWidth={1.5} />
            </View>
          </View>

          {/* Password */}
          <View style={[s.inputWrap, focused === 'pass' && s.inputFocused]}>
            <TextInput
              style={s.input}
              placeholder="كلمة المرور"
              placeholderTextColor={MUTED}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textAlign="right"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              onFocus={() => setFocused('pass')}
              onBlur={() => setFocused(null)}
            />
            <View style={s.iconWrap}>
              <Lock size={17} color={focused === 'pass' ? GOLD : MUTED} strokeWidth={1.5} />
            </View>
          </View>

          {/* Error */}
          {errorMsg ? (
            <View style={s.errorBox}>
              <Text style={s.errorTxt}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Button */}
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[s.btn, loading && s.btnOff]}
              onPress={handleLogin}
              onPressIn={pressIn}
              onPressOut={pressOut}
              disabled={loading}
              activeOpacity={1}
            >
              {loading
                ? <ActivityIndicator color={BG} />
                : <Text style={s.btnTxt}>دخول</Text>}
            </TouchableOpacity>
          </Animated.View>

          {/* Register link */}
          <TouchableOpacity style={s.linkRow} onPress={() => router.push('/(auth)/register')}>
            <ChevronLeft size={14} color={GOLD} strokeWidth={2} />
            <Text style={s.linkTxt}>
              ما عندك حساب؟{' '}<Text style={s.linkHi}>سجل هون</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 40 }} />
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
    height: SCREEN_H * 0.46,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ringOuter: {
    position: 'absolute',
    width: 340, height: 340, borderRadius: 170,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.05)',
  },
  ringMid: {
    position: 'absolute',
    width: 240, height: 240, borderRadius: 120,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.08)',
  },
  glowContainer: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
  },
  glowRing3: {
    position: 'absolute',
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(212,175,55,0.04)',
  },
  glowRing2: {
    position: 'absolute',
    width: 210, height: 210, borderRadius: 105,
    backgroundColor: 'rgba(212,175,55,0.07)',
  },
  glowRing1: {
    position: 'absolute',
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(212,175,55,0.13)',
  },
  logo: {
    width: 170,
    height: 170,
  },
  titleWrap: { alignItems: 'center', gap: 5, marginTop: 10 },
  salonName: { color: GOLD, fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  tagline:   { color: MUTED, fontSize: 13 },

  /* ── Card ── */
  card: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 26,
    gap: 14,
  },
  cardTitle: {
    color: WHITE, fontSize: 21, fontWeight: '800',
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
  input: { flex: 1, paddingVertical: 15, color: WHITE, fontSize: 15 },
  iconWrap: { paddingLeft: 10 },

  /* ── Error ── */
  errorBox: {
    backgroundColor: 'rgba(224,82,82,0.10)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(224,82,82,0.22)', padding: 12,
  },
  errorTxt: { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },

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
