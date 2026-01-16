import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useDCID } from '../contexts/DCIDContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import IdentityScreen from '../screens/IdentityScreen';
import CredentialsScreen from '../screens/CredentialsScreen';
import IssueCredentialScreen from '../screens/IssueCredentialScreen';
import ProofVerificationScreen from '../screens/ProofVerificationScreen';
import RecoveryScreen from '../screens/RecoveryScreen';
import BackupScreen from '../screens/BackupScreen';
import SecurityScreen from '../screens/SecurityScreen';
import TotpSetupScreen from '../screens/TotpSetupScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Identity: undefined;
  Credentials: undefined;
  IssueCredential: undefined;
  ProofVerification: undefined;
  Recovery: undefined;
  Backup: undefined;
  Security: undefined;
  TotpSetup: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { isLoading, isAuthenticated } = useDCID();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0d10ec" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0d10ec',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'DCID' }}
          />
          <Stack.Screen
            name="Identity"
            component={IdentityScreen}
            options={{ title: 'Decentralized Identity' }}
          />
          <Stack.Screen
            name="Credentials"
            component={CredentialsScreen}
            options={{ title: 'My Credentials' }}
          />
          <Stack.Screen
            name="IssueCredential"
            component={IssueCredentialScreen}
            options={{ title: 'Issue Credential' }}
          />
          <Stack.Screen
            name="ProofVerification"
            component={ProofVerificationScreen}
            options={{ title: 'Generate Proof' }}
          />
          <Stack.Screen
            name="Recovery"
            component={RecoveryScreen}
            options={{ title: 'Recover Credentials' }}
          />
          <Stack.Screen
            name="Backup"
            component={BackupScreen}
            options={{ title: 'Backup Credentials' }}
          />
          <Stack.Screen
            name="Security"
            component={SecurityScreen}
            options={{ title: 'Security' }}
          />
          <Stack.Screen
            name="TotpSetup"
            component={TotpSetupScreen}
            options={{ title: 'Set Up Authenticator' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
