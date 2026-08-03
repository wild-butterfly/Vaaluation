import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, glass, radii, spacing, typography } from '@vaaluation/ui';
import { SettingsProvider, useSettings } from '../state/SettingsContext';
import { useTradeRequests } from '../hooks/useTradeRequests';
import { onItemCopied } from '../native/VLEvents';
import { PriceCheckOverlay } from './PriceCheckOverlay';
import { TradeOverlay } from './TradeOverlay';

type Tab = 'price' | 'trades';

function Shell() {
  const { settings } = useSettings();
  const [tab, setTab] = useState<Tab>('price');
  const [seenCount, setSeenCount] = useState(0);

  const trades = useTradeRequests(settings.tradeWhispersEnabled);

  // A price check always brings the price tab forward — that is what the
  // shortcut was pressed for.
  useEffect(() => onItemCopied(() => setTab('price')), []);

  // Clear the badge once the user has actually looked at the list.
  useEffect(() => {
    if (tab === 'trades') setSeenCount(trades.requests.length);
  }, [tab, trades.requests.length]);

  const unread = Math.max(0, trades.requests.length - seenCount);

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'price' && styles.tabActive]}
          onPress={() => setTab('price')}
        >
          <Text style={[styles.tabText, tab === 'price' && styles.tabTextActive]}>
            Price
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'trades' && styles.tabActive]}
          onPress={() => setTab('trades')}
        >
          <Text style={[styles.tabText, tab === 'trades' && styles.tabTextActive]}>
            Trades
          </Text>
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>
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
            onDone={trades.markDone}
            onDismiss={trades.dismiss}
          />
        )}
      </View>
    </View>
  );
}

/**
 * Root of the in-game overlay. The panel itself provides the blur and the
 * rounded border, so this view stays transparent.
 */
export function OverlayRoot() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: glass.surfaceStrong,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  tabActive: {
    backgroundColor: glass.fill,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  badge: {
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.accent,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.accentBorder,
  },
  badgeText: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
});
