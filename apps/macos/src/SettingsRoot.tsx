import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@vaaluation/ui';
import type { AppRoute } from './native/VLEvents';
import { isAppRoute, onItemCopied, onNavigate } from './native/VLEvents';
import { SettingsProvider, useSettings } from './state/SettingsContext';
import { AboutScreen } from './screens/AboutScreen';
import { LogsScreen } from './screens/LogsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { PriceCheckScreen } from './screens/PriceCheckScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TestParsingScreen } from './screens/TestParsingScreen';

const NAV_ITEMS: ReadonlyArray<{ route: AppRoute; label: string }> = [
  { route: 'price-check', label: 'Price Check' },
  { route: 'settings', label: 'Settings' },
  { route: 'test-parsing', label: 'Test Parsing' },
  { route: 'logs', label: 'Logs' },
  { route: 'about', label: 'About' },
];

function Shell({ initialRoute }: { initialRoute: AppRoute }) {
  const [route, setRoute] = useState<AppRoute>(initialRoute);
  const { settings, loaded } = useSettings();

  useEffect(() => onNavigate(setRoute), []);
  // A successful in-game price check jumps straight to the price results.
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

  return (
    <View style={styles.root}>
      <View style={styles.sidebar}>
        {NAV_ITEMS.map((item) => {
          const active = item.route === route;
          return (
            <Pressable
              key={item.route}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => setRoute(item.route)}
            >
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.main}>
        {route === 'price-check' ? <PriceCheckScreen /> : null}
        {route === 'settings' ? <SettingsScreen /> : null}
        {route === 'test-parsing' ? <TestParsingScreen /> : null}
        {route === 'logs' ? <LogsScreen /> : null}
        {route === 'about' ? <AboutScreen /> : null}
      </View>
    </View>
  );
}

export function SettingsRoot(props: { initialRoute?: string }) {
  const initialRoute: AppRoute = isAppRoute(props.initialRoute)
    ? props.initialRoute
    : 'settings';
  return (
    <SettingsProvider>
      <Shell initialRoute={initialRoute} />
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.obsidian,
  },
  sidebar: {
    width: 160,
    borderRightColor: colors.gold,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  navItem: {
    borderRadius: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  navItemActive: {
    backgroundColor: colors.vaalRed,
  },
  navLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizeBody,
  },
  navLabelActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  main: {
    flex: 1,
  },
});
