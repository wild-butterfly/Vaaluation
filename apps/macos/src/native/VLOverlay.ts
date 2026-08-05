import { NativeModules } from 'react-native';

interface VLOverlayNative {
  setContentHeight(height: number): void;
  hide(): void;
  beginDrag(): void;
  setPinned(pinned: boolean): void;
}

const native = NativeModules.VLOverlay as VLOverlayNative;

/**
 * Reports how tall the overlay's content actually is, so the panel can shrink
 * to fit instead of leaving empty space below a short list.
 */
export function setOverlayContentHeight(height: number): void {
  native.setContentHeight(Math.round(height));
}

/** Closes the overlay, same as pressing Escape. */
export function hideOverlay(): void {
  native.hide();
}

/**
 * Keeps the panel on screen through clicks elsewhere, or lets it dismiss
 * again. A trade takes several deliberate clicks, so the panel has to be able
 * to stay put without price-checking again to get there.
 */
export function setOverlayPinned(pinned: boolean): void {
  native.setPinned(pinned);
}

/**
 * Hands the current press to AppKit to drag the panel with.
 *
 * Call this from a press on the panel's chrome — never from a control, since
 * AppKit runs its own event loop until the mouse comes up and the control
 * would never see the click.
 */
export function beginOverlayDrag(): void {
  native.beginDrag();
}
