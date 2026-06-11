import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Lock } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { authPalette } from '../../constants/theme';

const { GOLD, BG, BORDER, GOLD_BD, WHITE, MUTED } = authPalette;

/* Supabase puts the recovery tokens in the URL fragment:
   salon-abu-adel://reset-password#access_token=...&refresh_token=...&type=recovery
   Expo's Linking.parse() only handles query params, so parse both ? and # here. */
function parseAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of url.split(/[?#]/).slice(1)) {
    for (const pair of part.split('&')) {
      const [key, ...rest] = pair.split('=');
      if (key) out[key] = decodeURIComponent(rest.join('='));
    }
  }
  return out;
}

type Phase = 'verifying' | 'ready' | 'invalid';

export default function ResetPassword() {
  const router = useRouter();
  const url = Linking.useURL();

  const [phase,    setPhase]    = useState<Phase>('verifying');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [focused,  setFocused]  = useState<'pass' | 'confirm' | null>(null);

  useEffect(() => {
    if (phase !== 'verifying' || !url) return;

    const params = parseAuthParams(url);

    if (params.error_description || params.error) {
      setPhase('invalid');
      return;
    }

    if (params.access_token && params.refresh_token) {
      supabase.auth
        .setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        })
        .then(({ error }) => setPhase(error ? 'invalid' : 'ready'))
        .catch(() => setPhase('invalid'));
      return;
    }

    // Opened without recovery tokens (e.g. manual navigation)
    setPhase('invalid');
  }, [url, phase]);

  async function handleSave() {
    if (loading) return;
    setErrorMsg('');
    if (!password.trim() || !confirm.trim()) { setErrorMsg('يرجى تعبئة جميع الحقول'); return; }
    if (password.length < 6) { setErrorMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (password !== confirm) { setErrorMsg('كلمتا المرور غير متطابقتين'); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setErrorMsg('تعذر تغيير كلمة المرور، حاول مجدداً');
      return;
    }
    // Drop the recovery session and have the user log in with the new password.
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
    Alert.alert('تم بنجاح', 'تم تغيير كلمة المرور، يمكنك الآن تسجيل الدخول.');
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={s.card}>
          <Text style={s.cardTitle}>تعيين كلمة مرور جديدة</Text>

          {phase === 'verifying' && (
            <View style={s.centerBox}>
              <ActivityIndicator color={GOLD} />
              <Text style={s.hint}>جارٍ التحقق من الرابط…</Text>
            </View>
          )}

          {phase === 'invalid' && (
            <>
              <View style={s.errorBox}>
                <Text style={s.errorTxt}>
                  الرابط غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً وحاول مرة أخرى.
                </Text>
              </View>
              <TouchableOpacity style={s.btn} onPress={() => router.replace('/(auth)/forgot-password')}>
                <Text style={s.btnTxt}>طلب رابط جديد</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'ready' && (
            <>
              <View style={[s.inputWrap, focused === 'pass' && s.inputFocused]}>
                <TextInput
                  style={s.input}
                  placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)"
                  placeholderTextColor={MUTED}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textAlign="right"
                  returnKeyType="next"
                  onFocus={() => setFocused('pass')}
                  onBlur={() => setFocused(null)}
                />
                <View style={s.iconWrap}>
                  <Lock size={17} color={focused === 'pass' ? GOLD : MUTED} strokeWidth={1.5} />
                </View>
              </View>

              <View style={[s.inputWrap, focused === 'confirm' && s.inputFocused]}>
                <TextInput
                  style={s.input}
                  placeholder="تأكيد كلمة المرور"
                  placeholderTextColor={MUTED}
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  textAlign="right"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  onFocus={() => setFocused('confirm')}
                  onBlur={() => setFocused(null)}
                />
                <View style={s.iconWrap}>
                  <Lock size={17} color={focused === 'confirm' ? GOLD : MUTED} strokeWidth={1.5} />
                </View>
              </View>

              {errorMsg ? (
                <View style={s.errorBox}>
                  <Text style={s.errorTxt}>{errorMsg}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={[s.btn, loading && s.btnOff]} onPress={handleSave} disabled={loading}>
                {loading
                  ? <ActivityIndicator color={BG} />
                  : <Text style={s.btnTxt}>حفظ كلمة المرور</Text>}
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
  hint: { color: MUTED, fontSize: 13, textAlign: 'center' },
  centerBox: { alignItems: 'center', gap: 12, paddingVertical: 16 },

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
  errorTxt: { color: '#ff6b6b', fontSize: 13, textAlign: 'center', lineHeight: 19 },

  btn: {
    backgroundColor: GOLD, borderRadius: 16,
    paddingVertical: 17, alignItems: 'center',
  },
  btnOff: { opacity: 0.55 },
  btnTxt: { color: BG, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
});
