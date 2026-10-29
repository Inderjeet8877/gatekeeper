// Gatekeeper mobile UI kit — docs/09 §4. One file on purpose: every primitive the screens need.
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, CircleAlert, RefreshCw, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextProps, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { errMsg } from '@/lib/api';
import type { Spec } from '@/lib/status';
import { palette, useTheme, type ColorTokens, type StatusTone, type TypeVariant } from '@/lib/theme';

type ColorKey = Exclude<keyof ColorTokens, 'status'>;

export function Txt({ v = 'body', c = 'fg', color, style, ...p }: TextProps & { v?: TypeVariant; c?: ColorKey; color?: string }) {
  const t = useTheme();
  return <Text {...p} style={[t.type[v], { color: color ?? t.colors[c] }, style]} />;
}

/** lucide icon with the brand stroke (1.75; 2 on guard screens). */
export function I({ icon: Icon, size = 20, color }: { icon: LucideIcon; size?: number; color?: string }) {
  const t = useTheme();
  return <Icon size={size} color={color ?? t.colors.fgMuted} strokeWidth={t.guard ? 2 : 1.75} />;
}

// ---------- Button ----------
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerOutline';
export function Button({
  title, onPress, variant = 'primary', size = 'md', icon, loading, disabled, style, a11y,
}: {
  title: string; onPress?: () => void; variant?: Variant; size?: 'md' | 'lg' | 'xl'; icon?: LucideIcon;
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; a11y?: string;
}) {
  const { colors: c, fonts } = useTheme();
  const map: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: c.brand, fg: c.fgOnBrand },
    secondary: { bg: c.navy, fg: c.fgOnBrand },
    outline: { bg: 'transparent', fg: c.fgHeading, border: c.lineStrong },
    ghost: { bg: 'transparent', fg: c.fgMuted },
    danger: { bg: c.danger, fg: c.fgOnBrand },
    dangerOutline: { bg: 'transparent', fg: c.dangerFg, border: c.danger },
  };
  const s = map[variant];
  const h = { md: 44, lg: 52, xl: 72 }[size];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        {
          minHeight: h, paddingHorizontal: size === 'xl' ? 28 : 16, borderRadius: 10, backgroundColor: s.bg,
          borderWidth: s.border ? 1 : 0, borderColor: s.border, flexDirection: 'row', alignItems: 'center',
          justifyContent: 'center', gap: 8, opacity: disabled ? 0.4 : 1,
        },
        pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={s.fg} /> : icon ? <I icon={icon} size={size === 'xl' ? 28 : 20} color={s.fg} /> : null}
      <Text style={{ fontFamily: size === 'xl' ? fonts.bold : fonts.semibold, fontSize: size === 'xl' ? 20 : size === 'lg' ? 16 : 15, color: s.fg }}>
        {title}
      </Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, color, size = 44, badge }: { icon: LucideIcon; label: string; onPress: () => void; color?: string; size?: number; badge?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => ({ width: size, height: size, alignItems: 'center', justifyContent: 'center', borderRadius: 999, opacity: pressed ? 0.7 : 1 })}>
      <I icon={icon} size={24} color={color} />
      {!!badge && <CountBadge n={badge} style={{ position: 'absolute', top: 4, right: 2 }} />}
    </Pressable>
  );
}

export function CountBadge({ n, danger, style }: { n: number; danger?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={[{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? colors.danger : palette.navy[900] }, style]}>
      <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 11, fontVariant: ['tabular-nums'] }}>{n > 99 ? '99+' : n}</Text>
    </View>
  );
}

// ---------- Surfaces ----------
export function Card({ children, style, onPress, accent, a11y }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accent?: string; a11y?: string }) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: t.colors.surface, borderRadius: 12, padding: 20,
    ...(t.isDark || t.guard ? { borderWidth: 1, borderColor: t.colors.line } : t.shadows.card),
    ...(accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={({ pressed }) => [base, pressed && { opacity: 0.9 }, style]}>
      {children}
    </Pressable>
  );
}

