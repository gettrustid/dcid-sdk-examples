import React, { useState } from 'react';
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

// Example data for auto-fill
const EXAMPLE_DATA = {
  ProofOfAgeCredential: {
    proofOfAgeMethod: 'ageVerification',
    levelOfConfidence: 'documentScan',
    isOver14: true,
    isOver18: true,
    isOver21: false,
  },
  DocumentVerificationCredential: {
    documentType: 'Passport',
    documentNumber: 'SAMPLE123456',
    issuingAuthority: 'US Government',
    expiryDate: '20301231',
    verificationMethod: 'documentScan',
  },
};

export default function IssueCredentialScreen() {
  const { client, userEmail, hasIdentity } = useDCID();
  const [credentialType, setCredentialType] = useState<CredentialType>('ProofOfAgeCredential');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  // ProofOfAge fields
  const [isOver14, setIsOver14] = useState(true);
  const [isOver18, setIsOver18] = useState(true);
  const [isOver21, setIsOver21] = useState(false);

  // DocumentVerification fields
  const [documentType, setDocumentType] = useState('Passport');
  const [documentNumber, setDocumentNumber] = useState('SAMPLE123456');
  const [issuingAuthority, setIssuingAuthority] = useState('US Government');
  const [expiryDate, setExpiryDate] = useState('20301231');

  const autoFillExample = () => {
    if (credentialType === 'ProofOfAgeCredential') {
      const data = EXAMPLE_DATA.ProofOfAgeCredential;
      setIsOver14(data.isOver14);
      setIsOver18(data.isOver18);
      setIsOver21(data.isOver21);
    } else {
      const data = EXAMPLE_DATA.DocumentVerificationCredential;
      setDocumentType(data.documentType);
      setDocumentNumber(data.documentNumber);
      setIssuingAuthority(data.issuingAuthority);
      setExpiryDate(data.expiryDate);
    }
  };

  const handleIssueCredential = async () => {
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

      setStatus('Requesting credential from server...');

      // Build credential data based on type
      let credentialData: Record<string, any>;
      if (credentialType === 'ProofOfAgeCredential') {
        credentialData = {
          proofOfAgeMethod: 'ageVerification',
          levelOfConfidence: 'documentScan',
          ageStatement: {
            isOver14,
            isOver18,
            isOver21,
          },
        };
      } else {
        credentialData = {
          documentType,
          documentNumber,
          issuingAuthority,
          expiryDate: parseInt(expiryDate, 10),
          verificationMethod: 'documentScan',
        };
      }

      // Issue credential via API
      const issueResponse = await client.api.issueCredential(
        existingIdentity.did,
        credentialType,
        credentialData,
        userEmail,
        accessToken
      );

      if (!issueResponse) {
        throw new Error('Failed to issue credential');
      }

      console.log('[IssueCredential] Issue response:', issueResponse);
      const { txId, claimId } = issueResponse;

      setStatus('Waiting for credential to be published on blockchain...');

      // Wait for credential via WebSocket
      if (!client.webSocket) {
        throw new Error('WebSocket not initialized');
      }

      // Set JWT token for WebSocket authentication
      client.webSocket.setJWTToken(accessToken);

      // Wait for credential (2 minute timeout)
      const wsResponse = await client.webSocket.waitForCredential(claimId, txId);

      console.log('[IssueCredential] WebSocket response:', wsResponse);

      if (!wsResponse.qrCodeLink) {
        throw new Error('No credential offer link received');
      }

      setStatus('Fetching and storing credential...');

      // Handle the credential offer
      if (!client.credentials) {
        throw new Error('Credential manager not initialized');
      }

      const result = await client.credentials.handleCredentialOffer({
        emailOrPhone: userEmail,
        credentialUrl: wsResponse.qrCodeLink,
        accessToken,
      });

      if (result) {
        setStatus('');
        Alert.alert('Success', `${credentialType} has been issued and stored!`);
      } else {
        throw new Error('Failed to store credential');
      }
    } catch (err: any) {
      console.error('[IssueCredential] Error:', err);
      setStatus('');
      Alert.alert('Error', err.message || 'Failed to issue credential');
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
          Create your decentralized identity first to issue credentials.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={commonStyles.container}>
      <View style={styles.content}>
        <View style={commonStyles.card}>
          <Text style={styles.title}>Issue New Credential</Text>
          <Text style={styles.description}>
            Request a verifiable credential to be issued to your identity.
          </Text>

          <View style={styles.field}>
            <Text style={commonStyles.label}>Credential Type</Text>
            <SimpleDropdown
              options={[
                { label: 'Proof of Age', value: 'ProofOfAgeCredential' },
                { label: 'Document Verification', value: 'DocumentVerificationCredential' },
              ]}
              selectedValue={credentialType}
              onValueChange={(value) => setCredentialType(value as CredentialType)}
            />
          </View>

          <TouchableOpacity style={styles.autoFillButton} onPress={autoFillExample}>
            <Text style={styles.autoFillText}>Auto-fill Example Data</Text>
          </TouchableOpacity>

          {credentialType === 'ProofOfAgeCredential' ? (
            <View style={styles.fieldsContainer}>
              <Text style={styles.sectionTitle}>Age Statements</Text>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setIsOver14(!isOver14)}
              >
                <View style={[styles.checkbox, isOver14 && styles.checkboxChecked]}>
                  {isOver14 && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Is Over 14</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setIsOver18(!isOver18)}
              >
                <View style={[styles.checkbox, isOver18 && styles.checkboxChecked]}>
                  {isOver18 && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Is Over 18</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setIsOver21(!isOver21)}
              >
                <View style={[styles.checkbox, isOver21 && styles.checkboxChecked]}>
                  {isOver21 && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Is Over 21</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.fieldsContainer}>
              <Text style={styles.sectionTitle}>Document Details</Text>

              <View style={styles.field}>
                <Text style={commonStyles.label}>Document Type</Text>
                <TextInput
                  style={commonStyles.input}
                  value={documentType}
                  onChangeText={setDocumentType}
                  placeholder="e.g., Passport"
                />
              </View>

              <View style={styles.field}>
                <Text style={commonStyles.label}>Document Number</Text>
                <TextInput
                  style={commonStyles.input}
                  value={documentNumber}
                  onChangeText={setDocumentNumber}
                  placeholder="e.g., AB123456"
                />
              </View>

              <View style={styles.field}>
                <Text style={commonStyles.label}>Issuing Authority</Text>
                <TextInput
                  style={commonStyles.input}
                  value={issuingAuthority}
                  onChangeText={setIssuingAuthority}
                  placeholder="e.g., US Government"
                />
              </View>

              <View style={styles.field}>
                <Text style={commonStyles.label}>Expiry Date (YYYYMMDD)</Text>
                <TextInput
                  style={commonStyles.input}
                  value={expiryDate}
                  onChangeText={setExpiryDate}
                  placeholder="e.g., 20301231"
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}

          {status ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.statusText}>{status}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[commonStyles.button, loading && commonStyles.buttonDisabled]}
            onPress={handleIssueCredential}
            disabled={loading}
          >
            <Text style={commonStyles.buttonText}>
              {loading ? 'Issuing...' : 'Issue Credential'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works:</Text>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>1. Select credential type and fill in details</Text>
            <Text style={styles.infoItem}>2. Request is sent to the issuer backend</Text>
            <Text style={styles.infoItem}>3. Credential is published on blockchain</Text>
            <Text style={styles.infoItem}>4. Credential is stored in your identity wallet</Text>
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
  autoFillButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.gray100,
    borderRadius: 6,
    marginBottom: 16,
  },
  autoFillText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  fieldsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.gray300,
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: colors.gray900,
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
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 12,
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
