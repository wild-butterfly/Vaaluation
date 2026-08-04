import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TradeRequest } from '@vaaluation/trade-whispers';
import {
  describeRequest,
  hideoutCommand,
  inviteCommand,
  kickCommand,
  thanksCommand,
  tradeCommand,
  whisperCommand,
} from '@vaaluation/trade-whispers';
import { colors, glass, radii, spacing, typography } from '@vaaluation/ui';
import type { TrackedRequest } from '../hooks/useTradeRequests';
import { sendChatCommand } from '../native/VLTrade';
import { openSystemSettings, requestAccessibility } from '../native/VLPermissions';

function ageOf(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

export function TradeOverlay({
  requests,
  enabled,
  error,
  quickReplies,
  thanksMessage,
  onEnable,
  onDone,
  onDismiss,
}: {
  requests: readonly TrackedRequest[];
  enabled: boolean;
  error: string | null;
  quickReplies: readonly string[];
  thanksMessage: string;
  onEnable: () => void;
  onDone: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);

  const run = useCallback((command: { text: string }) => {
    setSendError(null);
    sendChatCommand(command.text).catch((cause: unknown) => {
      setSendError(cause instanceof Error ? cause.message : 'Could not send command.');
    });
  }, []);

  if (!enabled) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Vaaluation can list incoming buy requests here by watching Path of Exile's chat
          log. It reads from this moment onward, keeps only messages matching the game's
          trade-whisper wording, and discards all other chat. Nothing is uploaded. No
          change is needed in the game's own options.
        </Text>
        <Pressable style={styles.enable} onPress={onEnable}>
          <Text style={styles.enableText}>Watch for trade whispers</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      {sendError !== null ? (
        <View style={styles.errorRow}>
          <Text style={styles.error}>{sendError}</Text>
          {/* A permission failure is actionable, so offer the fix in place. */}
          {sendError.includes('Accessibility') ? (
            <Pressable
              style={styles.fixButton}
              onPress={() => {
                requestAccessibility().catch(() => {});
                openSystemSettings('accessibility');
              }}
            >
              <Text style={styles.fixButtonText}>Grant…</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {requests.length === 0 ? (
          <Text style={styles.emptyText}>
            No trade whispers yet. They appear the moment someone messages you about a
            listing.
          </Text>
        ) : (
          requests.map((entry) => (
            <Row
              key={entry.id}
              request={entry.request}
              done={entry.done}
              showReply={replyFor === entry.id}
              quickReplies={quickReplies}
              thanksMessage={thanksMessage}
              onToggleReply={() => setReplyFor(replyFor === entry.id ? null : entry.id)}
              onCommand={run}
              onDone={() => onDone(entry.id)}
              onDismiss={() => onDismiss(entry.id)}
            />
          ))
        )}
      </ScrollView>

      <Pressable style={styles.hideout} onPress={() => run(hideoutCommand())}>
        <Text style={styles.hideoutText}>Go to Hideout</Text>
      </Pressable>
    </View>
  );
}

function Row({
  request,
  done,
  showReply,
  quickReplies,
  thanksMessage,
  onToggleReply,
  onCommand,
  onDone,
  onDismiss,
}: {
  request: TradeRequest;
  done: boolean;
  showReply: boolean;
  quickReplies: readonly string[];
  thanksMessage: string;
  onToggleReply: () => void;
  onCommand: (command: { text: string }) => void;
  onDone: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={[styles.row, done && styles.rowDone]}>
      <View style={styles.rowHead}>
        <Text style={styles.character} numberOfLines={1}>
          {request.character}
        </Text>
        <Text style={styles.age}>{ageOf(request.receivedAt)}</Text>
      </View>
      <Text style={styles.summary} numberOfLines={2}>
        {describeRequest(request)}
      </Text>
      {request.kind === 'item' && request.stash !== null ? (
        <Text style={styles.stash} numberOfLines={1}>
          {request.stash.tab} · {request.stash.left},{request.stash.top}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Action label="Invite" onPress={() => onCommand(inviteCommand(request))} />
        <Action label="Trade" onPress={() => onCommand(tradeCommand(request))} />
        <Action
          label="Thanks"
          onPress={() => onCommand(thanksCommand(request, thanksMessage))}
        />
        <Action label="Kick" onPress={() => onCommand(kickCommand(request))} />
        <Action label={showReply ? 'Hide' : 'Reply'} onPress={onToggleReply} />
        <Action label={done ? 'Remove' : 'Done'} onPress={done ? onDismiss : onDone} />
      </View>

      {showReply ? (
        <View style={styles.replies}>
          {quickReplies.map((reply) => (
            <Pressable
              key={reply}
              style={styles.reply}
              onPress={() => onCommand(whisperCommand(request, reply))}
            >
              <Text style={styles.replyText} numberOfLines={1}>
                {reply}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  empty: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    lineHeight: 16,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  fixButton: {
    backgroundColor: glass.fill,
    borderColor: glass.hairline,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  fixButtonText: {
    color: colors.textPrimary,
    fontSize: typography.sizeCaption,
    fontWeight: '600',
  },
  error: {
    flex: 1,
    color: colors.danger,
    fontSize: typography.sizeCaption,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  row: {
    borderTopColor: glass.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  rowDone: { opacity: 0.45 },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  character: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
    fontWeight: '600',
    flex: 1,
  },
  age: {
    color: colors.textDisabled,
    fontSize: typography.sizeCaption,
  },
  summary: {
    color: colors.goldBright,
    fontSize: typography.sizeCaption,
    marginTop: 1,
  },
  stash: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: spacing.xs,
  },
  action: {
    backgroundColor: glass.fill,
    borderColor: glass.hairline,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  actionText: {
    color: colors.textPrimary,
    fontSize: typography.sizeCaption,
  },
  replies: {
    marginTop: spacing.xs,
    gap: 3,
  },
  reply: {
    backgroundColor: glass.fill,
    borderColor: glass.hairline,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  replyText: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
  },
  hideout: {
    margin: spacing.md,
    marginTop: 0,
    alignSelf: 'flex-start',
    backgroundColor: glass.fill,
    borderColor: glass.hairline,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  enable: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: glass.accent,
    borderColor: glass.accentBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  enableText: {
    color: colors.textPrimary,
    fontSize: typography.sizeCaption,
    fontWeight: '600',
  },
  hideoutText: {
    color: colors.textPrimary,
    fontSize: typography.sizeCaption,
  },
});
