import React, { useEffect, useState, useCallback } from 'react';
import { StatusBar, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { DCIDProvider } from './contexts/DCIDContext';
import { AppNavigator } from './navigation/AppNavigator';
import { getWitnessWebView, WebViewBridge, createMkHSMWebView } from '@dcid/sdk';

// Create a global bridge instance for MkHSM WebView operations (decrypt, etc.)
export const metaKeepBridge = new WebViewBridge({ debug: true });

function App(): React.JSX.Element {
  const [WitnessWebView, setWitnessWebView] = useState<React.ComponentType | null>(null);
  const [metaKeepWebViewConfig, setMetaKeepWebViewConfig] = useState<{
    html: string;
    onMessage: (event: { nativeEvent: { data: string } }) => void;
    setWebViewRef: (ref: any) => void;
  } | null>(null);
  // Track when MetaKeep WebView needs to be visible (for user consent dialogs)
  const [metaKeepVisible, setMetaKeepVisible] = useState(false);

  // Handle MetaKeep visibility changes
  const handleMetaKeepVisibility = useCallback((visible: boolean) => {
    console.log('[App] MetaKeep visibility:', visible);
    setMetaKeepVisible(visible);
  }, []);

  // Load the WitnessWebView component for ZK proof generation
  useEffect(() => {
    getWitnessWebView()
      .then((component) => {
        console.log('[App] WitnessWebView loaded');
        setWitnessWebView(() => component);
      })
      .catch((err) => {
        console.error('[App] Failed to load WitnessWebView:', err);
      });

    // Set up visibility callback on the bridge
    metaKeepBridge.setVisibilityCallback(handleMetaKeepVisibility);

    // Create MkHSM WebView config for decrypt operations
    const config = createMkHSMWebView(metaKeepBridge, { debug: true });
    setMetaKeepWebViewConfig(config);
    console.log('[App] MkHSM WebView configured');
  }, [handleMetaKeepVisibility]);

  return (
    <>
      {/* Hidden WebView for ZK witness calculation - must be outside SafeAreaProvider */}
      {WitnessWebView && (
        <View style={styles.hiddenWebView} pointerEvents="none">
          <WitnessWebView />
        </View>
      )}

      {/* MetaKeep WebView for decrypt operations - visible when consent needed */}
      {metaKeepWebViewConfig && (
        <View
          style={metaKeepVisible ? styles.visibleWebView : styles.hiddenWebView}
          pointerEvents={metaKeepVisible ? 'auto' : 'none'}
        >
          <WebView
            source={{ html: metaKeepWebViewConfig.html }}
            onMessage={metaKeepWebViewConfig.onMessage}
            ref={metaKeepWebViewConfig.setWebViewRef}
            javaScriptEnabled={true}
            originWhitelist={['*']}
          />
        </View>
      )}

      <SafeAreaProvider>
        <NavigationContainer>
          <DCIDProvider>
            <StatusBar barStyle="dark-content" />
            <AppNavigator />
          </DCIDProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </>
  );
}

const styles = StyleSheet.create({
  hiddenWebView: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
    zIndex: -1,
  },
  visibleWebView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: 'white',
  },
});

export default App;
