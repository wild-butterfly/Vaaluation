import { NativeModules } from 'react-native';

interface VLOverlayNative {
  setContentHeight(height: number): void;
}

const native = NativeModules.VLOverlay as VLOverlayNative;

/**
 * Reports how tall the overlay's content actually is, so the panel can shrink
 * to fit instead of leaving empty space below a short list.
 */
export function setOverlayContentHeight(height: number): void {
  native.setContentHeight(Math.round(height));
}