/** Screen shell: safe area, paper header (with back on stacked screens), scroll + pull-to-refresh, sticky footer. */
export function Screen({
  title, subtitle, back, right, children, footer, scroll = true, refresh = true, header,
}: {
  title?: string; subtitle?: string; back?: boolean; right?: ReactNode; children: ReactNode; footer?: ReactNode;
  scroll?: boolean; refresh?: boolean; header?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await qc.refetchQueries({ type: 'active' }).catch(() => {});
    setRefreshing(false);
  };
  const body = <View style={{ padding: 16, gap: 16, paddingBottom: 32 }}>{children}</View>;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: t.guard ? 0 : insets.top }}>
        {header ?? (title || back) ? (
          header ?? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: back ? 4 : 16, paddingTop: 8, minHeight: 56, gap: 4 }}>
              {back && <IconButton icon={ChevronLeft} label="Go back" color={t.colors.fgHeading} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
              <View style={{ flex: 1 }}>
                {!!title && <Txt v={t.guard ? 'guardXl' : back ? 'h2' : 'h1'} c="fgHeading" accessibilityRole="header">{title}</Txt>}
                {!!subtitle && <Txt v="bodySm" c="fgMuted">{subtitle}</Txt>}
              </View>
              {right}
            </View>
          )
        ) : null}
      </View>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.colors.brand} colors={[t.colors.brand]} /> : undefined}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
      {footer && (
        <View style={{ padding: 16, paddingBottom: (back ? insets.bottom : 0) + 12, borderTopWidth: 1, borderTopColor: t.colors.line, backgroundColor: t.colors.canvas, gap: 12 }}>
          {footer}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

export function Section({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
        <Txt v="h3" c="fgHeading" accessibilityRole="header">{title}</Txt>
        {action && (
          <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="link">
            <Txt v="label" c="brandFg">{action.label}</Txt>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

/** List row (§4.12): leading icon circle → title/subtitle → trailing. */
export function Row({ icon, iconColor, iconBg, title, subtitle, right, onPress, a11y, children }: {
  icon?: LucideIcon; iconColor?: string; iconBg?: string; title: string; subtitle?: string; right?: ReactNode;
  onPress?: () => void; a11y?: string; children?: ReactNode;
}) {
  const t = useTheme();
  const inner = (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
        {icon && (
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: iconBg ?? t.colors.status.neutral.bg, alignItems: 'center', justifyContent: 'center' }}>
            <I icon={icon} color={iconColor ?? t.colors.status.neutral.fg} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Txt v={t.guard ? 'guardBody' : 'h4'} style={t.guard ? { fontFamily: t.fonts.semibold } : undefined}>{title}</Txt>
          {!!subtitle && <Txt v={t.guard ? 'body' : 'bodySm'} c="fgMuted">{subtitle}</Txt>}
        </View>
        {right}
        {onPress && !right && <I icon={ChevronRight} color={t.colors.fgSubtle} />}
      </View>
      {children}
    </View>
  );
  return (
    <Card style={{ paddingVertical: 14, paddingHorizontal: 16 }} onPress={onPress} a11y={a11y ?? [title, subtitle].filter(Boolean).join(', ')}>
      {inner}
    </Card>
  );
}

// ---------- Status ----------
function PulseDot({ color, pulse }: { color: string; pulse?: boolean }) {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulse) return;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [pulse, o]);
  return <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: o }} />;
}

export function StatusChip({ spec, icon, label }: { spec: Spec; icon?: boolean; label?: string }) {
  const t = useTheme();
  const tone = t.colors.status[spec.tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: t.guard ? 32 : 24, paddingHorizontal: 10, borderRadius: 999, backgroundColor: tone.bg, alignSelf: 'flex-start' }}>
      {icon ? <I icon={spec.icon} size={14} color={tone.dot} /> : <PulseDot color={tone.dot} pulse={spec.pulse} />}
      <Text style={{ fontFamily: t.fonts.semibold, fontSize: t.guard ? 16 : 12, color: tone.fg, fontVariant: ['tabular-nums'] }}>{label ?? spec.label}</Text>
    </View>
  );
}

/** Soft badge (§4.9) for non-status labels: role, category, flat. */
export function Badge({ label, icon }: { label: string; icon?: LucideIcon }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 8, borderRadius: 999, backgroundColor: t.colors.status.neutral.bg, alignSelf: 'flex-start' }}>
      {icon && <I icon={icon} size={14} color={t.colors.status.neutral.fg} />}
      <Txt v="caption" color={t.colors.status.neutral.fg}>{label}</Txt>
    </View>
  );
}

export function Banner({ tone, title, body, icon }: { tone: StatusTone; title: string; body?: string; icon?: LucideIcon }) {
  const t = useTheme();
  const c = t.colors.status[tone];
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: c.bg, borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, borderLeftWidth: 4, borderLeftColor: c.dot }}>
      {icon && <I icon={icon} color={c.dot} />}
      <View style={{ flex: 1 }}>
        <Txt v={t.guard ? 'guardBody' : 'h4'} color={c.fg}>{title}</Txt>
        {!!body && <Txt v={t.guard ? 'body' : 'bodySm'} color={c.fg}>{body}</Txt>}
      </View>
    </View>
  );
}

