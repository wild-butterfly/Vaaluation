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
import { SettingsProvider, useSettings } from '../state/SettingsContext';
import { useTradeRequests } from '../hooks/useTradeRequests';
import { onItemCopied, onShowTrades } from '../native/VLEvents';
import { consumePendingShowTrades } from '../native/VLTrade';
import { PriceCheckOverlay } from './PriceCheckOverlay';
import { TradeOverlay } from './TradeOverlay';

type Tab = 'price' | 'trades';

function Shell() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<Tab>('price');
  const [seenCount, setSeenCount] = useState(0);

  const trades = useTradeRequests(settings.tradeWhispersEnabled);

  // A price check always brings the price tab forward — that is what the
  // shortcut was pressed for.
  useEffect(() => onItemCopied(() => setTab('price')), []);
  // A buy request opens straight onto the trade panel. The latch covers the
  // case where the overlay was created by that very whisper and so was not
  // yet listening when the signal fired.
  useEffect(() => onShowTrades(() => setTab('trades')), []);
  useEffect(() => {
    consumePendingShowTrades()
      .then((pending) => {
        if (pending) setTab('trades');
      })
      .catch(() => {});
  }, []);

  // Clear the badge once the user has actually looked at the list.
  useEffect(() => {
    if (tab === 'trades') setSeenCount(trades.requests.length);
  }, [tab, trades.requests.length]);

  const unread = Math.max(0, trades.requests.length - seenCount);

  return (
    <View style={styles.root}>
      <View style={styles.tabStrip}>
        <Pressable
          style={[styles.pill, tab === 'price' && styles.pillActive]}
          onPress={() => setTab('price')}
        >
          <Text style={[styles.pillText, tab === 'price' && styles.pillTextActive]}>
            Price
          </Text>
        </Pressable>
        <Pressable
          style={[styles.pill, tab === 'trades' && styles.pillActive]}
          onPress={() => setTab('trades')}
        >
          <Text style={[styles.pillText, tab === 'trades' && styles.pillTextActive]}>
            Trades
          </Text>
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>
        <Text style={styles.league} numberOfLines={1}>
          {settings.leagueId ?? '—'}
        </Text>
      </View>

      <View style={styles.body}>
        {tab === 'price' ? (
          <PriceCheckOverlay />
        ) : (
          <TradeOverlay
            requests={trades.requests}
            enabled={settings.tradeWhispersEnabled}
            error={trades.error}
            quickReplies={settings.quickReplies}
            thanksMessage={settings.thanksMessage}
            onEnable={() => update({ tradeWhispersEnabled: true })}
            onDone={trades.markDone}
            onDismiss={trades.dismiss}
          />
        )}
      </View>
    </View>
  );
}

function ThemedShell() {
  const { settings } = useSettings();
  return (
    <ThemeProvider name={settings.theme}>
      <Shell />
    </ThemeProvider>
  );
}

/**
 * Root of the in-game overlay. The panel itself provides the blur, gradient
 * and rounded border, so this view stays transparent.
 */
export function OverlayRoot() {
  return (
    <SettingsProvider>
      <ThemedShell />
    </SettingsProvider>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent' },
    tabStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: borders.standard,
      backgroundColor: surfaces.raised,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.keycap,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.sm,
    },
    pillActive: { backgroundColor: alpha(theme.accent, 0.14) },
    pillText: {
      fontFamily: fonts.sans,
      fontSize: scale.ui,
      fontWeight: '600',
      color: palette.muted,
    },
    pillTextActive: { color: theme.accentText },
    badge: {
      minWidth: 15,
      height: 15,
      borderRadius: 8,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.action,
    },
    badgeText: {
      fontFamily: fonts.mono,
      fontSize: 9,
      fontWeight: '700',
      color: theme.actionText,
    },
    league: {
      marginLeft: 'auto',
      fontFamily: fonts.mono,
      fontSize: scale.tiny,
      color: palette.dim,
      maxWidth: 150,
      textAlign: 'right',
    },
    body: { flex: 1 },
  });
}
