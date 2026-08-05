import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LogEntry } from '@vaaluation/shared-types';
import {
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
import { clearLogs, getLogFilePath, getRecentLogs } from '../native/VLLog';

/** Levels worth colouring. Info is the common case and stays neutral. */
const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  debug: palette.faint,
  info: palette.dim,
  warn: semantic.warn,
  error: '#dd5560',
};

function timeOf(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return timestamp;
  return new Date(parsed).toLocaleTimeString();
}

export function LogsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filePath, setFilePath] = useState<string>('');
  /** Off by default: most of the file is routine, and a reader here is
   *  usually chasing something that went wrong. */
  const [problemsOnly, setProblemsOnly] = useState(false);

  const refresh = useCallback(() => {
    getRecentLogs(200)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    refresh();
    getLogFilePath()
      .then(setFilePath)
      .catch(() => setFilePath(''));
  }, [refresh]);

  const onClear = useCallback(() => {
    clearLogs()
      .then(refresh)
      .catch(() => {});
  }, [refresh]);

  const problems = entries.filter(
    (entry) => entry.level === 'warn' || entry.level === 'error',
  );
  const shown = problemsOnly ? problems : entries;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Logs</Text>
          <Text style={styles.hint}>
            A record of what Vaaluation did, kept on this Mac. Useful when a shortcut
            does not fire or a price check comes back empty — and worth attaching to a
            bug report.
          </Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <Pressable style={styles.button} onPress={refresh}>
          <Text style={styles.buttonText}>Refresh</Text>
        </Pressable>
        <Pressable
          style={[styles.button, problemsOnly && styles.buttonActive]}
          onPress={() => setProblemsOnly((only) => !only)}
        >
          <Text style={[styles.buttonText, problemsOnly && styles.buttonTextActive]}>
            Problems only{problems.length > 0 ? ` (${problems.length})` : ''}
          </Text>
        </Pressable>
        <Pressable style={styles.button} onPress={onClear}>
          <Text style={styles.buttonText}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {shown.length === 0 ? (
          <Text style={styles.empty}>
            {problemsOnly
              ? 'Nothing has gone wrong since the log was last cleared.'
              : 'Nothing logged yet.'}
          </Text>
        ) : (
          shown.map((entry, index) => (
            <View key={index} style={styles.row}>
              <Text style={styles.time}>{timeOf(entry.timestamp)}</Text>
              <Text style={[styles.level, { color: LEVEL_COLOR[entry.level] }]}>
                {entry.scope}
              </Text>
              <Text style={styles.message} selectable>
                {entry.message}
              </Text>
            </View>
          ))
        )}
      </View>

      {filePath.length > 0 ? (
        <Text style={styles.path} selectable numberOfLines={1}>
          {filePath}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing.xl },
    headerRow: { flexDirection: 'row', marginBottom: spacing.lg },
    headerText: { flex: 1 },
    heading: {
      fontFamily: fonts.sans,
      color: palette.primary,
      fontSize: scale.lg,
      fontWeight: '700',
    },
    hint: {
      fontFamily: fonts.sans,
      color: palette.secondary,
      fontSize: scale.small,
      lineHeight: 18,
      marginTop: 3,
      maxWidth: 560,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    button: {
      backgroundColor: surfaces.raised,
      borderColor: borders.standard,
      borderWidth: 1,
      borderRadius: radii.field,
      paddingHorizontal: spacing.xxl,
      paddingVertical: 5,
    },
    buttonActive: {
      backgroundColor: alpha(theme.accent, 0.16),
      borderColor: alpha(theme.accent, 0.45),
    },
    buttonText: { fontFamily: fonts.sans, fontSize: scale.small, color: '#d6cbc4' },
    buttonTextActive: { color: theme.accentText, fontWeight: '600' },

    list: {
      backgroundColor: surfaces.sunken,
      borderColor: surfaces.cardBorder,
      borderTopColor: borders.rimLight,
      borderWidth: 1,
      borderRadius: radii.card,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xl,
      paddingVertical: 3,
    },
    time: {
      fontFamily: fonts.mono,
      fontSize: scale.tiny,
      color: palette.faint,
      width: 74,
    },
    // The scope says which part of the app spoke; its colour carries the
    // severity, so no separate "[warn]" tag is needed.
    level: {
      fontFamily: fonts.mono,
      fontSize: scale.tiny,
      width: 84,
    },
    message: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: scale.small,
      color: palette.body,
      lineHeight: 17,
    },
    empty: {
      fontFamily: fonts.sans,
      fontSize: scale.small,
      color: palette.dim,
      paddingVertical: spacing.md,
    },
    path: {
      fontFamily: fonts.mono,
      fontSize: scale.label,
      color: palette.faint,
      marginTop: spacing.md,
    },
  });
}
