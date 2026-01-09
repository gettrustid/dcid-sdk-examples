import React, { createContext, useContext, useEffect, useState } from 'react';
import { DCIDClient } from '@dcid/sdk';
import MetaKeep from 'metakeep-react-native-sdk';
import {
  DCID_APP_ID,
  DCID_SIGNING_APP_ID,
  DCID_ENCRYPTION_APP_ID,
  DCID_SIGNING_ENV,
  DCID_ENCRYPTION_ENV,
  DCID_API_URL,
  DCID_WS_URL,
} from '@env';
import { metaKeepBridge } from '../App';

interface DCIDContextType {
  client: DCIDClient | null;
  isAuthenticated: boolean;
  userEmail: string | null;
  isLoading: boolean;
  hasIdentity: boolean;
  isReady: boolean;
  refreshAuthState: () => void;
  checkIdentity: () => Promise<void>;
}

const DCIDContext = createContext<DCIDContextType | undefined>(undefined);

export function DCIDProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<DCIDClient | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasIdentity, setHasIdentity] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const refreshAuthState = async () => {
    if (client) {
      const authenticated = client.auth.isAuthenticated();
      setIsAuthenticated(authenticated);
      setUserEmail(client.auth.getUserEmail());

      // Set WebSocket token when authenticated
      if (authenticated && client.webSocket) {
        const token = await client.auth.getAccessToken();
        if (token) {
          client.webSocket.setJWTToken(token);
          console.log('[DCIDContext] WebSocket token set');
        }
      }
    }
  };

  const checkIdentity = async () => {
    if (!client || !isAuthenticated) {
      setHasIdentity(false);
      return;
    }

    try {
      // Use getExistingIdentity() to check without requiring a wallet
      const identity = await client.identity?.getExistingIdentity();
      setHasIdentity(!!identity?.did);
    } catch (error) {
      console.log('No existing identity found:', error);
      setHasIdentity(false);
    }
  };

  useEffect(() => {
    const initClient = async () => {
      try {
        console.log('[DCIDContext] Initializing DCID client with native MetaKeep SDK...');

        // Create client
        const dcidClient = new DCIDClient({
          appId: DCID_APP_ID || 'mobile-demo-app',
          platform: 'mobile',
          config: {
            appId: DCID_SIGNING_APP_ID || '',
            appIdEncryption: DCID_ENCRYPTION_APP_ID || '',
            env: (DCID_SIGNING_ENV as 'prod' | 'dev') || 'prod',
            envEncryption: (DCID_ENCRYPTION_ENV as 'prod' | 'dev') || 'dev',
          },
          apiUrl: DCID_API_URL || 'https://dev.trustid.life/api',
          wsUrl: DCID_WS_URL || 'wss://dev-identity.trustid.life/ws',
        });

        // Set native MkHSM SDK BEFORE initialize
        dcidClient.setMkHSM(MetaKeep);
        console.log('[DCIDContext] MkHSM native SDK set');

        // Initialize client
        await dcidClient.initialize();
        console.log('[DCIDContext] DCID client initialized');

        // Set WebView bridge for MetaKeep operations (decrypt for IPFS backup)
        dcidClient.setWebViewBridge(metaKeepBridge);
        console.log('[DCIDContext] MetaKeep WebView bridge set');

        setClient(dcidClient);
        setIsReady(true);

        const authenticated = dcidClient.auth.isAuthenticated();
        setIsAuthenticated(authenticated);
        setUserEmail(dcidClient.auth.getUserEmail());

        // Set WebSocket token if already authenticated
        if (authenticated && dcidClient.webSocket) {
          const token = await dcidClient.auth.getAccessToken();
          if (token) {
            dcidClient.webSocket.setJWTToken(token);
            console.log('[DCIDContext] WebSocket token initialized');
          }
        }
      } catch (error) {
        console.error('[DCIDContext] Failed to initialize DCID:', error);
        setIsReady(false);
      } finally {
        setIsLoading(false);
      }
    };

    initClient();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      checkIdentity();
    }
  }, [isAuthenticated, client]);

  return (
    <DCIDContext.Provider
      value={{
        client,
        isAuthenticated,
        userEmail,
        isLoading,
        hasIdentity,
        isReady,
        refreshAuthState,
        checkIdentity,
      }}
    >
      {children}
    </DCIDContext.Provider>
  );
}

export function useDCID() {
  const context = useContext(DCIDContext);
  if (context === undefined) {
    throw new Error('useDCID must be used within a DCIDProvider');
  }
  return context;
}
