import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@vaaluation/ui';
import { useSettings } from '../state/SettingsContext';

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { update } = useSettings();

  const steps = [
    {
      title: 'Vaaluation lives in your menu bar',
      body: 'There is no Dock icon. Click the scales icon in the menu bar to open settings, test parsing, or view logs.',
    },
    {
      title: 'Price check with a shortcut',
      body: 'Hover an item in Path of Exile and press ⌃D. Vaaluation copies the item (a single keystroke, exactly as if you pressed the game’s copy binding), parses it, and shows comparable listings.',
    },
    {
      title: 'One permission, explained',
      body: 'Sending that single keystroke requires the macOS Accessibility permission. Vaaluation will ask for it when the hotkey engine is enabled, and never requests Screen Recording or Input Monitoring.',
    },
    {
      title: 'Private by design',
      body: 'No telemetry, no accounts. Network requests go only to official Path of Exile services, and your clipboard is never recorded or uploaded.',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Welcome to Vaaluation</Text>
      {steps.map((step) => (
        <View key={step.title} style={styles.step}>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.stepBody}>{step.body}</Text>
        </View>
      ))}
      <Pressable
        style={styles.button}
        onPress={() => {
          update({ onboardingCompleted: true });
          onDone();
        }}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    maxWidth: 560,
    alignSelf: 'center',
  },
  heading: {
    color: colors.textPrimary,
    fontSize: typography.sizeHeading,
    fontWeight: '700',
    marginBottom: spacing.xl,
  },
  step: {
    marginBottom: spacing.lg,
    backgroundColor: colors.charcoal,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  stepTitle: {
    color: colors.goldBright,
    fontSize: typography.sizeTitle,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  stepBody: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
    lineHeight: 19,
  },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.vaalRed,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: typography.sizeTitle,
    fontWeight: '600',
  },
});
