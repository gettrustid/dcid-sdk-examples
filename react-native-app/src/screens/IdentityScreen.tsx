import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useDCID } from '../contexts/DCIDContext';
import { commonStyles, colors } from '../styles/common';
import type { Identity } from '@dcid/sdk';

export default function IdentityScreen() {
  const { client, userEmail, hasIdentity, checkIdentity, isReady } = useDCID();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState<string>('');

  useEffect(() => {
    loadIdentity();
  }, [hasIdentity]);

  const loadIdentity = async () => {
    if (!client) return;

    setLoading(true);
    try {
      // Use getExistingIdentity() which doesn't require a wallet
      const existingIdentity = await client.identity?.getExistingIdentity();
      if (existingIdentity) {
        setIdentity({ did: existingIdentity.did, publicKey: existingIdentity.publicKey } as Identity);
      }
    } catch (err) {
      console.log('No existing identity found:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIdentity = async () => {
    if (!client || !userEmail) return;

    if (!isReady) {
      Alert.alert('Please Wait', 'MetaKeep is still initializing. Please try again in a moment.');
      return;
    }

    setCreating(true);
    setCreationStatus('Authenticating...');

    try {
      const accessToken = await client.auth.getAccessToken();
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      setCreationStatus('Loading ZK circuits (this may take a few minutes on first run)...');

      const newIdentity = await client.identity?.createIdentity(userEmail, accessToken);
      if (newIdentity) {
        setCreationStatus('Identity created successfully!');
        setIdentity({ did: newIdentity.did, publicKey: newIdentity.publicKey } as Identity);
        await checkIdentity();
        Alert.alert('Success', 'Your decentralized identity has been created!');
      }
    } catch (err: any) {
      console.error('[IdentityScreen] Create identity error:', err);

      // Provide helpful message for React Native limitations
      if (err.message?.includes('Circuit storage') || err.message?.includes('IndexedDB')) {
        Alert.alert(
          'Not Available',
          'Identity creation is not yet available on mobile. Please use the web app to create your identity, then you can use it here.'
        );
      } else if (err.message?.includes('timeout')) {
        Alert.alert(
          'Timeout',
          'The operation took too long. This usually happens when downloading ZK circuits for the first time. Please try again.'
        );
      } else if (err.message?.includes('WebView')) {
        Alert.alert(
          'MetaKeep Error',
          'Failed to communicate with MetaKeep. Please restart the app and try again.'
        );
      } else {
        Alert.alert('Error', err.message || 'Failed to create identity');
      }
    } finally {
      setCreating(false);
      setCreationStatus('');
    }
  };

  if (loading) {
    return (
      <View style={commonStyles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (hasIdentity && identity) {
    return (
      <ScrollView style={commonStyles.container}>
        <View style={styles.content}>
          <View style={commonStyles.card}>
            <Text style={styles.title}>Your Decentralized Identity</Text>

            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>DID</Text>
              <View style={styles.valueBox}>
                <Text style={styles.valueText}>{identity.did}</Text>
              </View>
            </View>

            {identity.publicKey && (
              <View style={styles.infoSection}>
                <Text style={styles.infoLabel}>Public Key</Text>
                <View style={styles.valueBox}>
                  <Text style={styles.valueText}>{identity.publicKey}</Text>
                </View>
              </View>
            )}

            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>Active</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What is a DID?</Text>
            <Text style={styles.infoText}>
              A Decentralized Identifier (DID) is your self-sovereign identity on
              the blockchain. It allows you to receive and store verifiable
              credentials without relying on a central authority.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={commonStyles.container}>
      <View style={styles.content}>
        <View style={commonStyles.card}>
          <Text style={styles.title}>Create Your Decentralized Identity</Text>
          <Text style={styles.description}>
            A Decentralized Identifier (DID) is your self-sovereign identity on
            the blockchain. It allows you to receive and store verifiable
            credentials without relying on a central authority.
          </Text>

          <View style={styles.features}>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🔐</Text>
              <Text style={styles.featureTitle}>Self-Sovereign</Text>
              <Text style={styles.featureText}>You control your identity</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🔒</Text>
              <Text style={styles.featureTitle}>Secure</Text>
              <Text style={styles.featureText}>HSM-backed key storage</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🌐</Text>
              <Text style={styles.featureTitle}>Interoperable</Text>
              <Text style={styles.featureText}>Works across platforms</Text>
            </View>
          </View>

          {!isReady && (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.statusText}>Initializing MetaKeep...</Text>
            </View>
          )}

          {creationStatus ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.statusText}>{creationStatus}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              commonStyles.button,
              (creating || !isReady) && commonStyles.buttonDisabled,
            ]}
            onPress={handleCreateIdentity}
            disabled={creating || !isReady}
          >
            <Text style={commonStyles.buttonText}>
              {creating ? 'Creating Identity...' : 'Create Identity'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            {isReady
              ? 'This will open MetaKeep to securely generate your keys'
              : 'Waiting for MetaKeep to initialize...'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
    marginBottom: 24,
  },
  features: {
    marginBottom: 24,
  },
  feature: {
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
    color: colors.gray700,
  },
  hint: {
    fontSize: 12,
    color: colors.gray700,
    textAlign: 'center',
    marginTop: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    marginLeft: 12,
    fontSize: 14,
    color: colors.gray700,
    flex: 1,
  },
  infoSection: {
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  valueBox: {
    backgroundColor: colors.gray100,
    padding: 12,
    borderRadius: 8,
  },
  valueText: {
    fontSize: 12,
    color: colors.gray900,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: colors.gray100,
    padding: 20,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
  },
});
