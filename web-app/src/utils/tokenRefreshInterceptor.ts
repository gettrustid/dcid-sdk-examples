import type { DCIDClient } from '@dcid/sdk';
import type { IdentityAPI } from '@dcid/sdk';

/**
 * Attaches axios interceptors to an IdentityAPI instance so that:
 * 1. Every request includes the refresh token as `X-Refresh-Token` header
 *    (enables the PHP backend SDK to auto-refresh expired JWTs).
 * 2. Every response is inspected for `X-New-Access-Token` /
 *    `X-New-Refresh-Token` headers — if present, the client's stored
 *    tokens are updated transparently.
 */
export function attachTokenRefreshInterceptors(
  identityAPI: IdentityAPI,
  client: DCIDClient,
): void {
  // The IdentityAPI stores an APIClient as `this.client` (private).
  // APIClient has `getInstance()` returning the underlying AxiosInstance.
  const apiClient = (identityAPI as any).client;
  if (!apiClient) return;

  // Use the public getInstance() method if available, otherwise try direct access
  const axiosInstance = typeof apiClient.getInstance === 'function'
    ? apiClient.getInstance()
    : apiClient.axiosInstance ?? apiClient;

  // Guard: only attach if it looks like an axios instance with interceptors
  if (!axiosInstance?.interceptors) return;

  // Request interceptor: attach refresh token on every outgoing request
  axiosInstance.interceptors.request.use((config: any) => {
    const refreshToken = client.auth.getRefreshToken();
    if (refreshToken) {
      config.headers = config.headers || {};
      config.headers['X-Refresh-Token'] = refreshToken;
    }
    return config;
  });

  // Response interceptor: pick up refreshed tokens from PHP backend
  axiosInstance.interceptors.response.use((response: any) => {
    const newAccessToken = response.headers?.['x-new-access-token'];
    const newRefreshToken = response.headers?.['x-new-refresh-token'];

    if (newAccessToken && newRefreshToken) {
      // Update the client SDK's stored tokens
      client.auth.login(newAccessToken, newRefreshToken).catch((err: any) => {
        console.warn('[TokenRefresh] Failed to update tokens:', err);
      });
      console.log('[TokenRefresh] Tokens refreshed via backend auto-refresh');
    }
    return response;
  });
}
