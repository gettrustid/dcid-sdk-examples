import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useDCID } from '../contexts/DCIDContext';
import { commonStyles, colors } from '../styles/common';

export default function RecoveryScreen() {
  const { client, userEmail, hasIdentity } = useDCID();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [recoveredCount, setRecoveredCount] = useState<number | null>(null);

  const handleRecoverCredentials = async () => {
    if (!client || !userEmail || !hasIdentity) {
      Alert.alert('Error', 'Please login and create identity first');
      return;
    }

    setLoading(true);
    setStatus('Getting identity...');
    setRecoveredCount(null);

    try {
      // Get access token
      const accessToken = await client.auth.getAccessToken();
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // Get existing identity
      const existingIdentity = await client.identity?.getExistingIdentity();
      if (!existingIdentity?.did) {
        throw new Error('No identity found');
      }

      setStatus('Creating wallet for recovery...');

      // Create identity to get wallet (needed for storing recovered credentials)
      const identityResult = await client.identity?.createIdentity(userEmail, accessToken);
      if (!identityResult?.wallet) {
        throw new Error('Failed to create wallet');
      }

      setStatus('Connecting to IPFS and fetching backups...');

      // Recover credentials from IPFS
      if (!client.credentials) {
        throw new Error('Credential manager not initialized');
      }

      const count = await client.credentials.recoverCredentialsFromIPFS(
        identityResult.wallet,
        existingIdentity.did,
        userEmail,
        accessToken
      );

      setRecoveredCount(count);
      setStatus('');

      if (count > 0) {
        Alert.alert(
          'Recovery Complete',
          `Successfully recovered ${count} credential${count > 1 ? 's' : ''} from IPFS backup.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'No Backups Found',
          'No credential backups were found on IPFS for your identity.',
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      console.error('[Recovery] Error:', err);
      setStatus('');

      // Provide helpful error messages
      if (err.message?.includes('decryption')) {
        Alert.alert(
          'Decryption Error',
          'Failed to decrypt backup data. This may happen if the backup was created with a different key.'
        );
      } else if (err.message?.includes('IPFS') || err.message?.includes('fetch')) {
        Alert.alert(
          'Connection Error',
          'Failed to connect to IPFS. Please check your internet connection.'
        );
      } else {
        Alert.alert('Error', err.message || 'Failed to recover credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!hasIdentity) {
    return (
      <View style={commonStyles.centerContainer}>
        <Text style={styles.emptyIcon}>🆔</Text>
        <Text style={styles.emptyTitle}>Identity Required</Text>
        <Text style={styles.emptyText}>
          Create your decentralized identity first to recover credentials.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={commonStyles.container}>
      <View style={styles.content}>
        <View style={commonStyles.card}>
          <Text style={styles.title}>Recover Credentials from Backup</Text>
          <Text style={styles.description}>
            Restore your verifiable credentials from IPFS backup. This is useful if you're
            setting up on a new device or have lost your local data.
          </Text>

          <View style={styles.warningBox}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              Note: Mobile backups are currently stored without encryption due to SDK limitations.
              You can only recover credentials that were backed up from mobile. Encrypted backups
              from web/extension require those platforms to recover.
            </Text>
          </View>

          {status ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.statusText}>{status}</Text>
            </View>
          ) : null}

          {recoveredCount !== null && !loading && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultIcon}>
                {recoveredCount > 0 ? '✅' : 'ℹ️'}
              </Text>
              <Text style={styles.resultText}>
                {recoveredCount > 0
                  ? `Recovered ${recoveredCount} credential${recoveredCount > 1 ? 's' : ''}`
                  : 'No backups found'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[commonStyles.button, loading && commonStyles.buttonDisabled]}
            onPress={handleRecoverCredentials}
            disabled={loading}
          >
            <Text style={commonStyles.buttonText}>
              {loading ? 'Recovering...' : 'Start Recovery'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About Credential Backup</Text>
          <Text style={styles.infoDescription}>
            Your credentials are automatically backed up to IPFS (decentralized storage) when they
            are issued. On mobile, backups are stored unencrypted. On web/extension, backups are
            encrypted with your MetaKeep key.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How recovery works:</Text>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>1. Connect to IPFS to fetch your backups</Text>
            <Text style={styles.infoItem}>2. Parse and restore credentials to local storage</Text>
            <Text style={styles.infoItem}>3. Credentials are merged with any existing local ones</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>When to use recovery:</Text>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>• Setting up the app on a new device</Text>
            <Text style={styles.infoItem}>• After reinstalling the app</Text>
            <Text style={styles.infoItem}>• If local credential storage was cleared</Text>
            <Text style={styles.infoItem}>• To sync credentials across devices</Text>
          </View>
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
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
    marginBottom: 20,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
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
  resultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  resultIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  resultText: {
    fontSize: 14,
    color: colors.gray900,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: colors.gray100,
    padding: 20,
    borderRadius: 12,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 12,
  },
  infoDescription: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
  },
  infoList: {
    gap: 8,
  },
  infoItem: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray700,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
