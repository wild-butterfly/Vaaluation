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
import {
  beginOverlayDrag,
  hideOverlay,
  setOverlayContentHeight,
} from '../native/VLOverlay';
import { Mark } from '../components/Mark';
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

  // Chrome the shell draws around whichever tab is showing: the tab strip
  // plus the tab's own footer. Added to the content height the tab reports.
  const CHROME_HEIGHT = 96;
  const reportHeight = (contentHeight: number) => {
    setOverlayContentHeight(contentHeight + CHROME_HEIGHT);
  };

  return (
    <View style={styles.root}>
      {/* The strip doubles as the panel's title bar. Using the bubbling
          responder rather than the capturing one lets the pills and the close
          control claim their own presses first, so only the empty chrome
          between them starts a drag. */}
      <View
        style={styles.tabStrip}
        onStartShouldSetResponder={() => true}
        onResponderGrant={beginOverlayDrag}
      >
        <Mark size={19} on="#120c0e" />
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
        <Pressable style={styles.close} onPress={hideOverlay}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        {tab === 'price' ? (
          <PriceCheckOverlay onContentHeight={reportHeight} />
        ) : (
          <TradeOverlay
            requests={trades.requests}
            enabled={settings.tradeWhispersEnabled}
            error={trades.error}
            quickReplies={settings.quickReplies}
            thanksMessage={settings.thanksMessage}
            onEnable={() => update({ tradeWhispersEnabled: true })}
            onDone={trades.markDone}
            onContentHeight={reportHeight}
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
    // Tint over the native blur; the window itself supplies the blur.
    root: { flex: 1, backgroundColor: surfaces.glassOverlay },
    tabStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.xxl,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: borders.hairline,
      // Header sheen, and the top rim light that reads as glass.
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderTopWidth: 1,
      borderTopColor: borders.rimLight,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.keycap,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.sm,
    },
    pillActive: {
      backgroundColor: alpha(theme.accent, 0.3),
      borderWidth: 1,
      borderColor: 'rgba(207,31,45,0.4)',
      shadowColor: theme.accent,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 2 },
    },
    pillText: {
      fontFamily: fonts.sans,
      fontSize: scale.ui,
      fontWeight: '600',
      color: palette.muted,
    },
    pillTextActive: { color: '#ffdde1' },
    badge: {
      minWidth: 15,
      height: 15,
      borderRadius: 8,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.9)',
    },
    badgeText: {
      fontFamily: fonts.mono,
      fontSize: 10,
      fontWeight: '700',
      color: '#78060f',
    },
    close: {
      width: 20,
      height: 20,
      borderRadius: radii.keycap,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: {
      fontFamily: fonts.mono,
      fontSize: scale.caption,
      color: palette.muted,
    },
    league: {
      marginLeft: 'auto',
      marginRight: spacing.md,
      fontFamily: fonts.mono,
      fontSize: scale.tiny,
      color: palette.dim,
      maxWidth: 150,
      textAlign: 'right',
    },
    body: { flex: 1 },
  });
}
