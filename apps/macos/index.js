import { AppRegistry } from 'react-native';
import { SettingsRoot } from './src/SettingsRoot';
import { OverlayRoot } from './src/overlay/OverlayRoot';

AppRegistry.registerComponent('VaaluationSettings', () => SettingsRoot);
AppRegistry.registerComponent('VaaluationOverlay', () => OverlayRoot);
