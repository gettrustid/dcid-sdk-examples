/**
 * Offscreen Axios Adapter
 *
 * Custom axios adapter that proxies all HTTP requests through the background script.
 * This solves SSL/TLS SNI errors that occur when axios makes requests from the
 * offscreen document context in Chrome extensions.
 */

import axios from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { AxiosError, AxiosHeaders } from 'axios';

/**
 * Axios adapter that sends requests through the background script via chrome.runtime.sendMessage
 */
export const offscreenAxiosAdapter: AxiosAdapter = async (
  config: InternalAxiosRequestConfig
): Promise<AxiosResponse> => {
  console.log('[OffscreenAxiosAdapter] Proxying request:', config.method?.toUpperCase(), config.url, 'responseType:', config.responseType);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Request timeout for ${config.url}`));
    }, 30000);

    // Build full URL
    let url = config.url || '';
    if (config.baseURL && !url.startsWith('http')) {
      url = config.baseURL + url;
    }

    // Send request to background script
    chrome.runtime.sendMessage(
      {
        type: 'API_REQUEST',
        method: config.method?.toUpperCase() || 'GET',
        url: url,
        data: config.data,
        params: config.params,
        headers: config.headers,
        responseType: config.responseType,
      },
      (response) => {
        clearTimeout(timeout);

        if (chrome.runtime.lastError) {
          console.error('[OffscreenAxiosAdapter] Chrome runtime error:', chrome.runtime.lastError);
          reject(
            new AxiosError(
              chrome.runtime.lastError.message,
              'ERR_NETWORK',
              config,
              null,
              undefined
            )
          );
          return;
        }

        if (!response) {
          reject(
            new AxiosError(
              'No response received from background script',
              'ERR_NETWORK',
              config,
              null,
              undefined
            )
          );
          return;
        }

        if (!response.success) {
          console.error('[OffscreenAxiosAdapter] Request failed:', response.error);
          reject(
            new AxiosError(
              response.error || 'Request failed',
              'ERR_BAD_REQUEST',
              config,
              null,
              {
                status: response.status || 500,
                statusText: response.error || 'Internal Server Error',
                data: response.data,
                headers: new AxiosHeaders(response.headers || {}),
                config: config,
              } as AxiosResponse
            )
          );
          return;
        }

        console.log('[OffscreenAxiosAdapter] Request successful:', response.status);

        // Convert base64 back to ArrayBuffer if needed
        let responseData = response.data;
        if (response.isArrayBuffer && typeof response.data === 'string') {
          console.log('[OffscreenAxiosAdapter] Converting base64 to ArrayBuffer');
          const binaryString = atob(response.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          responseData = bytes.buffer;
        }

        // Build axios response object
        const axiosResponse: AxiosResponse = {
          data: responseData,
          status: response.status,
          statusText: getStatusText(response.status),
          headers: new AxiosHeaders(response.headers || {}),
          config: config,
        };

        resolve(axiosResponse);
      }
    );
  });
};

/**
 * Get HTTP status text for a status code
 */
function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return statusTexts[status] || 'Unknown';
}

/**
 * Configure axios to use the offscreen adapter globally
 * Call this once in the offscreen document initialization
 */
export function configureOffscreenAxios() {
  axios.defaults.adapter = offscreenAxiosAdapter;
  console.log('[OffscreenAxiosAdapter] ✅ Axios configured to proxy through background script');
}
