import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { parseItemText } from '@vaaluation/item-parser';
import type { ParsedItem } from '@vaaluation/shared-types';
import { colors, radii, spacing, typography } from '@vaaluation/ui';
import { useTheme } from '@vaaluation/ui';
import { Section } from '../components/Section';
import { readClipboardText } from '../native/VLClipboard';
import { onItemCopied } from '../native/VLEvents';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function describeSockets(item: ParsedItem): string | null {
  if (item.kind !== 'equipment' || item.sockets === undefined) return null;
  const groups = item.sockets.groups.map((group) => group.sockets.join('-')).join(' ');
  return `${groups} (${item.sockets.total} sockets, ${item.sockets.maxLinks}-link)`;
}

function ParsedItemView({ item }: { item: ParsedItem }) {
  const socketText = describeSockets(item);
  return (
    <View>
      <Row label="Kind" value={item.kind} />
      <Row label="Item class" value={item.itemClass} />

      {item.kind === 'currency' || item.kind === 'divinationCard' ? (
        <>
          <Row label="Name" value={item.name} />
          {item.stackSize ? (
            <Row
              label="Stack size"
              value={`${item.stackSize.current}/${item.stackSize.max}`}
            />
          ) : null}
        </>
      ) : null}

      {item.kind === 'gem' ? (
        <>
          <Row label="Name" value={item.name} />
          <Row label="Level" value={String(item.level)} />
          <Row label="Quality" value={`${item.quality}%`} />
          <Row label="Corrupted" value={item.corrupted ? 'Yes' : 'No'} />
        </>
      ) : null}

      {item.kind === 'equipment' || item.kind === 'map' ? (
        <>
          <Row label="Rarity" value={item.rarity} />
          <Row label="Name" value={item.name} />
          <Row label="Base type" value={item.baseType} />
          <Row label="Identified" value={item.identified ? 'Yes' : 'No'} />
          <Row label="Corrupted" value={item.corrupted ? 'Yes' : 'No'} />
          {item.itemLevel !== undefined ? (
            <Row label="Item level" value={String(item.itemLevel)} />
          ) : null}
          {item.quality !== undefined ? (
            <Row label="Quality" value={`${item.quality}%`} />
          ) : null}
          {item.kind === 'map' && item.mapTier !== undefined ? (
            <Row label="Map tier" value={String(item.mapTier)} />
          ) : null}
          {socketText !== null ? <Row label="Sockets" value={socketText} /> : null}
          {item.kind === 'equipment' && item.influences.length > 0 ? (
            <Row label="Influences" value={item.influences.join(', ')} />
          ) : null}
          {item.kind === 'equipment' && item.fractured ? (
            <Row label="Fractured" value="Yes" />
          ) : null}

          {item.modifiers.length > 0 ? (
            <View style={styles.modBlock}>
              <Text style={styles.modHeading}>Modifiers</Text>
              {item.modifiers.map((mod, index) => (
                <View key={index}>
                  <Text style={styles.modLine}>
                    {mod.text}
                    {mod.type !== 'explicit' ? (
                      <Text style={styles.modTag}> ({mod.type})</Text>
                    ) : null}
                    {mod.range ? (
                      <Text style={styles.modTag}>
                        {' '}
                        [{mod.range.min}–{mod.range.max}]
                      </Text>
                    ) : null}
                  </Text>
                  {mod.annotation ? (
                    <Text style={styles.modAnnotation}>
                      {mod.annotation.affix} “{mod.annotation.name}”
                      {mod.annotation.tier !== undefined
                        ? ` · tier ${mod.annotation.tier}`
                        : ''}
                      {mod.annotation.tags.length > 0
                        ? ` · ${mod.annotation.tags.join(', ')}`
                        : ''}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {item.unknownLines.length > 0 ? (
        <View style={styles.modBlock}>
          <Text style={styles.modHeading}>Preserved (unparsed) lines</Text>
          {item.unknownLines.map((line, index) => (
            <Text key={index} style={styles.unknownLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function TestParsingScreen() {
  const theme = useTheme();
  const [text, setText] = useState('');
  const result = useMemo(() => parseItemText(text), [text]);

  // A successful in-game price check fills this screen automatically until
  // the overlay ships in Milestone 4.
  useEffect(() => onItemCopied(({ text: copied }) => setText(copied)), []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Test Clipboard Parsing">
        <Text style={styles.hint}>
          In Path of Exile, hover an item and press the game's copy shortcut, then paste
          the result here — or copy an item anywhere and use "Read Clipboard". No game
          required.
        </Text>
        <TextInput
          style={styles.input}
          multiline
          value={text}
          onChangeText={setText}
          placeholder={'Item Class: …\nRarity: …\n…'}
          placeholderTextColor={colors.textDisabled}
        />
        <View style={styles.toolbar}>
          <Pressable
            style={styles.button}
            onPress={() => {
              readClipboardText()
                .then((clipboard) => setText(clipboard ?? ''))
                .catch(() => {});
            }}
          >
            <Text style={styles.buttonText}>Read Clipboard</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => setText('')}>
            <Text style={styles.buttonText}>Clear</Text>
          </Pressable>
        </View>
      </Section>

      <Section title="Result">
        {text.trim().length === 0 ? (
          <Text style={styles.hint}>Paste item text above to see the parsed result.</Text>
        ) : result.ok ? (
          <ParsedItemView item={result.item} />
        ) : (
          <Text style={[styles.warning, { color: theme.accentText }]}>
            {result.message}
          </Text>
        )}
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
  input: {
    marginTop: spacing.md,
    minHeight: 160,
    backgroundColor: colors.obsidian,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
    padding: spacing.md,
  },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  button: {
    backgroundColor: colors.obsidian,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizeBody,
  },
  rowValue: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
    flexShrink: 1,
    textAlign: 'right',
  },
  modBlock: {
    marginTop: spacing.md,
  },
  modHeading: {
    color: colors.goldBright,
    fontSize: typography.sizeBody,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  modLine: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
    paddingVertical: 1,
  },
  modTag: {
    color: colors.textSecondary,
  },
  modAnnotation: {
    color: colors.textDisabled,
    fontSize: typography.sizeCaption,
    paddingBottom: 2,
  },
  unknownLine: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    paddingVertical: 1,
  },
  warning: {
    color: colors.warning,
    fontSize: typography.sizeBody,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
  },
});
