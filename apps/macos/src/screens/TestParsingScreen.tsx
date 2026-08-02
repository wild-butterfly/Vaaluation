import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, spacing, typography } from '@vaaluation/ui';
import { Section } from '../components/Section';

/**
 * Quick sanity checks on pasted text so users get immediate feedback even
 * before the full parser (Milestone 3) replaces the summary below.
 */
function summarize(text: string): {
  lines: number;
  sections: number;
  looksLikeItem: boolean;
} {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { lines: 0, sections: 0, looksLikeItem: false };
  }
  const lines = trimmed.split('\n').length;
  const sections = trimmed.split('\n--------\n').length;
  const looksLikeItem = /^Item Class: .+/m.test(trimmed) || /^Rarity: .+/m.test(trimmed);
  return { lines, sections, looksLikeItem };
}

export function TestParsingScreen() {
  const [text, setText] = useState('');
  const summary = useMemo(() => summarize(text), [text]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Test Clipboard Parsing">
        <Text style={styles.hint}>
          In Path of Exile, hover an item and press the game's copy shortcut, then paste
          the result here. This screen lets you exercise parsing without the game running.
        </Text>
        <TextInput
          style={styles.input}
          multiline
          value={text}
          onChangeText={setText}
          placeholder={'Item Class: …\nRarity: …\n…'}
          placeholderTextColor={colors.textDisabled}
        />
      </Section>

      <Section title="Result">
        {text.trim().length === 0 ? (
          <Text style={styles.hint}>Paste item text above to see the analysis.</Text>
        ) : summary.looksLikeItem ? (
          <View>
            <Text style={styles.value}>
              Recognized Path of Exile item text: {summary.lines} lines,{' '}
              {summary.sections} sections.
            </Text>
            <Text style={styles.hint}>
              Full structured parsing (rarity, modifiers, sockets, …) lands with the item
              parser in Milestone 3 and will render here.
            </Text>
          </View>
        ) : (
          <Text style={styles.warning}>
            This doesn't look like Path of Exile item text. Expected lines such as "Item
            Class: …" or "Rarity: …". Make sure you copied an item in the English game
            client.
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
    minHeight: 180,
    backgroundColor: colors.obsidian,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
    padding: spacing.md,
  },
  value: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
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
