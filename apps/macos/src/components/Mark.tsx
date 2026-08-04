import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@vaaluation/ui';

/**
 * The Vaaluation mark: a Vaal-orb silhouette with knocked-out eyes and a
 * V-shaped mouth, built from plain views rather than SVG so the app avoids a
 * rendering dependency for one small shape. The cut-outs are drawn in the
 * colour of whatever the mark sits on, exactly as the spec requires.
 */
export function Mark({ size = 26, on }: { size?: number; on: string }) {
  const theme = useTheme();
  const unit = size / 64;

  return (
    <View
      style={[
        styles.body,
        {
          width: size,
          height: size,
          borderRadius: size * 0.42,
          borderBottomLeftRadius: size * 0.5,
          borderBottomRightRadius: size * 0.5,
          backgroundColor: theme.accent,
        },
      ]}
    >
      {/* Eyes: angled slits knocked out of the body. */}
      <View
        style={[
          styles.eye,
          {
            backgroundColor: on,
            width: unit * 16,
            height: unit * 9,
            top: unit * 21,
            left: unit * 12,
            transform: [{ rotate: '18deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.eye,
          {
            backgroundColor: on,
            width: unit * 16,
            height: unit * 9,
            top: unit * 21,
            right: unit * 12,
            transform: [{ rotate: '-18deg' }],
          },
        ]}
      />
      {/* Mouth: the V of "Vaaluation", drawn as two knocked-out strokes. */}
      <View
        style={[
          styles.stroke,
          {
            backgroundColor: on,
            width: unit * 6.5,
            height: unit * 15,
            top: unit * 40,
            left: unit * 25,
            transform: [{ rotate: '-32deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.stroke,
          {
            backgroundColor: on,
            width: unit * 6.5,
            height: unit * 15,
            top: unit * 40,
            right: unit * 25,
            transform: [{ rotate: '32deg' }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { overflow: 'hidden' },
  eye: { position: 'absolute', borderRadius: 1 },
  stroke: { position: 'absolute' },
});
