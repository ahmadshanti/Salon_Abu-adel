import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, Image, Easing, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Mail, ChevronLeft } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { authPalette } from '../../constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');
const { GOLD, BG, BORDER, GOLD_BD, WHITE, MUTED } = authPalette;

export default function Login() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [focused,  setFocused]  = useState<'email' | 'pass' | null>(null);

  /* ── Animated values ── */
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
    });
  }, []);

  function pressIn()  { Animated.spring(btnScale, { toValue: 0.95, friction: 5, tension: 200, useNativeDriver: true }).start(); }
  function pressOut() { Animated.spring(btnScale, { toValue: 1,    friction: 5, tension: 200, useNativeDriver: true }).start(); }

  async function handleLogin() {
    if (loading) return;
    setErrorMsg('');
    if (!email.trim() || !password.trim()) { setErrorMsg('يرجى تعبئة جميع الحقول'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      if (error.message === 'Email not confirmed') {
        setErrorMsg('يرجى تأكيد البريد الإلكتروني أولاً');
      } else if (error.status === undefined || error.status === 0) {
        setErrorMsg('تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت');
      } else {
        setErrorMsg('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      }
      return;
    }
    // Success: the root layout listens for the new session, fetches the role,
    // and redirects to /(admin) or /(user). Keep the spinner until then.
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ═══ HERO ═══ */}
        <View style={s.hero}>

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

          {/* Forgot password */}
          <TouchableOpacity style={s.forgotRow} onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={s.forgotTxt}>نسيت كلمة المرور؟</Text>
          </TouchableOpacity>

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
  logo: {
    width: 170,
    height: 170,
  },
  titleWrap: { alignItems: 'center', gap: 5, marginTop: 10 },
  salonName: { color: GOLD, fontSize: 22, fontWeight: '800' },
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

  /* ── Forgot password ── */
  forgotRow: { alignSelf: 'flex-start', marginTop: -4 },
  forgotTxt: { color: GOLD, fontSize: 13, fontWeight: '600' },

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
  btnTxt: { color: BG, fontSize: 17, fontWeight: '800' },

  /* ── Link ── */
  linkRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 3,
  },
  linkTxt: { color: MUTED, fontSize: 14 },
  linkHi:  { color: GOLD, fontWeight: '700' },
});
