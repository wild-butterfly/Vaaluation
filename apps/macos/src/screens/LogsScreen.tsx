import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LogEntry } from '@vaaluation/shared-types';
import { colors, radii, spacing, typography } from '@vaaluation/ui';
import { clearLogs, getLogFilePath, getRecentLogs } from '../native/VLLog';

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  debug: colors.textSecondary,
  info: colors.textPrimary,
  warn: colors.warning,
  error: colors.danger,
};

export function LogsScreen() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filePath, setFilePath] = useState<string>('');

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

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Pressable style={styles.button} onPress={refresh}>
          <Text style={styles.buttonText}>Refresh</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={onClear}>
          <Text style={styles.buttonText}>Clear</Text>
        </Pressable>
        {filePath.length > 0 ? (
          <Text style={styles.path} numberOfLines={1}>
            {filePath}
          </Text>
        ) : null}
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {entries.length === 0 ? (
          <Text style={styles.empty}>No log entries.</Text>
        ) : (
          entries.map((entry, index) => (
            <Text key={index} style={styles.line}>
              <Text style={styles.timestamp}>{entry.timestamp} </Text>
              <Text style={{ color: LEVEL_COLORS[entry.level] ?? colors.textPrimary }}>
                [{entry.level}] {entry.scope}: {entry.message}
              </Text>
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  button: {
    backgroundColor: colors.charcoal,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
  },
  path: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    marginLeft: spacing.md,
  },
  list: {
    flex: 1,
    backgroundColor: colors.obsidian,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
  },
  listContent: {
    padding: spacing.md,
  },
  line: {
    fontSize: typography.sizeCaption,
    marginBottom: 2,
  },
  timestamp: {
    color: colors.textDisabled,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: typography.sizeBody,
  },
});
