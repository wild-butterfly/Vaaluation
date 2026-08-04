import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '@vaaluation/ui';
import { Section } from '../components/Section';

const REPO_URL = 'https://github.com/wild-butterfly/Vaaluation';

export function AboutScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.appName}>Vaaluation</Text>
      <Text style={styles.tagline}>Item price checking for Path of Exile on macOS.</Text>

      <Section title="Project">
        <Text style={styles.body}>
          Vaaluation is free and open source under the MIT license. No accounts, no
          telemetry, no paid features.
        </Text>
        <Pressable onPress={() => Linking.openURL(REPO_URL)}>
          <Text style={styles.link}>{REPO_URL}</Text>
        </Pressable>
      </Section>

      <Section title="Disclaimer">
        <Text style={styles.body}>
          This product isn't affiliated with or endorsed by Grinding Gear Games in any
          way.
        </Text>
        <Text style={[styles.body, styles.spacer]}>
          Vaaluation is an independent community project and is not affiliated with or
          endorsed by Grinding Gear Games.
        </Text>
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
  appName: {
    color: colors.textPrimary,
    fontSize: typography.sizeHeading,
    fontWeight: '700',
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: typography.sizeBody,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  body: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
    lineHeight: 19,
  },
  spacer: {
    marginTop: spacing.md,
  },
  link: {
    color: colors.goldBright,
    fontSize: typography.sizeBody,
    marginTop: spacing.md,
  },
});
