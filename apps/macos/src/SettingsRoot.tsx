import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ThemeProvider,
  alpha,
  borders,
  fonts,
  radii,
  semantic,
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
import { AboutScreen } from './screens/AboutScreen';
import { LogsScreen } from './screens/LogsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { PriceCheckScreen } from './screens/PriceCheckScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TradeScreen } from './screens/TradeScreen';
import { CurrencyScreen } from './screens/CurrencyScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { TestParsingScreen } from './screens/TestParsingScreen';

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
  { route: 'test-parsing', label: 'Test Parsing', glyph: '⌕', key: '' },
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
          <View style={styles.mark}>
            <Text style={styles.markText}>V</Text>
          </View>
          <Text style={styles.brand}>Vaaluation</Text>
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

        <View style={[styles.statusCard, !armed && styles.statusCardOff]}>
          <View style={styles.statusHead}>
            <View style={[styles.dot, !armed && styles.dotOff]} />
            <Text style={[styles.statusTitle, !armed && styles.statusTitleOff]}>
              {armed ? 'Overlay armed' : 'Permission needed'}
            </Text>
          </View>
          <Text style={styles.statusMeta}>
            {armed
              ? 'Ctrl+D on hover · chat log watched'
              : 'Grant Accessibility in Settings'}
          </Text>
        </View>
      </View>

      <View style={styles.main}>
        {route === 'price-check' ? <PriceCheckScreen /> : null}
        {route === 'trade' ? <TradeScreen /> : null}
        {route === 'currency' ? <CurrencyScreen /> : null}
        {route === 'history' ? <HistoryScreen /> : null}
        {route === 'settings' ? <SettingsScreen /> : null}
        {route === 'test-parsing' ? <TestParsingScreen /> : null}
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
    root: { flex: 1, flexDirection: 'row', backgroundColor: theme.window },
    rail: {
      width: 212,
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
      fontSize: scale.body,
      fontWeight: '600',
      color: palette.primary,
    },
    nav: { flex: 1, paddingHorizontal: spacing.md },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingVertical: 9,
      borderRadius: radii.button,
      borderLeftWidth: 2,
      borderLeftColor: 'transparent',
      marginBottom: 2,
    },
    navItemActive: {
      backgroundColor: alpha(theme.accent, 0.1),
      borderLeftColor: theme.accent,
    },
    glyph: {
      fontFamily: fonts.mono,
      fontSize: scale.caption,
      color: palette.faint,
      width: 14,
    },
    glyphActive: { color: theme.accent },
    navLabel: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: scale.ui,
      color: '#a4a6ad',
    },
    navLabelActive: { color: palette.primary, fontWeight: '600' },
    navKey: { fontFamily: fonts.mono, fontSize: scale.label, color: palette.faint },
    navKeyActive: { color: theme.accent },
    statusCard: {
      margin: spacing.xl,
      padding: spacing.xl,
      borderRadius: radii.card,
      backgroundColor: semantic.upBackground,
      borderWidth: 1,
      borderColor: semantic.upBorder,
    },
    statusCardOff: {
      backgroundColor: 'rgba(217,178,95,0.07)',
      borderColor: 'rgba(217,178,95,0.18)',
    },
    statusHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: semantic.up },
    dotOff: { backgroundColor: '#d9b25f' },
    statusTitle: {
      fontFamily: fonts.sans,
      fontSize: scale.caption,
      fontWeight: '600',
      color: semantic.upText,
    },
    statusTitleOff: { color: '#d9b25f' },
    statusMeta: {
      fontFamily: fonts.mono,
      fontSize: scale.label,
      color: '#7b8a72',
      marginTop: 3,
    },
    main: { flex: 1, backgroundColor: theme.overlayBottom },
  });
}
