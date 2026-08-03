import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { CopyModifiers, HotkeyAction, KeyCombo } from '@vaaluation/shared-types';
import { colors, radii, spacing, typography } from '@vaaluation/ui';
import { Section } from '../components/Section';
import { useSettings } from '../state/SettingsContext';
import { usePermissions } from '../hooks/usePermissions';
import type { HotkeyErrors } from '../native/VLHotkeys';
import {
  applyHotkeysFromSettings,
  cancelCapture,
  captureNextKeyCombo,
} from '../native/VLHotkeys';
import { openSystemSettings, requestAccessibility } from '../native/VLPermissions';

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

const HOTKEY_ACTIONS = Object.keys(HOTKEY_LABELS) as HotkeyAction[];

const COPY_MODIFIER_OPTIONS: ReadonlyArray<{ value: CopyModifiers; label: string }> = [
  { value: 'control-option', label: '⌃⌥C (default)' },
  { value: 'control', label: '⌃C' },
  { value: 'control-shift', label: '⌃⇧C' },
  { value: 'command', label: '⌘C' },
];

export function SettingsScreen() {
  const { settings, update } = useSettings();
  const { status } = usePermissions();
  const [recording, setRecording] = useState<HotkeyAction | null>(null);
  const [errors, setErrors] = useState<HotkeyErrors>({});

  // Registrations follow persisted settings; refresh error state whenever
  // the hotkey config changes.
  useEffect(() => {
    let cancelled = false;
    applyHotkeysFromSettings()
      .then((result) => {
        if (!cancelled) {
          setErrors(result);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [settings.hotkeys]);

  useEffect(() => () => cancelCapture(), []);

  const record = useCallback(
    (action: HotkeyAction) => {
      setRecording(action);
      captureNextKeyCombo()
        .then((combo) => {
          setRecording(null);
          if (combo !== null) {
            update({ hotkeys: { ...settings.hotkeys, [action]: combo } });
          }
        })
        .catch(() => setRecording(null));
    },
    [settings.hotkeys, update],
  );

  const disable = useCallback(
    (action: HotkeyAction) => {
      update({ hotkeys: { ...settings.hotkeys, [action]: null } });
    },
    [settings.hotkeys, update],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Permissions">
        <View style={styles.row}>
          <View style={styles.labelBlock}>
            <Text style={styles.label}>Accessibility</Text>
            <Text style={styles.hint}>
              Needed to send the single item-copy keystroke to Path of Exile.
            </Text>
          </View>
          {status?.accessibility === 'granted' ? (
            <Text style={styles.granted}>Granted</Text>
          ) : (
            <Pressable
              style={styles.smallButton}
              onPress={() => {
                requestAccessibility().catch(() => {});
                openSystemSettings('accessibility');
              }}
            >
              <Text style={styles.smallButtonText}>Open System Settings</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.row}>
          <View style={styles.labelBlock}>
            <Text style={styles.label}>Input Monitoring</Text>
            <Text style={styles.hint}>
              Not required — shortcuts use a public macOS API that needs no permission.
            </Text>
          </View>
          <Text style={styles.notRequired}>Not required</Text>
        </View>
      </Section>

      <Section title="Keyboard Shortcuts">
        {HOTKEY_ACTIONS.map((action) => {
          const error = errors[action];
          return (
            <View key={action} style={styles.hotkeyBlock}>
              <View style={styles.row}>
                <Text style={styles.label}>{HOTKEY_LABELS[action]}</Text>
                <View style={styles.hotkeyControls}>
                  <Text style={styles.combo}>
                    {recording === action
                      ? 'Press keys…'
                      : formatCombo(settings.hotkeys[action])}
                  </Text>
                  <Pressable
                    style={styles.smallButton}
                    onPress={() => record(action)}
                    disabled={recording !== null}
                  >
                    <Text style={styles.smallButtonText}>
                      {recording === action ? 'Recording' : 'Record'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.smallButton}
                    onPress={() => disable(action)}
                    disabled={settings.hotkeys[action] === null}
                  >
                    <Text style={styles.smallButtonText}>Disable</Text>
                  </Pressable>
                </View>
              </View>
              {error ? <Text style={styles.error}>{error.message}</Text> : null}
            </View>
          );
        })}
        <Text style={styles.hint}>
          Shortcuts must include at least one modifier (⌃⌥⇧⌘). Press Escape while
          recording to cancel.
        </Text>
      </Section>

      <Section title="Item Copy">
        <Text style={styles.hint}>
          Path of Exile copies the advanced item description on Ctrl + Highlight + C.
          Highlight defaults to Alt (Option on macOS). Change this only if you rebound
          Highlight in the game's options.
        </Text>
        <View style={styles.copyRow}>
          {COPY_MODIFIER_OPTIONS.map((option) => {
            const active = settings.copyModifiers === option.value;
            return (
              <Pressable
                key={option.value}
                style={[styles.smallButton, active && styles.smallButtonActive]}
                onPress={() => update({ copyModifiers: option.value })}
              >
                <Text style={styles.smallButtonText}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="League">
        <Text style={styles.value}>{settings.leagueId ?? 'Not selected yet'}</Text>
        <Text style={styles.hint}>
          League selection becomes available when trade integration lands (Milestone 5).
          The current challenge league will be the default.
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
  hotkeyBlock: {
    marginBottom: spacing.xs,
  },
  hotkeyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    minWidth: 70,
    textAlign: 'right',
  },
  smallButton: {
    backgroundColor: colors.obsidian,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  smallButtonActive: {
    backgroundColor: colors.vaalRed,
    borderColor: colors.vaalRedBright,
  },
  copyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  smallButtonText: {
    color: colors.textPrimary,
    fontSize: typography.sizeCaption,
  },
  granted: {
    color: colors.success,
    fontSize: typography.sizeBody,
  },
  notRequired: {
    color: colors.textSecondary,
    fontSize: typography.sizeBody,
  },
  error: {
    color: colors.danger,
    fontSize: typography.sizeCaption,
    marginTop: 2,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    marginTop: spacing.xs,
  },
});
