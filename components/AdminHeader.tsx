import type { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';
import { navigateBack } from '../lib/utils/navigation';

interface AdminHeaderProps {
  icon: LucideIcon;
  title: string;
  /** Optional element on the trailing edge (e.g. add / sign-out button). */
  right?: ReactNode;
  /** Set false on the dashboard itself so back never redirects to it. */
  fallbackToDashboard?: boolean;
}

export function AdminHeader({ icon: Icon, title, right, fallbackToDashboard = true }: AdminHeaderProps) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigateBack(router, fallbackToDashboard ? '/(admin)' : undefined)}
      >
        <ArrowLeft size={18} color={colors.gold} strokeWidth={2} />
      </TouchableOpacity>
      <View style={styles.headerTitleRow}>
        <View style={styles.headerIconWrap}>
          <Icon size={20} color={colors.gold} strokeWidth={1.5} />
        </View>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.goldFaint, borderWidth: 1, borderColor: colors.goldLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.goldFaint, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: colors.white, fontSize: 22, fontWeight: '700' },
});
