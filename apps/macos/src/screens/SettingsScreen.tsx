import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { HotkeyAction, KeyCombo } from '@vaaluation/shared-types';
import { colors, spacing, typography } from '@vaaluation/ui';
import { Section } from '../components/Section';
import { useSettings } from '../state/SettingsContext';

function formatCombo(combo: KeyCombo | null): string {
  if (combo === null) {
    return 'Disabled';
  }
  const parts: string[] = [];
  if (combo.control) parts.push('⌃');
  if (combo.option) parts.push('⌥');
  if (combo.shift) parts.push('⇧');
  if (combo.command) parts.push('⌘');
  parts.push(combo.characters);
  return parts.join('');
}

const HOTKEY_LABELS: Record<HotkeyAction, string> = {
  priceCheck: 'Price check',
  priceCheckPersistent: 'Price check (persistent overlay)',
  toggleOverlay: 'Show/hide overlay',
};

export function SettingsScreen() {
  const { settings, update } = useSettings();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="League">
        <Text style={styles.value}>{settings.leagueId ?? 'Not selected yet'}</Text>
        <Text style={styles.hint}>
          League selection becomes available when trade integration lands (Milestone 5).
          The current challenge league will be the default.
        </Text>
      </Section>

      <Section title="Keyboard Shortcuts">
        {(Object.keys(HOTKEY_LABELS) as HotkeyAction[]).map((action) => (
          <View key={action} style={styles.row}>
            <Text style={styles.label}>{HOTKEY_LABELS[action]}</Text>
            <Text style={styles.combo}>{formatCombo(settings.hotkeys[action])}</Text>
          </View>
        ))}
        <Text style={styles.hint}>
          Shortcut recording and conflict detection arrive with the global hotkey engine
          (Milestone 2).
        </Text>
      </Section>

      <Section title="Logging">
        <View style={styles.row}>
          <View style={styles.labelBlock}>
            <Text style={styles.label}>Debug logging</Text>
            <Text style={styles.hint}>
              Includes full item text in local logs. Never uploaded anywhere.
            </Text>
          </View>
          <Switch
            value={settings.debugLogging}
            onValueChange={(value) => update({ debugLogging: value })}
          />
        </View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  labelBlock: {
    flex: 1,
    paddingRight: spacing.lg,
  },
  label: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
  },
  value: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
  },
  combo: {
    color: colors.goldBright,
    fontSize: typography.sizeBody,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    marginTop: spacing.xs,
  },
});
