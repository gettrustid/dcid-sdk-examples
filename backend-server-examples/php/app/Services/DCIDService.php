<?php

namespace App\Services;

use DCID\ServerSDK\DCIDServerSDK;
use DCID\ServerSDK\Types\InitiateOTPOptions;
use DCID\ServerSDK\Types\ConfirmOTPOptions;
use DCID\ServerSDK\Types\RefreshTokenOptions;
use DCID\ServerSDK\Types\GenerateEncryptionKeyOptions;
use DCID\ServerSDK\Types\GetEncryptedKeyOptions;
use DCID\ServerSDK\Types\IssueCredentialOptions;
use DCID\ServerSDK\Types\GetCredentialOfferOptions;
use DCID\ServerSDK\Types\StoreCredentialOptions;
use DCID\ServerSDK\Types\RetrieveUserCredentialOptions;
use DCID\ServerSDK\Types\GetAllUserCredentialsOptions;
use DCID\ServerSDK\Types\VerifySignInOptions;
use DCID\ServerSDK\Types\GetLinkStoreOptions;
use DCID\ServerSDK\Types\PostLinkStoreOptions;
use DCID\ServerSDK\Types\VerifyCallbackOptions;
use DCID\ServerSDK\Types\StartSessionEvent;
use DCID\ServerSDK\Types\EndSessionEvent;

class DCIDService
{
    private DCIDServerSDK $sdk;

    public function __construct()
    {
        $this->sdk = new DCIDServerSDK([
            'apiKey' => config('dcid.api_key'),
            'environment' => config('dcid.environment', 'dev'),
            'timeout' => (int) config('dcid.timeout', 30000),
        ]);
    }

    public function setAuthToken(?string $token): void
    {
        if ($token) {
            $this->sdk->setAuthToken($token);
        }
    }

    public function setRefreshToken(string $token): void
    {
        $this->sdk->setRefreshToken($token);
    }

    public function getAuthToken(): ?string
    {
        return $this->sdk->getAuthToken();
    }

    public function getRefreshToken(): ?string
    {
        return $this->sdk->getRefreshToken();
    }

    // =========================================================================
    // Auth
    // =========================================================================

    public function registerOTP(array $data): array
    {
        $options = new InitiateOTPOptions(
            email: $data['email'] ?? null,
            phone: $data['phone'] ?? null,
        );

        return $this->toArray($this->sdk->auth->registerOtp($options));
    }

    public function confirmOTP(array $data): array
    {
        $options = new ConfirmOTPOptions(
            otp: $data['otp'],
            email: $data['email'] ?? null,
            phone: $data['phone'] ?? null,
        );

        $response = $this->sdk->auth->confirmOtp($options);
        $this->sdk->setTokens($response);

        return $this->tokenResponseToArray($response);
    }

    public function adminLogin(array $data): array
    {
        $options = new InitiateOTPOptions(
            email: $data['email'] ?? null,
            phone: $data['phone'] ?? null,
        );

        return $this->toArray($this->sdk->auth->adminLogin($options));
    }

    public function refreshToken(array $data): array
    {
        $options = new RefreshTokenOptions(
            refreshToken: $data['refreshToken'],
        );

        $response = $this->sdk->auth->refreshToken($options);
        $this->sdk->setTokens($response);

        return $this->tokenResponseToArray($response);
    }

    // =========================================================================
    // Identity - Encryption
    // =========================================================================

    public function generateEncryptionKey(array $data): array
    {
        $options = new GenerateEncryptionKeyOptions(
            did: $data['did'],
            ownerEmail: $data['ownerEmail'],
        );

        return $this->toArray($this->sdk->identity->encryption->generateKey($options));
    }

    public function getEncryptionKey(array $data): array
    {
        $options = new GetEncryptedKeyOptions(
            did: $data['did'],
        );

        return $this->toArray($this->sdk->identity->encryption->getKey($options));
    }

    // =========================================================================
    // Identity - Issuer
    // =========================================================================

