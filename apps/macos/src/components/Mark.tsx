import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '@vaaluation/ui';

/**
 * The Vaaluation mark: a Vaal-orb silhouette with knocked-out eyes and a
 * V-shaped mouth that doubles as the V of the name. Original geometry, not a
 * trace of the game's own art.
 *
 * The cut-outs are painted in the colour of whatever the mark sits on, so
 * `on` must match the surface behind it.
 */
export function Mark({ size = 26, on }: { size?: number; on: string }) {
  const theme = useTheme();
  const gradientId = `vl-mark-${size}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={gradientId} x1="20%" y1="0%" x2="80%" y2="100%">
          <Stop offset="0%" stopColor="#cf1f2d" />
          <Stop offset="58%" stopColor={theme.accent} />
          <Stop offset="100%" stopColor="#4c0812" />
        </LinearGradient>
      </Defs>

      <Path
        d="M32 5 C46 5 55 13 55 26 C55 39 47 49 40 55 C36 58.5 33.5 61 32 61 C30.5 61 28 58.5 24 55 C17 49 9 39 9 26 C9 13 18 5 32 5 Z"
        fill={`url(#${gradientId})`}
      />

      {/* Eyes, knocked out of the body. */}
      <Path d="M15.5 21.5 L29.5 26 L26 36 L13.5 30.5 Z" fill={on} />
      <Path d="M48.5 21.5 L34.5 26 L38 36 L50.5 30.5 Z" fill={on} />

      {/* Mouth — also the V of "Vaaluation". */}
      <Path
        d="M25 42 L32 53 L39 42"
        stroke={on}
        strokeWidth={6.5}
        strokeLinejoin="miter"
        fill="none"
      />
    </Svg>
  );
}
