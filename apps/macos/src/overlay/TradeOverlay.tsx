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
import {
  colors,
  fonts,
  glass,
  radii,
  semantic,
  spacing,
  text as palette,
  typography,
} from '@vaaluation/ui';
import type { TrackedRequest } from '../hooks/useTradeRequests';
import { sendChatCommand, simulateWhisper } from '../native/VLTrade';
import { openSystemSettings, requestAccessibility } from '../native/VLPermissions';
import { usePermissions } from '../hooks/usePermissions';

/** A line in the game's own wording, for the test button below. */
function sampleWhisperLine(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return (
    `${stamp} 1000000 abcdef12 [INFO Client 1000] @From TestBuyer: ` +
    'Hi, I would like to buy your Limbsplit, Woodsplitter listed for 1 regal ' +
    'in Allflame (stash tab "~price 1 regal"; position: left 11, top 1)'
  );
}

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
  onContentHeight,
}: {
  requests: readonly TrackedRequest[];
  enabled: boolean;
  error: string | null;
  quickReplies: readonly string[];
  thanksMessage: string;
  onEnable: () => void;
  onDone: (id: string) => void;
  onContentHeight: (height: number) => void;
}) {
  const { status } = usePermissions();
  const needsPermission = status !== null && status.accessibility !== 'granted';
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  /**
   * The footer is part of what this tab occupies, so it reports its own
   * height rather than leaving the shell to assume one.
   */
  const [footerHeight, setFooterHeight] = useState(40);

  const run = useCallback((command: { text: string }) => {
    setSendError(null);
    sendChatCommand(command.text).catch((cause: unknown) => {
      setSendError(cause instanceof Error ? cause.message : 'Could not send command.');
    });
  }, []);

  if (!enabled) {
    return (
      <View
        style={styles.empty}
        onLayout={(event) => onContentHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.waitingRow}>
          <View style={[styles.live, styles.liveOff]} />
          <Text style={styles.waitingLabel}>Not watching</Text>
        </View>
        <Text style={styles.waitingText}>
          Buy requests can be listed here, with one press to invite, trade and thank the
          buyer.
        </Text>
        <Text style={styles.fineprint}>
          Vaaluation reads the game's chat log from the moment you switch this on, keeps
          only lines matching its trade-whisper wording, and discards the rest. Nothing
          is uploaded, and the game's own options need no change.
        </Text>
        <Pressable style={styles.enable} onPress={onEnable}>
          <Text style={styles.enableText}>Watch for trade whispers</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stated before anything is attempted: waiting for a button to fail
          first is a poor way to learn the buttons cannot work yet. */}
      {needsPermission ? (
        <View style={styles.errorRow}>
          <Text style={styles.error}>
            Buttons need Accessibility permission to send chat commands.
          </Text>
          <Pressable
            style={styles.fixButton}
            onPress={() => {
              requestAccessibility().catch(() => {});
              openSystemSettings('accessibility');
            }}
          >
            <Text style={styles.fixButtonText}>Grant…</Text>
          </Pressable>
        </View>
      ) : null}

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
        onContentSizeChange={(_width, height) => onContentHeight(height + footerHeight)}
      >
        {requests.length === 0 ? (
          <View style={styles.waiting}>
            <View style={styles.waitingRow}>
              <View style={styles.live} />
              <Text style={styles.waitingLabel}>Watching chat</Text>
            </View>
            <Text style={styles.waitingText}>
              Buy requests appear here the moment someone messages you about a listing,
              with one press to invite, trade and thank them.
            </Text>
          </View>
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
            />
          ))
        )}
      </ScrollView>

      <View
        style={styles.footer}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      >
        <Pressable style={styles.hideout} onPress={() => run(hideoutCommand())}>
          <Text style={styles.hideoutText}>Go to Hideout</Text>
        </Pressable>
        <Pressable
          style={styles.hideout}
          onPress={() => {
            simulateWhisper(sampleWhisperLine()).catch(() => {});
          }}
        >
          <Text style={styles.hideoutText}>Test request</Text>
        </Pressable>
      </View>
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
}: {
  request: TradeRequest;
  done: boolean;
  showReply: boolean;
  quickReplies: readonly string[];
  thanksMessage: string;
  onToggleReply: () => void;
  onCommand: (command: { text: string }) => void;
  onDone: () => void;
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
      {/* The raw whisper, so the user can see exactly what was said. */}
      <View style={styles.whisperStrip}>
        <Text style={styles.whisperLabel}>wtb</Text>
        <Text style={styles.whisperText} numberOfLines={2}>
          {request.raw}
        </Text>
      </View>
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
        <Action label="Done" onPress={onDone} />
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
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  liveOff: { backgroundColor: palette.disabled },
  // The privacy note earns its place but not the reader's first attention.
  fineprint: {
    fontFamily: fonts.sans,
    color: palette.faint,
    fontSize: 11,
    lineHeight: 15,
  },
  emptyText: {
    fontFamily: fonts.sans,
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 17,
  },
  // The empty state carries most of this tab's first impression, so it says
  // what the app is doing right now before explaining what will happen.
  waiting: { paddingHorizontal: spacing.sm, paddingVertical: spacing.md, gap: spacing.sm },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  live: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: semantic.up,
  },
  waitingLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.dim,
  },
  waitingText: {
    fontFamily: fonts.sans,
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 17,
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
  whisperStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.34)',
    borderRadius: radii.keycap,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  whisperLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: '#4d4842',
  },
  whisperText: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: palette.dim,
  },
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
  doneAction: {
    marginLeft: 'auto',
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  doneText: { color: semantic.up, fontWeight: '600' },
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  hideout: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderRadius: radii.field,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 5,
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
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: '#e2d8d2',
  },
});
