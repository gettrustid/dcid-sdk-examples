export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function sendMessage<T = any>(
  type: string,
  payload?: any
): Promise<MessageResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          error: chrome.runtime.lastError.message,
        });
      } else {
        resolve(response);
      }
    });
  });
}

export const messages = {
  getAuthState: () => sendMessage('GET_AUTH_STATE'),
  initiateSignIn: (email: string) => sendMessage('INITIATE_SIGNIN', { email }),
  confirmCode: (email: string, code: string) => sendMessage('CONFIRM_CODE', { email, code }),
  logout: () => sendMessage('LOGOUT'),
  getIdentity: () => sendMessage('GET_IDENTITY'),
  createIdentity: () => sendMessage('CREATE_IDENTITY'),
  getCredentials: () => sendMessage('GET_CREDENTIALS'),
  issueCredential: (credentialType: string, credentialData: Record<string, any>) =>
    sendMessage('ISSUE_CREDENTIAL', { credentialType, credentialData }),
  createProof: (proofRequestUrl: string) => sendMessage('CREATE_PROOF', { proofRequestUrl }),
  verifyCredential: (credentialType: string) => sendMessage('VERIFY_CREDENTIAL', { credentialType }),
  recoverCredentials: () => sendMessage('RECOVER_CREDENTIALS'),
};
