import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, ChevronLeft, MailCheck } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { authPalette } from '../../constants/theme';

const { GOLD, BG, BORDER, GOLD_BD, WHITE, MUTED } = authPalette;

// Must be whitelisted in Supabase Dashboard → Auth → URL Configuration → Redirect URLs
const RESET_REDIRECT_URL = 'salon-abu-adel://reset-password';

export default function ForgotPassword() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [focused,  setFocused]  = useState(false);

  async function handleSend() {
    if (loading) return;
    setErrorMsg('');
    if (!email.trim()) { setErrorMsg('يرجى إدخال البريد الإلكتروني'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_REDIRECT_URL,
    });
    setLoading(false);
    if (error) {
      setErrorMsg(error.status === undefined || error.status === 0
        ? 'تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت'
        : 'تعذر إرسال الرابط، تأكد من البريد الإلكتروني وحاول مجدداً');
      return;
    }
    setSent(true);
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={s.card}>
          <Text style={s.cardTitle}>استعادة كلمة المرور</Text>

          {sent ? (
            <>
              <View style={s.sentBox}>
                <MailCheck size={36} color={GOLD} strokeWidth={1.5} />
                <Text style={s.sentTitle}>تم إرسال الرابط</Text>
                <Text style={s.sentTxt}>
                  افتح بريدك الإلكتروني واضغط على رابط استعادة كلمة المرور من هاتفك، وسيفتح التطبيق لتعيين كلمة مرور جديدة.
                </Text>
              </View>
              <TouchableOpacity style={s.btn} onPress={() => router.back()}>
                <Text style={s.btnTxt}>العودة لتسجيل الدخول</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.hint}>
                أدخل بريدك الإلكتروني وسنرسل لك رابطاً لتعيين كلمة مرور جديدة.
              </Text>

              <View style={[s.inputWrap, focused && s.inputFocused]}>
                <TextInput
                  style={s.input}
                  placeholder="البريد الإلكتروني"
                  placeholderTextColor={MUTED}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  textAlign="right"
                  returnKeyType="done"
                  onSubmitEditing={handleSend}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
                <View style={s.iconWrap}>
                  <Mail size={17} color={focused ? GOLD : MUTED} strokeWidth={1.5} />
                </View>
              </View>

              {errorMsg ? (
                <View style={s.errorBox}>
                  <Text style={s.errorTxt}>{errorMsg}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={[s.btn, loading && s.btnOff]} onPress={handleSend} disabled={loading}>
                {loading
                  ? <ActivityIndicator color={BG} />
                  : <Text style={s.btnTxt}>إرسال الرابط</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={s.linkRow} onPress={() => router.back()}>
                <ChevronLeft size={14} color={GOLD} strokeWidth={2} />
                <Text style={s.linkTxt}>
                  تذكرت كلمة المرور؟{' '}<Text style={s.linkHi}>دخول</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, justifyContent: 'center' },

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
  hint: { color: MUTED, fontSize: 13, textAlign: 'right', lineHeight: 20 },

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

  errorBox: {
    backgroundColor: 'rgba(224,82,82,0.10)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(224,82,82,0.22)', padding: 12,
  },
  errorTxt: { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },

  sentBox: { alignItems: 'center', gap: 10, paddingVertical: 10 },
  sentTitle: { color: WHITE, fontSize: 16, fontWeight: '700' },
  sentTxt: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  btn: {
    backgroundColor: GOLD, borderRadius: 16,
    paddingVertical: 17, alignItems: 'center',
  },
  btnOff: { opacity: 0.55 },
  btnTxt: { color: BG, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },

  linkRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 3,
  },
  linkTxt: { color: MUTED, fontSize: 14 },
  linkHi:  { color: GOLD, fontWeight: '700' },
});
