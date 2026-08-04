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
import { colors, radii, spacing, typography } from '@vaaluation/ui';
import { useSettings } from '../state/SettingsContext';
import { useTradeRequests } from '../hooks/useTradeRequests';
import { sendChatCommand, simulateWhisper } from '../native/VLTrade';

/**
 * A line in the game's own wording, timestamped now. Used only by the test
 * button below — the format matches the real whisper captured in the parser
 * fixtures, so a passing simulation means a real one will parse too.
 */
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
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function TradeScreen() {
  const { settings, update } = useSettings();
  const enabled = settings.tradeWhispersEnabled;
  const { requests, error, watching, markDone, dismiss, clear } =
    useTradeRequests(enabled);
  const [lastError, setLastError] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);

  const run = useCallback((command: { text: string }) => {
    setLastError(null);
    sendChatCommand(command.text).catch((cause: unknown) => {
      setLastError(cause instanceof Error ? cause.message : 'Could not send command.');
    });
  }, []);

  const incoming = requests.filter((entry) => entry.request.direction === 'incoming');
  const outgoing = requests.filter((entry) => entry.request.direction === 'outgoing');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Trade Requests</Text>
          <Text style={styles.hint}>
            {enabled
              ? watching
                ? 'Watching the client log for trade whispers.'
                : 'Starting…'
              : 'Turn on to see incoming trade whispers.'}
          </Text>
        </View>
        <Pressable
          style={[styles.button, enabled && styles.buttonActive]}
          onPress={() => update({ tradeWhispersEnabled: !enabled })}
        >
          <Text style={styles.buttonText}>{enabled ? 'On' : 'Off'}</Text>
        </Pressable>
      </View>

      <Text style={styles.privacy}>
        Vaaluation reads the game's log only from the moment you switch this on, keeps
        only messages matching the game's trade-whisper format, and discards all other
        chat immediately. Nothing is uploaded, and each button below sends exactly one
        chat command — the same one you would type yourself. "Simulate a whisper" injects
        a test request through the same path a real one takes, so you can try the flow
        without a second player; it writes nothing to the game's log.
      </Text>

      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      {lastError !== null ? <Text style={styles.error}>{lastError}</Text> : null}

      {enabled ? (
        <>
          <View style={styles.utilityRow}>
            <Pressable style={styles.button} onPress={() => run(hideoutCommand())}>
              <Text style={styles.buttonText}>Go to Hideout</Text>
            </Pressable>
            {requests.length > 0 ? (
              <Pressable style={styles.button} onPress={clear}>
                <Text style={styles.buttonText}>Clear list</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.button}
              onPress={() => {
                simulateWhisper(sampleWhisperLine()).catch(() => {});
              }}
            >
              <Text style={styles.buttonText}>Simulate a whisper</Text>
            </Pressable>
          </View>

          <Section title={`Incoming (${incoming.length})`}>
            {incoming.length === 0 ? (
              <Text style={styles.hint}>
                No trade whispers yet. They appear here the moment someone messages you
                about a listing.
              </Text>
            ) : (
              incoming.map((entry) => (
                <RequestRow
                  key={entry.id}
                  request={entry.request}
                  done={entry.done}
                  showReply={replyFor === entry.id}
                  onToggleReply={() =>
                    setReplyFor(replyFor === entry.id ? null : entry.id)
                  }
                  onCommand={run}
                  quickReplies={settings.quickReplies}
                  thanksMessage={settings.thanksMessage}
                  onDone={() => markDone(entry.id)}
                  onDismiss={() => dismiss(entry.id)}
                />
              ))
            )}
          </Section>

          {outgoing.length > 0 ? (
            <Section title={`Outgoing (${outgoing.length})`}>
              {outgoing.map((entry) => (
                <RequestRow
                  key={entry.id}
                  request={entry.request}
                  done={entry.done}
                  showReply={replyFor === entry.id}
                  onToggleReply={() =>
                    setReplyFor(replyFor === entry.id ? null : entry.id)
                  }
                  onCommand={run}
                  quickReplies={settings.quickReplies}
                  thanksMessage={settings.thanksMessage}
                  onDone={() => markDone(entry.id)}
                  onDismiss={() => dismiss(entry.id)}
                />
              ))}
            </Section>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function RequestRow({
  request,
  done,
  showReply,
  onToggleReply,
  onCommand,
  quickReplies,
  thanksMessage,
  onDone,
  onDismiss,
}: {
  request: TradeRequest;
  done: boolean;
  showReply: boolean;
  onToggleReply: () => void;
  onCommand: (command: { text: string }) => void;
  quickReplies: readonly string[];
  thanksMessage: string;
  onDone: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={[styles.request, done && styles.requestDone]}>
      <View style={styles.requestHeader}>
        <Text style={styles.character} numberOfLines={1}>
          {request.character}
        </Text>
        <Text style={styles.age}>{ageOf(request.receivedAt)}</Text>
      </View>
      <Text style={styles.summary} numberOfLines={2}>
        {describeRequest(request)}
      </Text>
      {request.kind === 'item' && request.stash !== null ? (
        <Text style={styles.stash}>
          Tab “{request.stash.tab}” · left {request.stash.left}, top {request.stash.top}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={styles.action}
          onPress={() => onCommand(inviteCommand(request))}
        >
          <Text style={styles.actionText}>Invite</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => onCommand(tradeCommand(request))}>
          <Text style={styles.actionText}>Trade</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => onCommand(kickCommand(request))}>
          <Text style={styles.actionText}>Kick</Text>
        </Pressable>
        <Pressable
          style={styles.action}
          onPress={() => onCommand(thanksCommand(request, thanksMessage))}
        >
          <Text style={styles.actionText}>Thanks</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={onToggleReply}>
          <Text style={styles.actionText}>Reply</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={done ? onDismiss : onDone}>
          <Text style={styles.actionText}>{done ? 'Remove' : 'Done'}</Text>
        </Pressable>
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
  privacy: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    lineHeight: 16,
    marginBottom: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: typography.sizeCaption,
    marginBottom: spacing.sm,
  },
  utilityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    color: colors.goldBright,
    fontSize: typography.sizeTitle,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  request: {
    backgroundColor: colors.charcoal,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  requestDone: { opacity: 0.5 },
  requestHeader: {
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
    fontSize: typography.sizeBody,
    marginTop: 2,
  },
  stash: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  action: {
    backgroundColor: colors.obsidian,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  actionText: {
    color: colors.textPrimary,
    fontSize: typography.sizeCaption,
  },
  replies: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  reply: {
    backgroundColor: colors.obsidian,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  replyText: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
  },
  button: {
    backgroundColor: colors.obsidian,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  buttonActive: {
    backgroundColor: colors.vaalRed,
    borderColor: colors.vaalRedBright,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
  },
});