    public function issueCredential(array $data): array
    {
        $options = new IssueCredentialOptions(
            did: $data['did'],
            credentialName: $data['credentialName'],
            values: $data['values'],
            ownerEmail: $data['ownerEmail'],
        );

        return $this->toArray($this->sdk->identity->issuer->issueCredential($options));
    }

    public function getCredentialOffer(array $query): array
    {
        $options = new GetCredentialOfferOptions(
            claimId: $query['claimId'],
            txId: $query['txId'],
        );

        return $this->toArray($this->sdk->identity->issuer->getCredentialOffer($options));
    }

    // =========================================================================
    // Identity - Data Storage
    // =========================================================================

    public function storeCredential(array $data): array
    {
        $options = new StoreCredentialOptions(
            did: $data['did'],
            credentialType: $data['credentialType'],
            credential: $data['credential'],
            encrypted: $data['encrypted'] ?? true,
        );

        return $this->toArray($this->sdk->identity->ipfs->storeCredential($options));
    }

    public function retrieveUserCredential(array $data): array
    {
        $options = new RetrieveUserCredentialOptions(
            did: $data['did'],
            credentialType: $data['credentialType'],
            includeCidOnly: $data['includeCidOnly'] ?? false,
        );

        return $this->toArray($this->sdk->identity->ipfs->retrieveUserCredential($options));
    }

    public function getAllUserCredentials(array $data): array
    {
        $options = new GetAllUserCredentialsOptions(
            did: $data['did'],
            includeCredentialData: $data['includeCredentialData'] ?? false,
        );

        return $this->toArray($this->sdk->identity->ipfs->getAllUserCredentials($options));
    }

    // =========================================================================
    // Identity - Verification
    // =========================================================================

    public function verifySignIn(array $data): array
    {
        $options = new VerifySignInOptions(
            credentialName: $data['credentialName'],
        );

        return $this->toArray($this->sdk->identity->verification->verifySignIn($options));
    }

    public function getLinkStore(array $query): array
    {
        $options = new GetLinkStoreOptions(
            id: $query['id'],
        );

        return $this->toArray($this->sdk->identity->verification->getLinkStore($options));
    }

    public function postLinkStore(array $data): array
    {
        $options = new PostLinkStoreOptions(
            id: $data['id'],
            thid: $data['thid'],
            type: $data['type'],
            from: $data['from'],
            typ: $data['typ'],
            body: $data['body'],
        );

        return $this->toArray($this->sdk->identity->verification->postLinkStore($options));
    }

    public function verifyCallback(array $data): array
    {
        $options = new VerifyCallbackOptions(
            sessionId: $data['sessionId'],
            token: $data['token'],
        );

        return $this->toArray($this->sdk->identity->verification->verifyCallback($options));
    }

    // =========================================================================
    // Analytics
    // =========================================================================

    public function startSession(array $data): array
    {
        $event = new StartSessionEvent(
            sessionId: $data['sessionId'] ?? null,
            userId: $data['userId'] ?? null,
            anonymousId: $data['anonymousId'] ?? null,
            pageLocation: $data['pageLocation'] ?? null,
            extra: $data['extra'] ?? [],
        );

        return $this->toArray($this->sdk->analytics->startSession($event));
    }

    public function endSession(array $data): array
    {
        $event = new EndSessionEvent(
            sessionId: $data['sessionId'],
            endedAt: $data['endedAt'] ?? null,
            extra: $data['extra'] ?? [],
        );

        return $this->toArray($this->sdk->analytics->endSession($event));
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private function toArray(object $response): array
    {
        return json_decode(json_encode($response), true);
    }

    /**
     * Convert TokenResponse to snake_case array matching what the client SDK expects.
     * The PHP server SDK uses camelCase properties (accessToken, refreshToken),
     * but the client SDK expects snake_case (access_token, refresh_token).
     */
    private function tokenResponseToArray(object $response): array
    {
        return [
            'access_token' => $response->accessToken,
            'refresh_token' => $response->refreshToken,
            ...($response->expiresIn !== null ? ['expires_in' => $response->expiresIn] : []),
        ];
    }
}
