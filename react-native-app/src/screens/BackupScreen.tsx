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

export default function BackupScreen() {
  const { client, userEmail, hasIdentity } = useDCID();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [backedUpCount, setBackedUpCount] = useState<number | null>(null);

  const handleBackupCredentials = async () => {
    if (!client || !userEmail || !hasIdentity) {
      Alert.alert('Error', 'Please login and create identity first');
      return;
    }

    setLoading(true);
    setStatus('Getting identity...');
    setBackedUpCount(null);

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

      setStatus('Creating wallet...');

      // Create identity to get wallet (needed for accessing credentials)
      const identityResult = await client.identity?.createIdentity(userEmail, accessToken);
      if (!identityResult?.wallet) {
        throw new Error('Failed to create wallet');
      }

      setStatus('Backing up credentials to IPFS...');

      // Backup credentials to IPFS
      if (!client.credentials) {
        throw new Error('Credential manager not initialized');
      }

      const count = await client.credentials.backupAllCredentials(
        identityResult.wallet,
        existingIdentity.did,
        userEmail,
        accessToken
      );

      setBackedUpCount(count);
      setStatus('');

      if (count > 0) {
        Alert.alert(
          'Backup Complete',
          `Successfully backed up ${count} credential${count > 1 ? 's' : ''} to IPFS.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'No Credentials',
          'No credentials were found to backup. Issue some credentials first.',
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      console.error('[Backup] Error:', err);
      setStatus('');

      // Provide helpful error messages
      if (err.message?.includes('decrypt') || err.message?.includes('WebView')) {
        Alert.alert(
          'Encryption Error',
          'Failed to encrypt backup data. Please ensure MetaKeep WebView is ready.'
        );
      } else if (err.message?.includes('IPFS') || err.message?.includes('fetch')) {
        Alert.alert(
          'Connection Error',
          'Failed to connect to IPFS. Please check your internet connection.'
        );
      } else {
        Alert.alert('Error', err.message || 'Failed to backup credentials');
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
          Create your decentralized identity first to backup credentials.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={commonStyles.container}>
      <View style={styles.content}>
        <View style={commonStyles.card}>
          <Text style={styles.title}>Backup Credentials to IPFS</Text>
          <Text style={styles.description}>
            Securely backup your verifiable credentials to IPFS (decentralized storage). Your
            credentials are encrypted with your MetaKeep key before upload.
          </Text>

          <View style={styles.warningBox}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              Note: Mobile backups are currently stored without encryption due to SDK limitations.
              Encrypted backups are available on web and browser extension.
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoBoxText}>
              Your credentials are backed up to decentralized IPFS storage and can be recovered
              on any device using your MetaKeep identity.
            </Text>
          </View>

          {status ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.statusText}>{status}</Text>
            </View>
          ) : null}

          {backedUpCount !== null && !loading && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultIcon}>
                {backedUpCount > 0 ? '✅' : 'ℹ️'}
              </Text>
              <Text style={styles.resultText}>
                {backedUpCount > 0
                  ? `Backed up ${backedUpCount} credential${backedUpCount > 1 ? 's' : ''}`
                  : 'No credentials to backup'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[commonStyles.button, loading && commonStyles.buttonDisabled]}
            onPress={handleBackupCredentials}
            disabled={loading}
          >
            <Text style={commonStyles.buttonText}>
              {loading ? 'Backing up...' : 'Start Backup'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About Credential Backup</Text>
          <Text style={styles.infoDescription}>
            While credentials are automatically backed up when issued, you can use this screen to
            manually trigger a backup of all your credentials at any time.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How backup works:</Text>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>1. Fetch all credentials from local storage</Text>
            <Text style={styles.infoItem}>2. Encrypt each credential with your MetaKeep key</Text>
            <Text style={styles.infoItem}>3. Upload encrypted data to IPFS</Text>
            <Text style={styles.infoItem}>4. Store IPFS CID reference for later recovery</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>When to backup manually:</Text>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>• After importing credentials from another source</Text>
            <Text style={styles.infoItem}>• If automatic backup failed during issuance</Text>
            <Text style={styles.infoItem}>• Before switching to a new device</Text>
            <Text style={styles.infoItem}>• For peace of mind</Text>
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
    marginBottom: 12,
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
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E8F4FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#0D47A1',
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
