import React, { createContext, useContext, useEffect, useState } from 'react';
import { DCIDClient, CircuitStorageInstance } from '@dcid/sdk';
import { MetaKeep } from 'metakeep';

interface DCIDContextType {
  client: DCIDClient | null;
  isAuthenticated: boolean;
  userEmail: string | null;
  isLoading: boolean;
  hasIdentity: boolean;
  refreshAuthState: (loginEmail?: string) => void;
  checkIdentity: () => Promise<void>;
}

const DCIDContext = createContext<DCIDContextType | undefined>(undefined);

export function DCIDProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<DCIDClient | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasIdentity, setHasIdentity] = useState(false);

  const refreshAuthState = (loginEmail?: string) => {
    if (client) {
      setIsAuthenticated(client.auth.isAuthenticated());
      const persistedEmail = loginEmail || (typeof window !== 'undefined' ? localStorage.getItem('dcid_user_email') : null);
      if (loginEmail) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('dcid_user_email', loginEmail);
        }
        setUserEmail(loginEmail);
      } else if (persistedEmail) {
        setUserEmail(persistedEmail);
      } else {
        setUserEmail(null);
      }
    }
  };

  const checkIdentity = async () => {
    if (!client || !isAuthenticated) {
      setHasIdentity(false);
      return;
    }

    try {
      const email =
        userEmail || (typeof window !== 'undefined' ? localStorage.getItem('dcid_user_email') : null);
      if (!email) {
        setHasIdentity(false);
        return;
      }

      if (!client.identity) {
        setHasIdentity(false);
        return;
      }

      const identity = await client.identity.getExistingIdentity();
      setHasIdentity(!!identity?.did);
    } catch (error) {
      setHasIdentity(false);
    }
  };

  useEffect(() => {
    const waitForMetaKeep = async (): Promise<void> => {
      // Prefer bundled MetaKeep (no CDN). If not already on window, attach the imported class.
      if (typeof window !== 'undefined' && !('MetaKeep' in window)) {
        (window as any).MetaKeep = MetaKeep;
      }
      if (typeof (window as any).MetaKeep === 'undefined') {
        throw new Error('MetaKeep SDK not available');
      }
    };

    const initClient = async () => {
      try {
        // Wait for MetaKeep SDK to load
        console.log('Waiting for MetaKeep SDK to load...');
        await waitForMetaKeep();
        console.log('MetaKeep SDK loaded successfully');

        const dcidClient = new DCIDClient({
          platform: 'web',
          appId: import.meta.env.VITE_DCID_APP_ID,
          config: {
            appId: import.meta.env.VITE_DCID_SIGNING_APP_ID,
            appIdEncryption: import.meta.env.VITE_DCID_ENCRYPTION_APP_ID,
            env: 'prod', // Match extension - hardcode to prod
            envEncryption: 'dev' // Encryption uses dev
          },
          apiUrl: import.meta.env.VITE_DCID_API_URL
        });

        await dcidClient.initialize();

        // Preload circuits to ensure WASM availability for proofs
        try {
          await CircuitStorageInstance.getCircuitStorage();
          console.log('Circuits preloaded for web');
        } catch (err) {
          console.warn('Failed to preload circuits:', err);
        }

        // Initialize analytics session
        if (dcidClient.analytics) {
          try {
            await dcidClient.analytics.trackSessionStart();
            console.log('Analytics session started');
          } catch (error) {
            console.warn('Failed to start analytics session:', error);
          }
        }

        setClient(dcidClient);
        setIsAuthenticated(dcidClient.auth.isAuthenticated());
        const persistedEmail = typeof window !== 'undefined' ? localStorage.getItem('dcid_user_email') : null;
        setUserEmail(persistedEmail);
      } catch (error) {
        console.error('Failed to initialize DCID:', error);
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
  }, [isAuthenticated, client, userEmail]);

  return (
    <DCIDContext.Provider
      value={{
        client,
        isAuthenticated,
        userEmail,
        isLoading,
        hasIdentity,
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
