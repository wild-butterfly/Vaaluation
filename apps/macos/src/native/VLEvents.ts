import { NativeEventEmitter, NativeModules } from 'react-native';

export type AppRoute = 'onboarding' | 'settings' | 'test-parsing' | 'logs' | 'about';

const VALID_ROUTES: readonly AppRoute[] = [
  'onboarding',
  'settings',
  'test-parsing',
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
