import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SimpleDropdown } from '../components/SimpleDropdown';
import { useDCID } from '../contexts/DCIDContext';
import { commonStyles, colors } from '../styles/common';

type CredentialType = 'ProofOfAgeCredential' | 'DocumentVerificationCredential';

// Example proof request URLs (these would normally come from QR codes)
const EXAMPLE_PROOF_URLS: Record<CredentialType, string> = {
  ProofOfAgeCredential: 'iden3comm://?request_uri=your-backend-url/identity/verify/sign-in',
  DocumentVerificationCredential: 'iden3comm://?request_uri=your-backend-url/identity/verify/sign-in',
};

export default function ProofVerificationScreen() {
  const { client, userEmail, hasIdentity } = useDCID();
  const [credentialType, setCredentialType] = useState<CredentialType>('ProofOfAgeCredential');
  const [proofRequestUrl, setProofRequestUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [checkingCredentials, setCheckingCredentials] = useState(true);

  useEffect(() => {
    checkCredentials();
  }, [hasIdentity]);

  const checkCredentials = async () => {
    if (!client || !userEmail || !hasIdentity) {
      setCheckingCredentials(false);
      setHasCredentials(false);
      return;
    }

    try {
      const existingIdentity = await client.identity?.getExistingIdentity();
      if (!existingIdentity?.did) {
        setHasCredentials(false);
        return;
      }

      const accessToken = await client.auth.getAccessToken();
      if (!accessToken || !client.credentials) {
        setHasCredentials(false);
        return;
      }

      const creds = await client.credentials.getCredentials(
        userEmail,
        existingIdentity.did,
        accessToken
      );

      setHasCredentials(creds && creds.length > 0);
    } catch (err) {
      console.error('[ProofVerification] Error checking credentials:', err);
      setHasCredentials(false);
    } finally {
      setCheckingCredentials(false);
    }
  };

  const autoFillExample = () => {
    // In a real app, this would come from the verifySignIn API
    // For now, we'll use a placeholder that shows the flow
    setProofRequestUrl(`Example: Will call verifySignIn API for ${credentialType}`);
  };

  const handleGenerateProof = async () => {
    if (!client || !userEmail || !hasIdentity) {
      Alert.alert('Error', 'Please login and create identity first');
      return;
    }

    setLoading(true);
    setStatus('Getting identity...');

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

      setStatus('Requesting proof challenge from verifier...');

      // Call verifySignIn to get the iden3comm URL
      const verifyResponse = await client.api.verifySignIn(credentialType, accessToken);

      if (!verifyResponse || !verifyResponse.iden3commUrl) {
        throw new Error('Failed to get proof request from verifier');
      }

      console.log('[ProofVerification] Verify response:', verifyResponse);

      setStatus('Generating zero-knowledge proof...');

      // Generate and verify proof
      if (!client.proofs) {
        throw new Error('Proof generator not initialized');
      }

      const proofResult = await client.proofs.createAndVerifyProof({
        emailOrPhone: userEmail,
        did: existingIdentity.did,
        proofRequestUrl: verifyResponse.iden3commUrl,
        accessToken,
      });

      console.log('[ProofVerification] Proof result:', proofResult);

      if (proofResult.verified) {
        setStatus('');
        Alert.alert(
          'Success',
          `Proof generated and ${proofResult.submitted ? 'submitted to verifier' : 'verified locally'}!`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error('Proof verification failed');
      }
    } catch (err: any) {
      console.error('[ProofVerification] Error:', err);
      setStatus('');

      // Provide helpful error messages
      if (err.message?.includes('no credentials')) {
        Alert.alert(
          'No Credentials',
          `You need a ${credentialType} to generate this proof. Issue a credential first.`
        );
      } else if (err.message?.includes('Circuit')) {
        Alert.alert(
          'Circuit Error',
          'ZK circuits may not be available. Please check circuit configuration.'
        );
      } else {
        Alert.alert('Error', err.message || 'Failed to generate proof');
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
          Create your decentralized identity first to generate proofs.
        </Text>
      </View>
    );
  }

  if (checkingCredentials) {
    return (
      <View style={commonStyles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Checking credentials...</Text>
      </View>
    );
  }

  if (!hasCredentials) {
    return (
      <View style={commonStyles.centerContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>No Credentials</Text>
        <Text style={styles.emptyText}>
          You need at least one credential to generate proofs. Issue a credential first.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={commonStyles.container}>
      <View style={styles.content}>
        <View style={commonStyles.card}>
          <Text style={styles.title}>Generate Zero-Knowledge Proof</Text>
          <Text style={styles.description}>
            Create a privacy-preserving proof of your credentials without revealing the underlying data.
          </Text>

          <View style={styles.field}>
            <Text style={commonStyles.label}>Credential Type to Prove</Text>
            <SimpleDropdown
              options={[
                { label: 'Proof of Age', value: 'ProofOfAgeCredential' },
                { label: 'Document Verification', value: 'DocumentVerificationCredential' },
              ]}
              selectedValue={credentialType}
              onValueChange={(value) => setCredentialType(value as CredentialType)}
            />
          </View>

          <View style={styles.field}>
            <Text style={commonStyles.label}>Proof Request URL (Optional)</Text>
            <TextInput
              style={[commonStyles.input, styles.multilineInput]}
              value={proofRequestUrl}
              onChangeText={setProofRequestUrl}
              placeholder="Leave empty to use default verifier"
              multiline
              numberOfLines={2}
            />
            <Text style={styles.hint}>
              If empty, we'll request a proof challenge from the default verifier.
            </Text>
          </View>

          {status ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.statusText}>{status}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[commonStyles.button, loading && commonStyles.buttonDisabled]}
            onPress={handleGenerateProof}
            disabled={loading}
          >
            <Text style={commonStyles.buttonText}>
              {loading ? 'Generating Proof...' : 'Generate & Submit Proof'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What is a Zero-Knowledge Proof?</Text>
          <Text style={styles.infoDescription}>
            A ZK proof allows you to prove something about your credentials (e.g., "I am over 18")
            without revealing the actual data (your birthdate). The verifier learns only what you
            choose to share.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works:</Text>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>1. Select the credential type to prove</Text>
            <Text style={styles.infoItem}>2. Request proof challenge from verifier</Text>
            <Text style={styles.infoItem}>3. Generate ZK proof locally on your device</Text>
            <Text style={styles.infoItem}>4. Submit proof to verifier for validation</Text>
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
  field: {
    marginBottom: 16,
  },
  multilineInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 4,
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
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.gray700,
  },
});
