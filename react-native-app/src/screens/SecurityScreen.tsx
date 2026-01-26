import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDCID } from '../contexts/DCIDContext';
import { commonStyles, colors } from '../styles/common';

export default function SecurityScreen() {
  const navigation = useNavigation<any>();
  const {
    // Passkey
    hasPasskey,
    passkeys,
    localPasskey,
    registerPasskey,
    deletePasskey,
    // TOTP
    totpEnabled,
    backupCodesStatus,
    disableTotp,
    regenerateBackupCodes,
  } = useDCID();

  const [loading, setLoading] = useState(false);
  const [backupCodesModal, setBackupCodesModal] = useState(false);
  const [displayedBackupCodes, setDisplayedBackupCodes] = useState<string[]>([]);

  // Filter passkeys from other devices
  const otherPasskeys = passkeys.filter(p => p.id !== localPasskey?.id);

  // ========== Passkey Handlers ==========

  const handleRegisterPasskey = async () => {
    setLoading(true);
    try {
      await registerPasskey();
      Alert.alert('Success', 'Passkey registered successfully');
    } catch (error: any) {
      const message = error.message || 'Failed to register passkey';
      if (!message.includes('cancelled') && !message.includes('UserCancelled')) {
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePasskey = async (passkeyId: string) => {
    Alert.alert(
      'Delete Passkey',
      'Are you sure you want to delete this passkey? You will need to register a new one to use passkey login.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deletePasskey(passkeyId);
              Alert.alert('Success', 'Passkey deleted');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete passkey');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ========== TOTP Handlers ==========

  const handleSetupTotp = () => {
    navigation.navigate('TotpSetup');
  };

  const handleDisableTotp = async () => {
    Alert.alert(
      'Disable Authenticator',
      'Are you sure you want to disable Google Authenticator? You will need to set it up again to use it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await disableTotp();
              Alert.alert('Success', 'Authenticator disabled');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to disable authenticator');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRegenerateBackupCodes = async () => {
    Alert.alert(
      'Regenerate Backup Codes',
      'This will invalidate all existing backup codes. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: async () => {
            setLoading(true);
            try {
              const codes = await regenerateBackupCodes();
              setDisplayedBackupCodes(codes);
              setBackupCodesModal(true);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to regenerate backup codes');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ========== Passkey Section ========== */}
      <View style={commonStyles.card}>
        <Text style={styles.sectionTitle}>Passkey</Text>
        <Text style={styles.sectionDescription}>
          Use Face ID, Touch ID, or your device's security to sign in instantly without a password.
        </Text>

        {hasPasskey && localPasskey ? (
          <View style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <Text style={styles.activeLabel}>Active on this device</Text>
              <Text style={styles.activeIcon}>
                {localPasskey.device_type === 'multiDevice' ? 'iCloud' : 'Device'}
              </Text>
            </View>
            <View style={styles.cardDetails}>
              <Text style={styles.detailText}>
                Created: {formatDate(localPasskey.created_at)}
              </Text>
              {localPasskey.last_used_at && (
                <Text style={styles.detailText}>
                  Last used: {formatDate(localPasskey.last_used_at)}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.deleteButton, loading && styles.buttonDisabled]}
              onPress={() => handleDeletePasskey(localPasskey.id)}
              disabled={loading}
            >
              <Text style={styles.deleteButtonText}>Delete Passkey</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[commonStyles.button, loading && commonStyles.buttonDisabled]}
            onPress={handleRegisterPasskey}
            disabled={loading}
          >
            <Text style={commonStyles.buttonText}>
              {loading ? 'Registering...' : 'Register Passkey'}
            </Text>
          </TouchableOpacity>
        )}

        {otherPasskeys.length > 0 && (
          <View style={styles.otherDevicesSection}>
            <Text style={styles.otherDevicesTitle}>
              Passkeys on other devices ({otherPasskeys.length})
            </Text>
            {otherPasskeys.map((passkey) => (
              <View key={passkey.id} style={styles.otherDeviceItem}>
                <View>
                  <Text style={styles.otherDeviceType}>
                    {passkey.device_type === 'multiDevice' ? 'iCloud Synced' : 'Single Device'}
                  </Text>
                  <Text style={styles.otherDeviceDate}>
                    Created: {formatDate(passkey.created_at)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteSmallButton}
                  onPress={() => handleDeletePasskey(passkey.id)}
                  disabled={loading}
                >
                  <Text style={styles.deleteSmallButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ========== TOTP Section ========== */}
      <View style={commonStyles.card}>
        <Text style={styles.sectionTitle}>Authenticator App</Text>
        <Text style={styles.sectionDescription}>
          Use Google Authenticator or a compatible app to generate one-time codes for sign-in.
        </Text>

        {totpEnabled ? (
          <>
            <View style={styles.activeCard}>
              <View style={styles.activeHeader}>
                <Text style={styles.activeLabel}>Enabled</Text>
                <Text style={styles.activeIcon}>Active</Text>
              </View>
              {backupCodesStatus && (
                <View style={styles.cardDetails}>
                  <Text style={styles.detailText}>
                    Backup codes remaining: {backupCodesStatus.remaining} of {backupCodesStatus.total}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                commonStyles.button,
                commonStyles.buttonSecondary,
                loading && commonStyles.buttonDisabled,
              ]}
              onPress={handleRegenerateBackupCodes}
              disabled={loading}
            >
              <Text style={[commonStyles.buttonText, commonStyles.buttonSecondaryText]}>
                Regenerate Backup Codes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteButton, { marginTop: 12 }, loading && styles.buttonDisabled]}
              onPress={handleDisableTotp}
              disabled={loading}
            >
              <Text style={styles.deleteButtonText}>Disable Authenticator</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[commonStyles.button, loading && commonStyles.buttonDisabled]}
            onPress={handleSetupTotp}
            disabled={loading}
          >
            <Text style={commonStyles.buttonText}>Set Up Authenticator</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ========== Backup Codes Modal ========== */}
      <Modal
        visible={backupCodesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBackupCodesModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Backup Codes</Text>
            <Text style={styles.modalDescription}>
              Save these codes in a safe place. Each code can only be used once to sign in if you
              lose access to your authenticator app.
            </Text>

            <View style={styles.codesContainer}>
              {displayedBackupCodes.map((code, index) => (
                <Text key={index} style={styles.backupCode}>
                  {code}
                </Text>
              ))}
            </View>

            <TouchableOpacity
              style={commonStyles.button}
              onPress={() => setBackupCodesModal(false)}
            >
              <Text style={commonStyles.buttonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray100,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 20,
    lineHeight: 20,
  },
  activeCard: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  activeIcon: {
    fontSize: 12,
    color: colors.gray600,
    backgroundColor: colors.gray200,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cardDetails: {
    marginTop: 8,
  },
  detailText: {
    fontSize: 13,
    color: colors.gray600,
    marginBottom: 4,
  },
  deleteButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  otherDevicesSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  otherDevicesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: 12,
  },
  otherDeviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  otherDeviceType: {
    fontSize: 14,
    color: colors.gray800,
    fontWeight: '500',
  },
  otherDeviceDate: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
  deleteSmallButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#fee2e2',
  },
  deleteSmallButtonText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  modalContent: {
    flex: 1,
    padding: 24,
    paddingTop: 48,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 24,
    lineHeight: 20,
  },
  codesContainer: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  backupCode: {
    fontFamily: 'Courier',
    fontSize: 18,
    color: colors.gray900,
    textAlign: 'center',
    paddingVertical: 8,
    letterSpacing: 2,
  },
});