// ---------- States ----------
export function Empty({ icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, gap: 10 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.colors.status.neutral.bg, alignItems: 'center', justifyContent: 'center' }}>
        <I icon={icon} size={32} color={t.colors.fgSubtle} />
      </View>
      <Txt v="h3" c="fgHeading" style={{ textAlign: 'center' }}>{title}</Txt>
      {!!body && <Txt v="bodySm" c="fgMuted" style={{ textAlign: 'center', maxWidth: 320 }}>{body}</Txt>}
      {action}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: t.colors.status.danger.bg, borderRadius: 12, padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <I icon={CircleAlert} color={t.colors.status.danger.dot} />
        <Txt v="bodySm" color={t.colors.status.danger.fg} style={{ flex: 1 }}>{errMsg(error)}</Txt>
      </View>
      {onRetry && <Button title="Try again" variant="outline" icon={RefreshCw} onPress={onRetry} style={{ alignSelf: 'flex-start' }} />}
    </View>
  );
}

export function Skeleton({ rows = 3, height = 72 }: { rows?: number; height?: number }) {
  const t = useTheme();
  return (
    <View accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ height, borderRadius: 12, backgroundColor: t.isDark ? '#16264A' : palette.slate[200], opacity: 1 - i * 0.15 }} />
      ))}
    </View>
  );
}

/** Loading → error → empty → content for one query. */
export function Q<T>({ q, children, empty, rows = 3 }: { q: UseQueryResult<T>; children: (d: T) => ReactNode; empty?: ReactNode; rows?: number }) {
  if (q.isPending) return <Skeleton rows={rows} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (empty && Array.isArray(q.data) && q.data.length === 0) return <>{empty}</>;
  return <>{children(q.data)}</>;
}

// ---------- Forms ----------
export function Field({ label, optional, error, helper, prefix, style, ...p }: TextInputProps & { label: string; optional?: boolean; error?: string | null; helper?: string; prefix?: string }) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Txt v={t.guard ? 'guardBody' : 'label'}>
        {label}
        {optional && <Txt v="caption" c="fgSubtle">  Optional</Txt>}
      </Txt>
      <View style={{
        flexDirection: 'row', alignItems: 'center', minHeight: t.guard ? 64 : 52, borderRadius: 10, backgroundColor: t.colors.surface,
        borderWidth: focus || error ? 2 : 1, borderColor: error ? t.colors.danger : focus ? t.colors.focus : t.colors.lineStrong, overflow: 'hidden',
      }}>
        {prefix && (
          <View style={{ alignSelf: 'stretch', justifyContent: 'center', paddingHorizontal: 12, backgroundColor: t.colors.surfaceSunken, borderRightWidth: 1, borderRightColor: t.colors.line }}>
            <Txt v="body" c="fgMuted">{prefix}</Txt>
          </View>
        )}
        <TextInput
          placeholderTextColor={t.colors.fgSubtle}
          accessibilityLabel={label}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          {...p}
          style={[t.guard ? t.type.guardBody : t.type.body, { flex: 1, color: t.colors.fg, paddingHorizontal: 12, paddingVertical: 10 }, style]}
        />
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }} accessibilityLiveRegion="assertive">
          <I icon={CircleAlert} size={16} color={t.colors.dangerFg} />
          <Txt v="caption" c="dangerFg" style={{ flex: 1 }}>{error}</Txt>
        </View>
      ) : helper ? <Txt v="caption" c="fgSubtle">{helper}</Txt> : null}
    </View>
  );
}

export type Option<T extends string> = { value: T; label: string; icon?: LucideIcon };

