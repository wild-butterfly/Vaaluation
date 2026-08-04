import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { borders, fonts, radii, spacing, surfaces, text, type } from '@vaaluation/ui';

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  // Micro-label: mono, uppercase, wide tracking, deliberately quiet. The
  // accent belongs on values and actions, not on every heading.
  title: {
    fontFamily: fonts.mono,
    color: text.faint,
    fontSize: type.label,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  body: {
    backgroundColor: surfaces.card,
    borderColor: surfaces.cardBorder,
    borderWidth: 1,
    borderTopColor: borders.rimLight,
    borderRadius: radii.card,
    padding: spacing.h1,
  },
});
