import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SettingsProvider } from '../state/SettingsContext';
import { PriceCheckOverlay } from './PriceCheckOverlay';

/**
 * Root of the in-game overlay. The panel itself provides the blur and the
 * rounded border, so this view stays transparent.
 */
export function OverlayRoot() {
  return (
    <SettingsProvider>
      <View style={styles.root}>
        <PriceCheckOverlay />
      </View>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
