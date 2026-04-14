/**
 * React Native App Entry Point
 *
 * The SDK shim provides all necessary polyfills for React Native.
 * It must be imported FIRST, before any other imports.
 *
 * NOTE: WebAssembly is NOT polyfilled here. Instead, the SDK uses:
 * - WebView for witness calculation (WebKit has native WebAssembly)
 * - react-native-rapidsnark for proof generation (native C++)
 */

// Import SDK polyfills shim
import '../../dcid-sdk/src/polyfills/shim';

import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
