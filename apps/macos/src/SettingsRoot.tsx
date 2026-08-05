import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ThemeProvider,
  alpha,
  borders,
  fonts,
  radii,
  spacing,
  surfaces,
  text as palette,
  type as scale,
  useTheme,
} from '@vaaluation/ui';
import type { Theme } from '@vaaluation/ui';
import type { AppRoute } from './native/VLEvents';
import { isAppRoute, onItemCopied, onNavigate } from './native/VLEvents';
import { SettingsProvider, useSettings } from './state/SettingsContext';
import { usePermissions } from './hooks/usePermissions';
import { Mark } from './components/Mark';
import { openSystemSettings, requestAccessibility } from './native/VLPermissions';
import { AboutScreen } from './screens/AboutScreen';
import { LogsScreen } from './screens/LogsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { PriceCheckScreen } from './screens/PriceCheckScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TradeScreen } from './screens/TradeScreen';
import { CurrencyScreen } from './screens/CurrencyScreen';
import { HistoryScreen } from './screens/HistoryScreen';

interface NavItem {
  readonly route: AppRoute;
  readonly label: string;
  readonly glyph: string;
  readonly key: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { route: 'price-check', label: 'Price Check', glyph: '◈', key: '⌘1' },
  { route: 'trade', label: 'Trades', glyph: '⇄', key: '⌥2' },
  { route: 'currency', label: 'Currency', glyph: '◆', key: '◆3' },
  { route: 'history', label: 'History', glyph: '↺', key: '↺4' },
  { route: 'settings', label: 'Settings', glyph: '⚙', key: '' },
  { route: 'logs', label: 'Logs', glyph: '≡', key: '' },
  { route: 'about', label: 'About', glyph: '◍', key: '' },
];

