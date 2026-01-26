import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useDCID } from '../contexts/DCIDContext';
import { commonStyles, colors } from '../styles/common';
import type { Credential } from '@dcid/sdk';

export default function CredentialsScreen() {
  const { client, userEmail, hasIdentity } = useDCID();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCredentials();
  }, [hasIdentity]);

  const loadCredentials = async () => {
    if (!client || !userEmail) {
      setLoading(false);
      return;
    }

    // Need identity to fetch credentials
    if (!hasIdentity) {
      setLoading(false);
      setCredentials([]);
      return;
    }

    setError(null);

    try {
      // Get the user's DID first
      const existingIdentity = await client.identity?.getExistingIdentity();
      if (!existingIdentity?.did) {
        console.log('No identity found, cannot fetch credentials');
        setCredentials([]);
        return;
      }

      // Get access token
      const accessToken = await client.auth.getAccessToken();
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // Use the CredentialManager to get credentials
      if (client.credentials) {
        const creds = await client.credentials.getCredentials(
          userEmail,
          existingIdentity.did,
          accessToken
        );
        console.log('[CredentialsScreen] Fetched credentials:', (creds || []).length);
        setCredentials(creds || []);
      } else {
        console.log('[CredentialsScreen] CredentialManager not initialized');
        setCredentials([]);
      }
    } catch (err: any) {
      console.error('Failed to load credentials:', err);
      setError(err.message || 'Failed to load credentials');
      setCredentials([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCredentials();
  };

  if (loading) {
    return (
      <View style={commonStyles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!hasIdentity) {
    return (
      <ScrollView
        style={commonStyles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🆔</Text>
          <Text style={styles.emptyTitle}>Identity Required</Text>
          <Text style={styles.emptyText}>
            Create your decentralized identity first to store and manage credentials.
          </Text>
        </View>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView
        style={commonStyles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>Error Loading Credentials</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={commonStyles.button} onPress={handleRefresh}>
            <Text style={commonStyles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (credentials.length === 0) {
    return (
      <ScrollView
        style={commonStyles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Credentials Yet</Text>
          <Text style={styles.emptyText}>
            Scan a QR code to receive your first verifiable credential.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={commonStyles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Credentials ({credentials.length})</Text>
        </View>

        {credentials.map((credential) => {
          const type = Array.isArray(credential.type)
            ? credential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown'
            : credential.type;

          return (
            <View key={credential.id} style={styles.credentialCard}>
              <View style={styles.credentialHeader}>
                <Text style={styles.credentialType}>{type}</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>

              <View style={styles.credentialBody}>
                <View style={styles.credentialField}>
                  <Text style={styles.fieldLabel}>Issuer</Text>
                  <Text style={styles.fieldValue}>{credential.issuer}</Text>
                </View>

                <View style={styles.credentialField}>
                  <Text style={styles.fieldLabel}>Issued</Text>
                  <Text style={styles.fieldValue}>
                    {new Date(credential.issuanceDate).toLocaleDateString()}
                  </Text>
                </View>

                {/* expirationDate would be shown here if available */}

                {credential.credentialSubject && (
                  <View style={styles.credentialField}>
                    <Text style={styles.fieldLabel}>Subject</Text>
                    <View style={styles.jsonBox}>
                      <Text style={styles.jsonText}>
                        {JSON.stringify(credential.credentialSubject, null, 2)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.gray900,
  },
  credentialCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  credentialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  credentialType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.gray900,
    flex: 1,
  },
  verifiedBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  credentialBody: {
    gap: 12,
  },
  credentialField: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: colors.gray900,
  },
  jsonBox: {
    backgroundColor: colors.gray50,
    padding: 8,
    borderRadius: 6,
  },
  jsonText: {
    fontSize: 11,
    color: colors.gray900,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
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
  },
});
