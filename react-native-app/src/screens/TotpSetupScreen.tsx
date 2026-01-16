import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDCID } from '../contexts/DCIDContext';
import { commonStyles, colors } from '../styles/common';

interface TotpSetupData {
  secret: string;
  qrCode: string;
  otpauthUrl: string;
}

export default function TotpSetupScreen() {
  const navigation = useNavigation<any>();
  const { setupTotp, enableTotp } = useDCID();

  const [isLoading, setIsLoading] = useState(true);
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [backupCodesModal, setBackupCodesModal] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    loadSetupData();
  }, []);

  const loadSetupData = async () => {
    try {
      setIsLoading(true);
      const data = await setupTotp();
      setSetupData(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to setup authenticator: ' + (error.message || 'Unknown error'));
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableTotp = async () => {
    if (totpCode.length !== 6) {
      Alert.alert('Error', 'Please enter a 6-digit code');
      return;
    }
    try {
      setIsLoading(true);
      const codes = await enableTotp(totpCode);
      setBackupCodes(codes);
      setBackupCodesModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismissBackupCodes = () => {
    setBackupCodesModal(false);
    navigation.goBack();
  };

  if (isLoading && !setupData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Setting up authenticator...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={commonStyles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan QR Code</Text>
          <Text style={styles.description}>
            Open Google Authenticator or a compatible app and scan this QR code to add your account.
          </Text>
        </View>

        {setupData && (
          <>
            <View style={styles.qrContainer}>
              <Image
                source={{ uri: setupData.qrCode }}
                style={styles.qrCode}
                resizeMode="contain"
              />
            </View>

            <View style={styles.secretContainer}>
              <Text style={styles.secretLabel}>Or enter this code manually:</Text>
              <Text style={styles.secretCode}>{setupData.secret}</Text>
            </View>

            <View style={styles.codeSection}>
              <Text style={styles.codeLabel}>
                Enter the 6-digit code from the app:
              </Text>
              <TextInput
                style={styles.codeInput}
                value={totpCode}
                onChangeText={setTotpCode}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.enableButton, totpCode.length !== 6 && styles.disabledButton]}
                onPress={handleEnableTotp}
                disabled={totpCode.length !== 6 || isLoading}
              >
                <Text style={styles.enableButtonText}>
                  {isLoading ? 'Enabling...' : 'Enable'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Modal
          visible={backupCodesModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleDismissBackupCodes}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Backup Codes</Text>
            <Text style={styles.modalDescription}>
              Save these codes in a safe place. Each code can only be used once to sign in if you
              lose access to your authenticator app.
            </Text>

            <View style={styles.codesContainer}>
              {backupCodes.map((code, index) => (
                <Text key={index} style={styles.backupCode}>
                  {code}
                </Text>
              ))}
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleDismissBackupCodes}
            >
              <Text style={styles.saveButtonText}>I've Saved These Codes</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.gray700,
  },
  content: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: colors.gray700,
    textAlign: 'center',
    lineHeight: 22,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrCode: {
    width: 220,
    height: 220,
  },
  secretContainer: {
    backgroundColor: colors.gray100,
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  secretLabel: {
    fontSize: 12,
    color: colors.gray700,
    textAlign: 'center',
    marginBottom: 8,
  },
  secretCode: {
    fontSize: 14,
    fontFamily: 'Courier',
    fontWeight: '600',
    color: colors.gray900,
    textAlign: 'center',
    letterSpacing: 1,
  },
  codeSection: {
    marginBottom: 24,
  },
  codeLabel: {
    fontSize: 16,
    color: colors.gray700,
    textAlign: 'center',
    marginBottom: 12,
  },
  codeInput: {
    borderWidth: 2,
    borderColor: colors.gray300,
    borderRadius: 12,
    padding: 16,
    fontSize: 28,
    letterSpacing: 8,
    backgroundColor: colors.white,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.gray100,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  cancelButtonText: {
    color: colors.gray900,
    fontWeight: '600',
    fontSize: 16,
  },
  enableButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  enableButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: 24,
    backgroundColor: colors.white,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 48,
  },
  modalDescription: {
    fontSize: 16,
    color: colors.gray700,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  codesContainer: {
    backgroundColor: colors.gray100,
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  backupCode: {
    fontFamily: 'Courier',
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
});