function Shell({ initialRoute }: { initialRoute: AppRoute }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [route, setRoute] = useState<AppRoute>(initialRoute);
  const { settings, loaded } = useSettings();
  const { status } = usePermissions();

  useEffect(() => onNavigate(setRoute), []);
  useEffect(() => onItemCopied(() => setRoute('price-check')), []);

  if (!loaded) {
    return <View style={styles.root} />;
  }

  if (route === 'onboarding' || !settings.onboardingCompleted) {
    return (
      <View style={styles.root}>
        <OnboardingScreen onDone={() => setRoute('price-check')} />
      </View>
    );
  }

  const armed = status?.accessibility === 'granted';

  return (
    <View style={styles.root}>
      <View style={styles.rail}>
        <View style={styles.brandRow}>
          <Mark size={28} on={surfaces.rail} />
          <View>
            <Text style={styles.brand}>Vaaluation</Text>
            <Text style={styles.brandSub}>PRICE CHECK</Text>
          </View>
        </View>

        <View style={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const active = item.route === route;
            return (
              <Pressable
                key={item.route}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => setRoute(item.route)}
              >
                <Text style={[styles.glyph, active && styles.glyphActive]}>
                  {item.glyph}
                </Text>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {item.label}
                </Text>
                {item.key !== '' ? (
                  <Text style={[styles.navKey, active && styles.navKeyActive]}>
                    {item.key}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.statusCard, !armed && styles.statusCardOff]}
          onPress={() => {
            if (armed) return;
            requestAccessibility().catch(() => {});
            openSystemSettings('accessibility');
          }}
        >
          <View style={styles.statusHead}>
            <View style={[styles.dot, !armed && styles.dotOff]} />
            <Text style={[styles.statusTitle, !armed && styles.statusTitleOff]}>
              {armed ? 'Overlay armed' : 'Permission needed'}
            </Text>
          </View>
          <Text style={styles.statusMeta}>
            {armed
              ? 'Ctrl+D on hover · chat log watched'
              : 'Click here to grant Accessibility'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.main}>
        {route === 'price-check' ? <PriceCheckScreen /> : null}
        {route === 'trade' ? <TradeScreen /> : null}
        {route === 'currency' ? <CurrencyScreen /> : null}
        {route === 'history' ? <HistoryScreen /> : null}
        {route === 'settings' ? <SettingsScreen /> : null}
        {route === 'logs' ? <LogsScreen /> : null}
        {route === 'about' ? <AboutScreen /> : null}
      </View>
    </View>
  );
}

function ThemedShell({ initialRoute }: { initialRoute: AppRoute }) {
  const { settings } = useSettings();
  return (
    <ThemeProvider name={settings.theme}>
      <Shell initialRoute={initialRoute} />
    </ThemeProvider>
  );
}

export function SettingsRoot(props: { initialRoute?: string }) {
  const initialRoute: AppRoute = isAppRoute(props.initialRoute)
    ? props.initialRoute
    : 'settings';
  return (
    <SettingsProvider>
      <ThemedShell initialRoute={initialRoute} />
    </SettingsProvider>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    // Tint over the window's vibrancy rather than a solid fill.
    root: { flex: 1, flexDirection: 'row', backgroundColor: surfaces.glassWindow },
    rail: {
      width: 214,
      backgroundColor: surfaces.rail,
      borderRightWidth: 1,
      borderRightColor: borders.subtle,
      paddingTop: spacing.h5,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingHorizontal: spacing.h1,
      paddingBottom: spacing.h2,
    },
    mark: {
      width: 26,
      height: 26,
      borderRadius: radii.button,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markText: {
      fontFamily: fonts.mono,
      fontSize: scale.ui,
      fontWeight: '700',
      color: theme.window,
    },
    brand: {
      fontFamily: fonts.sans,
      fontSize: 14.5,
      fontWeight: '600',
      color: palette.primary,
      letterSpacing: -0.2,
    },
    brandSub: {
      fontFamily: fonts.mono,
      fontSize: 9,
      letterSpacing: 1.4,
      color: palette.dim,
      marginTop: 1,
    },
    nav: { flex: 1, paddingHorizontal: spacing.md },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingVertical: 9,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: 'transparent',
      marginBottom: 3,
    },
    navItemActive: {
      backgroundColor: alpha(theme.accent, 0.28),
      borderLeftColor: 'transparent',
      borderWidth: 1,
      borderColor: 'rgba(207,31,45,0.4)',
      shadowColor: theme.accent,
      shadowOpacity: 0.3,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 3 },
    },
    glyph: {
      fontFamily: fonts.mono,
      fontSize: scale.caption,
      color: palette.faint,
      width: 14,
    },
    glyphActive: { color: '#ffc2c8' },
    navLabel: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: scale.ui,
      color: '#a4a6ad',
    },
    navLabelActive: { color: '#ffffff', fontWeight: '600' },
    navKey: { fontFamily: fonts.mono, fontSize: scale.label, color: palette.faint },
    navKeyActive: { color: '#ffc2c8' },
    statusCard: {
      margin: spacing.xl,
      padding: spacing.xl,
      borderRadius: radii.card,
      backgroundColor: alpha(theme.accent, 0.16),
      borderWidth: 1,
      borderColor: alpha(theme.accent, 0.32),
    },
    statusCardOff: {
      backgroundColor: alpha(theme.accent, 0.07),
      borderColor: alpha(theme.accent, 0.18),
    },
    statusHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#cf1f2d',
      shadowColor: '#cf1f2d',
      shadowOpacity: 0.8,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
    },
    dotOff: { backgroundColor: theme.accent },
    statusTitle: {
      fontFamily: fonts.sans,
      fontSize: scale.caption,
      fontWeight: '600',
      color: palette.primary,
    },
    statusTitleOff: { color: palette.primary },
    statusMeta: {
      fontFamily: fonts.mono,
      fontSize: scale.label,
      color: palette.muted,
      marginTop: 3,
    },
    main: { flex: 1, backgroundColor: 'rgba(14,11,13,0.94)' },
  });
}
