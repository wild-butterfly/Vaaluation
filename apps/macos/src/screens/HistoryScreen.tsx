import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { describeRequest } from '@vaaluation/trade-whispers';
import { colors, glass, radii, spacing, typography } from '@vaaluation/ui';
import { useTradeHistory } from '../hooks/useTradeHistory';

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return 'Today';
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString();
}

export function HistoryScreen() {
  const { entries, loaded, clear } = useTradeHistory();

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof entries>();
    for (const entry of entries) {
      const key = dayLabel(entry.completedAt);
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.entries()];
  }, [entries]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Trade History</Text>
          <Text style={styles.hint}>
            {entries.length === 0
              ? 'Requests you mark Done are recorded here.'
              : `${entries.length} recorded`}
          </Text>
        </View>
        {entries.length > 0 ? (
          <Pressable style={styles.button} onPress={clear}>
            <Text style={styles.buttonText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.disclaimer}>
        This records the buy requests you marked Done, not confirmed sales — the game
        gives no way to know whether a trade actually completed. Stored on this Mac only
        and never uploaded.
      </Text>

      {!loaded ? null : entries.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.hint}>
            Nothing yet. Handle a trade request and press Done, and it will appear here.
          </Text>
        </View>
      ) : (
        grouped.map(([day, dayEntries]) => (
          <View key={day} style={styles.group}>
            <Text style={styles.groupTitle}>{day}</Text>
            <View style={styles.card}>
              {dayEntries.map((entry, index) => (
                <View key={entry.id} style={[styles.row, index > 0 && styles.rowDivided]}>
                  <View style={styles.rowText}>
                    <Text style={styles.summary} numberOfLines={1}>
                      {describeRequest(entry.request)}
                    </Text>
                    <Text style={styles.character} numberOfLines={1}>
                      {entry.request.character} · {entry.request.league}
                    </Text>
                  </View>
                  <Text style={styles.time}>
                    {new Date(entry.completedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerText: { flex: 1 },
  heading: {
    color: colors.textPrimary,
    fontSize: typography.sizeHeading,
    fontWeight: '700',
  },
  hint: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    marginTop: 2,
  },
  disclaimer: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    lineHeight: 16,
    marginBottom: spacing.lg,
  },
  group: { marginBottom: spacing.lg },
  groupTitle: {
    color: colors.goldBright,
    fontSize: typography.sizeBody,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: glass.surface,
    borderColor: glass.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowDivided: {
    borderTopColor: glass.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1 },
  summary: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
  },
  character: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
  },
  time: {
    color: colors.textDisabled,
    fontSize: typography.sizeCaption,
  },
  button: {
    backgroundColor: glass.fill,
    borderColor: glass.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
  },
});
