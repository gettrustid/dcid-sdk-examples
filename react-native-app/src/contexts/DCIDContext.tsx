import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { DCIDClient } from '@dcid/sdk';
import { Passkey } from 'react-native-passkey';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const LOCAL_PASSKEY_KEY = 'dcid_local_passkey_id';

interface PasskeyInfo {
  id: string;
  device_type: string;
  backed_up: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface TotpSetupData {
  secret: string;
  qrCode: string;
  otpauthUrl: string;
}

interface BackupCodesStatus {
  total: number;
  used: number;
  remaining: number;
}

interface DCIDContextType {
  client: DCIDClient | null;
  isAuthenticated: boolean;
  userEmail: string | null;
  isLoading: boolean;
  hasIdentity: boolean;
  isReady: boolean;
  refreshAuthState: () => Promise<void>;
  checkIdentity: () => Promise<void>;
  // Passkey
  hasPasskey: boolean;
  passkeys: PasskeyInfo[];
  localPasskey: PasskeyInfo | null;
  registerPasskey: () => Promise<void>;
  loginPasskey: (email: string) => Promise<void>;
  fetchPasskeys: () => Promise<void>;
  deletePasskey: (passkeyId: string) => Promise<void>;
  // TOTP
  totpEnabled: boolean;
  backupCodesStatus: BackupCodesStatus | null;
  fetchTotpStatus: () => Promise<void>;
  setupTotp: () => Promise<TotpSetupData>;
  enableTotp: (code: string) => Promise<string[]>;
  disableTotp: () => Promise<void>;
  regenerateBackupCodes: () => Promise<string[]>;
  initiateTotpLogin: (email: string) => Promise<void>;
  completeTotpLogin: (email: string, code: string) => Promise<void>;
  // Logout
  logout: () => Promise<void>;
}

const DCIDContext = createContext<DCIDContextType | undefined>(undefined);

export function DCIDProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<DCIDClient | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasIdentity, setHasIdentity] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Passkey state
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [localPasskeyId, setLocalPasskeyId] = useState<string | null>(null);

  // TOTP state
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [backupCodesStatus, setBackupCodesStatus] = useState<BackupCodesStatus | null>(null);

  // Computed values
  const localPasskey = passkeys.find(p => p.id === localPasskeyId) || null;
  const hasPasskey = localPasskey !== null;

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
      const identity = await client.identity?.getExistingIdentity();
      setHasIdentity(!!identity?.did);
    } catch (error) {
      console.log('No existing identity found:', error);
      setHasIdentity(false);
    }
  };

  // ========== Passkey Methods ==========

  const fetchPasskeys = async () => {
    if (!client || !isAuthenticated) {
      setPasskeys([]);
      return;
    }

    try {
      const list = await client.auth.passkey.listPasskeys();
      setPasskeys(list);
    } catch (error) {
      console.error('[DCIDContext] Failed to fetch passkeys:', error);
      setPasskeys([]);
    }
  };

  const registerPasskey = async () => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    console.log('[DCIDContext] Starting passkey registration');
    console.log('[DCIDContext] Platform:', Platform.OS, Platform.Version);

    // Check if passkey is supported
    const isSupported = await Passkey.isSupported();
    console.log('[DCIDContext] Passkey supported:', isSupported);

    if (!isSupported) {
      throw new Error('Passkeys are not supported on this device');
    }

    // Get registration options from server
    const { options } = await client.auth.passkey.initiateRegistration();
    console.log('[DCIDContext] Got registration options:', JSON.stringify(options, null, 2));

    // Call native passkey creation
    const result = await Passkey.create(options);
    console.log('[DCIDContext] Passkey created');

    // Complete registration with server
    await client.auth.passkey.completeRegistration(result);
    console.log('[DCIDContext] Registration completed');

    // Refresh passkeys list and store local passkey ID
    const updatedPasskeys = await client.auth.passkey.listPasskeys();
    setPasskeys(updatedPasskeys);

    if (updatedPasskeys.length > 0) {
      const newestPasskey = updatedPasskeys.reduce((newest, current) =>
        new Date(current.created_at) > new Date(newest.created_at) ? current : newest
      );
      await AsyncStorage.setItem(LOCAL_PASSKEY_KEY, newestPasskey.id);
      setLocalPasskeyId(newestPasskey.id);
      console.log('[DCIDContext] Local passkey ID stored:', newestPasskey.id);
    }
  };

  const loginPasskey = async (email: string) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    console.log('[DCIDContext] Starting passkey login for:', email);

    // Get authentication options from server
    const { options } = await client.auth.passkey.initiateAuthentication({ email });
    console.log('[DCIDContext] Got authentication options');

    // Call native passkey get
    const result = await Passkey.get(options);
    console.log('[DCIDContext] Passkey retrieved');

    // Complete authentication with server
    const tokens = await client.auth.passkey.completeAuthentication({ email }, result);
    console.log('[DCIDContext] Authentication completed');

    // Login with tokens (pass email for identity creation)
    await client.auth.login(tokens.accessToken, tokens.refreshToken, email);
    setUserEmail(email);
    await refreshAuthState();
  };

  const deletePasskey = async (passkeyId: string) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    await client.auth.passkey.deletePasskey(passkeyId);

    // Clear local passkey if it was the deleted one
    if (passkeyId === localPasskeyId) {
      await AsyncStorage.removeItem(LOCAL_PASSKEY_KEY);
      setLocalPasskeyId(null);
    }

    await fetchPasskeys();
  };

  // ========== TOTP Methods ==========

  const fetchTotpStatus = async () => {
    if (!client || !isAuthenticated) {
      setTotpEnabled(false);
      setBackupCodesStatus(null);
      return;
    }

    try {
      const status = await client.auth.totp.getStatus();
      setTotpEnabled(status.totpEnabled);

      if (status.totpEnabled) {
        const backupStatus = await client.auth.totp.getBackupCodesStatus();
        setBackupCodesStatus(backupStatus);
      } else {
        setBackupCodesStatus(null);
      }
    } catch (error) {
      console.error('[DCIDContext] Failed to fetch TOTP status:', error);
      setTotpEnabled(false);
      setBackupCodesStatus(null);
    }
  };

  const setupTotp = async (): Promise<TotpSetupData> => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    const data = await client.auth.totp.setupTotp();
    return data;
  };

  const enableTotp = async (code: string): Promise<string[]> => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    const result = await client.auth.totp.enableTotp(code);
    setTotpEnabled(true);
    await fetchTotpStatus();
    return result.backupCodes;
  };

  const disableTotp = async (): Promise<void> => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    await client.auth.totp.disableTotp();
    setTotpEnabled(false);
    setBackupCodesStatus(null);
  };

  const regenerateBackupCodes = async (): Promise<string[]> => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    const result = await client.auth.totp.regenerateBackupCodes();
    await fetchTotpStatus();
    return result.backupCodes;
  };

  const initiateTotpLogin = async (email: string): Promise<void> => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    await client.auth.totp.initiateAuth({ email });
  };

  const completeTotpLogin = async (email: string, code: string): Promise<void> => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    const tokens = await client.auth.totp.completeAuth({ email }, code);
    // Login with tokens (pass email for identity creation)
    await client.auth.login(tokens.accessToken, tokens.refreshToken, email);
    setUserEmail(email);
    await refreshAuthState();
  };

  // ========== Logout ==========

  const logout = async () => {
    if (!client) return;

    await client.auth.logout();
    setIsAuthenticated(false);
    setUserEmail(null);
    setHasIdentity(false);
    setPasskeys([]);
    setTotpEnabled(false);
    setBackupCodesStatus(null);
  };

  // ========== Effects ==========

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
          wsUrl: DCID_WS_URL,
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

        // Load local passkey ID from storage
        const storedPasskeyId = await AsyncStorage.getItem(LOCAL_PASSKEY_KEY);
        if (storedPasskeyId) {
          setLocalPasskeyId(storedPasskeyId);
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

  // Fetch passkeys and TOTP status when authenticated
  useEffect(() => {
    if (isAuthenticated && client) {
      checkIdentity();
      fetchPasskeys();
      fetchTotpStatus();
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
        // Passkey
        hasPasskey,
        passkeys,
        localPasskey,
        registerPasskey,
        loginPasskey,
        fetchPasskeys,
        deletePasskey,
        // TOTP
        totpEnabled,
        backupCodesStatus,
        fetchTotpStatus,
        setupTotp,
        enableTotp,
        disableTotp,
        regenerateBackupCodes,
        initiateTotpLogin,
        completeTotpLogin,
        // Logout
        logout,
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
