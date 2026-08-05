import { NativeEventEmitter, NativeModules } from 'react-native';

export type AppRoute =
  | 'onboarding'
  | 'price-check'
  | 'trade'
  | 'currency'
  | 'history'
  | 'settings'
  | 'logs'
  | 'about';

const VALID_ROUTES: readonly AppRoute[] = [
  'onboarding',
  'price-check',
  'trade',
  'currency',
  'history',
  'settings',
  'logs',
  'about',
];

export function isAppRoute(value: unknown): value is AppRoute {
  return typeof value === 'string' && (VALID_ROUTES as readonly string[]).includes(value);
}

const emitter = new NativeEventEmitter(NativeModules.VLEvents);

export function onNavigate(handler: (route: AppRoute) => void): () => void {
  const subscription = emitter.addListener('vl:navigate', (payload: unknown) => {
    const route = (payload as { route?: unknown } | null)?.route;
    if (isAppRoute(route)) {
      handler(route);
    }
  });
  return () => subscription.remove();
}

/** Fired when a registered global hotkey is pressed anywhere in macOS. */
export function onHotkey(handler: (action: string) => void): () => void {
  const subscription = emitter.addListener('vl:hotkey', (payload: unknown) => {
    const action = (payload as { action?: unknown } | null)?.action;
    if (typeof action === 'string') {
      handler(action);
    }
  });
  return () => subscription.remove();
}

/** Fired after a price-check hotkey successfully captured item text. */
export function onItemCopied(
  handler: (payload: { text: string; persistent: boolean }) => void,
): () => void {
  const subscription = emitter.addListener('vl:item-copied', (payload: unknown) => {
    const data = payload as { text?: unknown; persistent?: unknown } | null;
    if (data !== null && typeof data?.text === 'string') {
      handler({ text: data.text, persistent: data.persistent === true });
    }
  });
  return () => subscription.remove();
}

/** Fired when a buy request should bring the Trades view forward. */
export function onShowTrades(handler: () => void): () => void {
  const subscription = emitter.addListener('vl:show-trades', () => handler());
  return () => subscription.remove();
}

/** Fired when permission state may have changed (the app became active). */
export function onPermissionsChanged(
  handler: (status: { accessibility: string; inputMonitoring: string }) => void,
): () => void {
  const subscription = emitter.addListener('vl:permissions', (payload: unknown) => {
    const status = payload as {
      accessibility?: unknown;
      inputMonitoring?: unknown;
    } | null;
    if (
      status !== null &&
      typeof status?.accessibility === 'string' &&
      typeof status.inputMonitoring === 'string'
    ) {
      handler({
        accessibility: status.accessibility,
        inputMonitoring: status.inputMonitoring,
      });
    }
  });
  return () => subscription.remove();
}
