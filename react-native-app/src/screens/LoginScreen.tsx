import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useDCID } from '../contexts/DCIDContext';
import { commonStyles, colors } from '../styles/common';

export default function LoginScreen() {
  const { client, refreshAuthState } = useDCID();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async () => {
    setError(null);
    setLoading(true);

    try {
      await client?.auth.initiateSignIn(email);
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    setLoading(true);

    try {
      const tokens = await client?.auth.confirmCode(email, code);
      if (tokens) {
        await client?.auth.login(tokens.accessToken, tokens.refreshToken);
        refreshAuthState();
      }
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.logo}>DCID</Text>
          <Text style={styles.tagline}>Decentralized Identity</Text>
        </View>

        <View style={commonStyles.card}>
          {step === 'email' ? (
            <>
              <Text style={styles.cardTitle}>Sign In</Text>
              <Text style={styles.cardSubtitle}>
                Enter your email to receive a verification code
              </Text>

              <View style={styles.formGroup}>
                <Text style={commonStyles.label}>Email Address</Text>
                <TextInput
                  style={commonStyles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              {error && <Text style={commonStyles.error}>{error}</Text>}

              <TouchableOpacity
                style={[commonStyles.button, loading && commonStyles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={loading || !email}
              >
                <Text style={commonStyles.buttonText}>
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Enter Code</Text>
              <Text style={styles.cardSubtitle}>
                We sent a verification code to {email}
              </Text>

              <View style={styles.formGroup}>
                <Text style={commonStyles.label}>Verification Code</Text>
                <TextInput
                  style={commonStyles.input}
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                  autoFocus
                />
              </View>

              {error && <Text style={commonStyles.error}>{error}</Text>}

              <TouchableOpacity
                style={[commonStyles.button, loading && commonStyles.buttonDisabled]}
                onPress={handleVerifyCode}
                disabled={loading || !code}
              >
                <Text style={commonStyles.buttonText}>
                  {loading ? 'Verifying...' : 'Verify Code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  commonStyles.button,
                  commonStyles.buttonSecondary,
                  loading && commonStyles.buttonDisabled,
                ]}
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setError(null);
                }}
                disabled={loading}
              >
                <Text style={[commonStyles.buttonText, commonStyles.buttonSecondaryText]}>
                  Use Different Email
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: colors.white,
    opacity: 0.9,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.gray700,
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 16,
  },
});
