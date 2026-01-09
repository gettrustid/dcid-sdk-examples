import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useDCID } from '../contexts/DCIDContext';
import { commonStyles, colors } from '../styles/common';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: Props) {
  const { client, userEmail, hasIdentity, refreshAuthState } = useDCID();

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await client?.auth.logout();
          refreshAuthState();
        },
      },
    ]);
  };

  return (
    <ScrollView style={commonStyles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome</Text>
          <Text style={styles.emailText}>{userEmail}</Text>
          {hasIdentity && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Identity Active</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={[commonStyles.card, styles.actionCard]}
          onPress={() => navigation.navigate('Identity')}
        >
          <Text style={styles.cardIcon}>🆔</Text>
          <Text style={styles.cardTitle}>Decentralized Identity</Text>
          <Text style={styles.cardDescription}>
            {hasIdentity
              ? 'View and manage your DID'
              : 'Create your decentralized identity'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            commonStyles.card,
            styles.actionCard,
            !hasIdentity && styles.disabledCard,
          ]}
          onPress={() => hasIdentity && navigation.navigate('Credentials')}
          disabled={!hasIdentity}
        >
          <Text style={styles.cardIcon}>📋</Text>
          <Text style={styles.cardTitle}>Credentials</Text>
          <Text style={styles.cardDescription}>
            View your verifiable credentials
          </Text>
          {!hasIdentity && (
            <Text style={styles.disabledText}>Create identity first</Text>
          )}
        </TouchableOpacity>

<TouchableOpacity
          style={[
            commonStyles.card,
            styles.actionCard,
            !hasIdentity && styles.disabledCard,
          ]}
          onPress={() => hasIdentity && navigation.navigate('IssueCredential')}
          disabled={!hasIdentity}
        >
          <Text style={styles.cardIcon}>🎫</Text>
          <Text style={styles.cardTitle}>Issue Credential</Text>
          <Text style={styles.cardDescription}>
            Request a new verifiable credential
          </Text>
          {!hasIdentity && (
            <Text style={styles.disabledText}>Create identity first</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            commonStyles.card,
            styles.actionCard,
            !hasIdentity && styles.disabledCard,
          ]}
          onPress={() => hasIdentity && navigation.navigate('ProofVerification')}
          disabled={!hasIdentity}
        >
          <Text style={styles.cardIcon}>🔐</Text>
          <Text style={styles.cardTitle}>Generate Proof</Text>
          <Text style={styles.cardDescription}>
            Create zero-knowledge proof of credentials
          </Text>
          {!hasIdentity && (
            <Text style={styles.disabledText}>Create identity first</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            commonStyles.card,
            styles.actionCard,
            !hasIdentity && styles.disabledCard,
          ]}
          onPress={() => hasIdentity && navigation.navigate('Backup')}
          disabled={!hasIdentity}
        >
          <Text style={styles.cardIcon}>💾</Text>
          <Text style={styles.cardTitle}>Backup Credentials</Text>
          <Text style={styles.cardDescription}>
            Backup credentials to IPFS (unencrypted)
          </Text>
          {!hasIdentity && (
            <Text style={styles.disabledText}>Create identity first</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            commonStyles.card,
            styles.actionCard,
            !hasIdentity && styles.disabledCard,
          ]}
          onPress={() => hasIdentity && navigation.navigate('Recovery')}
          disabled={!hasIdentity}
        >
          <Text style={styles.cardIcon}>☁️</Text>
          <Text style={styles.cardTitle}>Recover Credentials</Text>
          <Text style={styles.cardDescription}>
            Restore credentials from IPFS (unencrypted)
          </Text>
          {!hasIdentity && (
            <Text style={styles.disabledText}>Create identity first</Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About DCID</Text>
          <Text style={styles.infoText}>
            DCID enables self-sovereign identity with verifiable credentials
            and zero-knowledge proofs. Your keys are securely stored in an HSM.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  welcomeText: {
    fontSize: 14,
    color: colors.gray700,
  },
  emailText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.gray900,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: colors.gray100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: colors.gray700,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  actionCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  disabledCard: {
    opacity: 0.5,
  },
  cardIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.gray700,
    textAlign: 'center',
  },
  disabledText: {
    fontSize: 12,
    color: colors.warning,
    marginTop: 8,
    fontWeight: '500',
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
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
  },
});