/** Selectable pills / tiles. `tiles` renders a 2-column grid of large tiles (guard type picker, SOS types). */
export function Chips<T extends string>({ options, value, onChange, tiles, tone = 'brand' }: {
  options: Option<T>[]; value: T | null; onChange: (v: T) => void; tiles?: boolean; tone?: 'brand' | 'danger' | 'navy';
}) {
  const t = useTheme();
  const on = tone === 'danger' ? t.colors.danger : tone === 'navy' ? t.colors.navy : t.colors.brand;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tiles ? 12 : 8 }} accessibilityRole="radiogroup">
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [
              {
                borderRadius: tiles ? 12 : 999, borderWidth: 1, borderColor: sel ? on : t.colors.lineStrong,
                backgroundColor: sel ? on : t.colors.surface, alignItems: 'center', justifyContent: 'center',
                flexDirection: tiles ? 'column' : 'row', gap: tiles ? 8 : 6,
                ...(tiles ? { width: '47%', flexGrow: 1, minHeight: t.guard ? 120 : 88 } : { minHeight: 44, paddingHorizontal: 14 }),
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            {o.icon && <I icon={o.icon} size={tiles ? 32 : 18} color={sel ? '#fff' : t.colors.fgHeading} />}
            <Txt v={tiles && t.guard ? 'guardBody' : 'label'} color={sel ? '#fff' : t.colors.fgHeading}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.colors.surfaceSunken, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: t.colors.line }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: sel }}
            style={[{ flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, sel && { backgroundColor: t.colors.surface, ...t.shadows.xs }]}>
            <Txt v="label" c={sel ? 'fgHeading' : 'fgMuted'}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom sheet (§4.13). `locked` hides the scrim dismiss (SOS confirm, payment in progress). */
export function Sheet({ visible, onClose, title, children, locked }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode; locked?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!locked) onClose(); }} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: t.colors.overlay }} onPress={() => !locked && onClose()} accessibilityLabel="Close" />
        <View accessibilityViewIsModal style={{ backgroundColor: t.colors.surfaceRaised, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: insets.bottom + 20, gap: 16, maxHeight: '92%', ...t.shadows.overlay }}>
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: t.colors.lineStrong }} />
          {title && <Txt v="h2" c="fgHeading" accessibilityRole="header">{title}</Txt>}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const confirm = (title: string, body: string, action: string) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );

// ---------- Brand ----------
export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Gatekeeper">
      <Path d="M24 3 41 9v13c0 11-7.5 19.5-17 23C14.5 41.5 7 33 7 22V9Z" fill="#0B1B3F" stroke="#13285A" strokeWidth={0.5} />
      {size >= 24 && <Path d="M24 6.2 38.2 11.2V22c0 9.4-6.1 16.6-14.2 19.8C15.9 38.6 9.8 31.4 9.8 22V11.2Z" fill="none" stroke="#C8A04A" strokeWidth={0.75} />}
      <Path d="M30.9 17.2A9 9 0 1 0 33 23h-4.4" fill="none" stroke="#FBFAF7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22.9 23.7A2.2 2.2 0 1 1 25.1 23.7L25.7 27.6H22.3Z" fill="#C8A04A" />
    </Svg>
  );
}

/** The Threshold: gold hairline with a keyhole notch (§1.1). Use only where the doc allows. */
export function Threshold({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.gold }} />
      <Svg width={14} height={12} viewBox="0 0 14 12">
        <Path d="M5.9 6.3A2 2 0 1 1 8.1 6.3L8.6 10H5.4Z" fill={colors.gold} />
      </Svg>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.gold }} />
    </View>
  );
}

// ---------- Toast / in-app banner ----------
type ToastItem = { id: number; title: string; body?: string; tone: StatusTone; onPress?: () => void };
let pushToast: (t: ToastItem) => void = () => {};
let seq = 0;
export function toast(title: string, o: { body?: string; tone?: StatusTone; onPress?: () => void } = {}) {
  pushToast({ id: ++seq, title, body: o.body, tone: o.tone ?? 'success', onPress: o.onPress });
}

export function ToastHost() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    pushToast = (x) => {
      setItems((cur) => [...cur.slice(-2), x]);
      setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== x.id)), x.onPress ? 8000 : 5000);
    };
    return () => { pushToast = () => {}; };
  }, []);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, gap: 8 }} accessibilityLiveRegion="polite">
      {items.map((x) => {
        const c = t.colors.status[x.tone];
        return (
          <Pressable
            key={x.id}
            accessibilityRole={x.onPress ? 'button' : 'alert'}
            onPress={() => { x.onPress?.(); setItems((cur) => cur.filter((i) => i.id !== x.id)); }}
            style={{ backgroundColor: t.colors.surfaceRaised, borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: c.dot, borderWidth: t.isDark ? 1 : 0, borderColor: t.colors.line, ...t.shadows.overlay }}
          >
            <Txt v="h4" c="fgHeading">{x.title}</Txt>
            {!!x.body && <Txt v="bodySm" c="fgMuted">{x.body}</Txt>}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Re-render every `ms` (countdowns, live clock). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(i);
  }, [ms]);
  return now;
}
