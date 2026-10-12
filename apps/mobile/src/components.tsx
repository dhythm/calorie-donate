import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius } from './theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  compact = false,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        buttonVariants[variant],
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.onPrimary : colors.text}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            compact && styles.buttonTextCompact,
            buttonTextVariants[variant],
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function ProgressBar({
  ratio,
  over = false,
  height = 12,
  label,
}: {
  ratio: number;
  over?: boolean;
  height?: number;
  label: string;
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, borderRadius: height / 2 }]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            borderRadius: height / 2,
            backgroundColor: over ? colors.over : colors.within,
          },
        ]}
      />
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <View
      style={styles.segmented}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{
              selected,
              checked: selected,
              disabled: option.disabled,
            }}
            disabled={option.disabled}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              selected && styles.segmentSelected,
              option.disabled && styles.disabled,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                selected && styles.segmentTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  hint,
  error,
  multiline = false,
  maxLength,
  suffix,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  hint?: string;
  error?: string | null;
  multiline?: boolean;
  maxLength?: number;
  suffix?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            error ? styles.inputError : null,
          ]}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'accent';
}) {
  return (
    <View style={[styles.badge, badgeVariants[tone]]}>
      <Text style={[styles.badgeText, badgeTextVariants[tone]]}>{label}</Text>
    </View>
  );
}

export function Notice({
  message,
  tone = 'error',
  onRetry,
  retryLabel = '再試行',
}: {
  message: string;
  tone?: 'error' | 'info';
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <View
      style={[styles.notice, tone === 'error' ? styles.noticeError : null]}
      accessibilityLiveRegion="polite"
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
    >
      <Text
        style={[
          styles.noticeText,
          tone === 'error' ? styles.noticeTextError : null,
        ]}
      >
        {message}
      </Text>
      {onRetry ? (
        <Button
          title={retryLabel}
          onPress={onRetry}
          variant="secondary"
          compact
          style={styles.noticeButton}
        />
      ) : null}
    </View>
  );
}

export function Loading({ label = '読み込み中…' }: { label?: string }) {
  return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.text} size="large" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

/** Parses a non-negative integer typed by the user, or null. */
export function parseWholeNumber(text: string): number | null {
  const normalized = text
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/,/g, '');
  if (!/^\d+$/.test(normalized)) return null;
  return Number(normalized);
}

const buttonVariants = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  ghost: { backgroundColor: 'transparent' },
});
const buttonTextVariants = StyleSheet.create({
  primary: { color: colors.onPrimary },
  secondary: { color: colors.text },
  danger: { color: colors.danger },
  ghost: { color: colors.text },
});
const badgeVariants = StyleSheet.create({
  neutral: { backgroundColor: colors.surfaceMuted },
  primary: { backgroundColor: colors.primarySoft },
  accent: { backgroundColor: colors.accentSoft },
});
const badgeTextVariants = StyleSheet.create({
  neutral: { color: colors.muted },
  primary: { color: colors.text },
  accent: { color: colors.accentText },
});

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: 36, paddingHorizontal: 14 },
  buttonText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  buttonTextCompact: { fontSize: 14 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  track: {
    width: '100%',
    backgroundColor: colors.withinSoft,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentSelected: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  segmentTextSelected: { color: colors.text },
  field: { gap: 8 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  suffix: { color: colors.muted, fontSize: 15 },
  fieldHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  fieldError: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  notice: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },
  noticeError: { backgroundColor: colors.dangerSoft },
  noticeText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  noticeTextError: { color: colors.danger },
  noticeButton: { alignSelf: 'flex-start' },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  loadingText: { color: colors.muted, fontSize: 14 },
});
