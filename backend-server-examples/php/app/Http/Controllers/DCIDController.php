<?php

namespace App\Http\Controllers;

use App\Services\DCIDService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

#[OA\Info(
    version: '1.0.0',
    title: 'DCID Server SDK - PHP/Laravel',
    description: 'API endpoints for the DCID Server SDK Laravel example. Provides authentication, identity management, credential issuance/verification, data storage, and analytics.',
)]
#[OA\SecurityScheme(
    securityScheme: 'bearerAuth',
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Enter the JWT token obtained from sign-in or admin-login',
)]
#[OA\Tag(name: 'Auth', description: 'Authentication and token management')]
#[OA\Tag(name: 'Identity - Encryption', description: 'Encryption key generation and retrieval')]
#[OA\Tag(name: 'Identity - Issuer', description: 'Credential issuance and offers')]
#[OA\Tag(name: 'Identity - IPFS', description: 'Credential storage and retrieval')]
#[OA\Tag(name: 'Identity - Verification', description: 'Identity verification and callbacks')]
#[OA\Tag(name: 'Analytics', description: 'Session analytics tracking')]
class DCIDController extends Controller
{
    public function __construct(
        private DCIDService $sdk,
    ) {}

    // =========================================================================
    // Auth
    // =========================================================================

    #[OA\Post(
        path: '/api/auth/sign-in/initiate',
        summary: 'Initiate OTP sign-in',
        description: 'Sends a one-time password to the provided email or phone number.',
        tags: ['Auth'],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'email', type: 'string', example: 'user@example.com'),
                new OA\Property(property: 'phone', type: 'string', example: '+1234567890'),
            ],
        ),
    )]
    #[OA\Response(response: 200, description: 'OTP sent successfully')]
    public function signInInitiate(Request $request): JsonResponse
    {
        return response()->json($this->sdk->registerOTP($request->all()));
    }

    #[OA\Post(
        path: '/api/auth/sign-in/confirm',
        summary: 'Confirm OTP sign-in',
        description: 'Validates the OTP and returns authentication tokens.',
        tags: ['Auth'],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['otp'],
            properties: [
                new OA\Property(property: 'otp', type: 'string', example: '123456'),
                new OA\Property(property: 'email', type: 'string', example: 'user@example.com'),
                new OA\Property(property: 'phone', type: 'string', example: '+1234567890'),
            ],
        ),
    )]
    #[OA\Response(
        response: 200,
        description: 'Authentication successful',
        content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'access_token', type: 'string'),
                new OA\Property(property: 'refresh_token', type: 'string'),
            ],
        ),
    )]
    public function signInConfirm(Request $request): JsonResponse
    {
        return response()->json($this->sdk->confirmOTP($request->all()));
    }

    #[OA\Post(
        path: '/api/auth/admin-login',
        summary: 'Admin login',
        description: 'Authenticates an admin user with email or phone.',
        tags: ['Auth'],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'email', type: 'string', example: 'admin@example.com'),
                new OA\Property(property: 'phone', type: 'string', example: '+1234567890'),
            ],
        ),
    )]
    #[OA\Response(
        response: 200,
        description: 'Admin authentication successful',
        content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'accessToken', type: 'string'),
                new OA\Property(property: 'refreshToken', type: 'string'),
            ],
        ),
    )]
    public function adminLogin(Request $request): JsonResponse
    {
        return response()->json($this->sdk->adminLogin($request->all()));
    }

    #[OA\Post(
        path: '/api/auth/refresh-token',
        summary: 'Refresh access token',
        description: 'Exchanges a refresh token for a new access token.',
        tags: ['Auth'],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['refreshToken'],
            properties: [
                new OA\Property(property: 'refreshToken', type: 'string'),
            ],
        ),
    )]
    #[OA\Response(
        response: 200,
        description: 'Token refreshed successfully',
        content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'access_token', type: 'string'),
                new OA\Property(property: 'refresh_token', type: 'string'),
            ],
        ),
    )]
    public function tokenRefresh(Request $request): JsonResponse
    {
        return response()->json($this->sdk->refreshToken($request->all()));
    }

    // =========================================================================
    // Identity - Encryption
    // =========================================================================

    #[OA\Post(
        path: '/api/identity/generate-encrypted-key',
        summary: 'Generate an encrypted key',
        description: 'Generates an encryption key for the specified DID.',
        tags: ['Identity - Encryption'],
        security: [['bearerAuth' => []]],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['did', 'ownerEmail'],
            properties: [
                new OA\Property(property: 'did', type: 'string', example: 'did:example:123'),
                new OA\Property(property: 'ownerEmail', type: 'string', example: 'user@example.com'),
            ],
        ),
    )]
    #[OA\Response(response: 200, description: 'Encryption key generated')]
    public function generateEncryptedKey(Request $request): JsonResponse
    {
        $this->setAuthFromRequest($request);
        $originalToken = $request->bearerToken();

        return $this->withTokenRefreshHeaders(
            response()->json($this->sdk->generateEncryptionKey($request->all())),
            $originalToken
        );
    }

    #[OA\Post(
        path: '/api/identity/get-encrypted-key',
        summary: 'Get an encrypted key',
        description: 'Retrieves the encryption key for the specified DID.',
        tags: ['Identity - Encryption'],
        security: [['bearerAuth' => []]],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['did'],
            properties: [
                new OA\Property(property: 'did', type: 'string', example: 'did:example:123'),
            ],
        ),
    )]
    #[OA\Response(response: 200, description: 'Encryption key retrieved')]
    public function getEncryptedKey(Request $request): JsonResponse
    {
        $this->setAuthFromRequest($request);
        $originalToken = $request->bearerToken();

        return $this->withTokenRefreshHeaders(
            response()->json($this->sdk->getEncryptionKey($request->all())),
            $originalToken
        );
    }

    // =========================================================================
    // Identity - Issuer
    // =========================================================================

    #[OA\Post(
        path: '/api/identity/issuer/issue-credential',
        summary: 'Issue a credential',
        description: 'Issues a verifiable credential for the specified DID.',
        tags: ['Identity - Issuer'],
        security: [['bearerAuth' => []]],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['did', 'credentialName', 'values', 'ownerEmail'],
            properties: [
                new OA\Property(property: 'did', type: 'string', example: 'did:example:123'),
                new OA\Property(property: 'credentialName', type: 'string', example: 'KYCAgeCredential'),
                new OA\Property(property: 'values', type: 'object', example: '{"birthday": 19900101}'),
                new OA\Property(property: 'ownerEmail', type: 'string', example: 'user@example.com'),
            ],
        ),
    )]
    #[OA\Response(response: 200, description: 'Credential issued successfully')]
    public function issueCredential(Request $request): JsonResponse
    {
        \Log::info('[DEBUG-DCID] issueCredential', [
            'bearerToken' => $request->bearerToken() ? 'present (' . strlen($request->bearerToken()) . ' chars)' : 'NULL',
            'authHeader' => $request->header('Authorization') ? 'present' : 'NULL',
            'allHeaders' => collect($request->headers->all())->keys()->toArray(),
        ]);

        $this->setAuthFromRequest($request);
        $originalToken = $request->bearerToken();

        return $this->withTokenRefreshHeaders(
            response()->json($this->sdk->issueCredential($request->all())),
            $originalToken
        );
    }

    #[OA\Get(
        path: '/api/identity/issuer/get-credential-offer',
        summary: 'Get a credential offer',
        description: 'Retrieves a credential offer by claim ID and transaction ID.',
        tags: ['Identity - Issuer'],
        security: [['bearerAuth' => []]],
    )]
    #[OA\Parameter(name: 'claimId', in: 'query', required: true, schema: new OA\Schema(type: 'string'))]
    #[OA\Parameter(name: 'txId', in: 'query', required: true, schema: new OA\Schema(type: 'string'))]
    #[OA\Response(response: 200, description: 'Credential offer retrieved')]
    public function getCredentialOffer(Request $request): JsonResponse
    {
        $this->setAuthFromRequest($request);
        $originalToken = $request->bearerToken();

        return $this->withTokenRefreshHeaders(
            response()->json($this->sdk->getCredentialOffer($request->query())),
            $originalToken
        );
    }

    // =========================================================================
    // Identity - IPFS
    // =========================================================================

    #[OA\Post(
        path: '/api/identity/ipfs/store-credential',
        summary: 'Store a credential',
        description: 'Stores a credential for the specified DID.',
        tags: ['Identity - IPFS'],
        security: [['bearerAuth' => []]],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['did', 'credentialType', 'credential'],
            properties: [
                new OA\Property(property: 'did', type: 'string', example: 'did:example:123'),
                new OA\Property(property: 'credentialType', type: 'string', example: 'KYCAgeCredential'),
                new OA\Property(property: 'credential', type: 'object'),
                new OA\Property(property: 'encrypted', type: 'boolean', example: false),
            ],
        ),
    )]
    #[OA\Response(response: 200, description: 'Credential stored')]
    public function storeCredential(Request $request): JsonResponse
    {
        $this->setAuthFromRequest($request);
        $originalToken = $request->bearerToken();

        return $this->withTokenRefreshHeaders(
            response()->json($this->sdk->storeCredential($request->all())),
            $originalToken
        );
    }

    #[OA\Post(
        path: '/api/identity/ipfs/retrieve-user-credential',
        summary: 'Retrieve a user credential',
        description: 'Retrieves a specific credential type for the specified DID.',
        tags: ['Identity - IPFS'],
        security: [['bearerAuth' => []]],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['did', 'credentialType'],
            properties: [
                new OA\Property(property: 'did', type: 'string', example: 'did:example:123'),
                new OA\Property(property: 'credentialType', type: 'string', example: 'KYCAgeCredential'),
                new OA\Property(property: 'includeCidOnly', type: 'boolean', example: false),
            ],
        ),
    )]
    #[OA\Response(response: 200, description: 'Credential retrieved')]
    public function retrieveUserCredential(Request $request): JsonResponse
    {
        $this->setAuthFromRequest($request);
        $originalToken = $request->bearerToken();

        return $this->withTokenRefreshHeaders(
            response()->json($this->sdk->retrieveUserCredential($request->all())),
            $originalToken
        );
    }

    #[OA\Post(
        path: '/api/identity/ipfs/get-all-user-credentials',
        summary: 'Get all user credentials',
        description: 'Retrieves all stored credentials for the specified DID.',
        tags: ['Identity - IPFS'],
        security: [['bearerAuth' => []]],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['did'],
            properties: [
                new OA\Property(property: 'did', type: 'string', example: 'did:example:123'),
                new OA\Property(property: 'includeCredentialData', type: 'boolean', example: true),
            ],
        ),
    )]
    #[OA\Response(response: 200, description: 'All credentials retrieved')]
    public function getAllUserCredentials(Request $request): JsonResponse
    {
        $this->setAuthFromRequest($request);
        $originalToken = $request->bearerToken();

        return $this->withTokenRefreshHeaders(
            response()->json($this->sdk->getAllUserCredentials($request->all())),
            $originalToken
        );
    }

    #[OA\Post(
        path: '/api/identity/get-all-user-credentials',
        summary: 'Get all user credentials',
        description: 'Retrieves all credentials for the specified DID (alias for the ipfs endpoint).',
        tags: ['Identity - IPFS'],
        security: [['bearerAuth' => []]],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['did'],
            properties: [
                new OA\Property(property: 'did', type: 'string', example: 'did:example:123'),
                new OA\Property(property: 'includeCredentialData', type: 'boolean', example: true),
            ],
        ),
    )]
    #[OA\Response(response: 200, description: 'All credentials retrieved')]
    public function getAllUserCredentialsAlt(Request $request): JsonResponse
    {
        return $this->getAllUserCredentials($request);
    }

    // =========================================================================
    // Identity - Verification
    // =========================================================================

    #[OA\Post(
        path: '/api/identity/verify/sign-in',
        summary: 'Verify sign-in with credential',
        description: 'Initiates a credential-based sign-in verification.',
        tags: ['Identity - Verification'],
        security: [['bearerAuth' => []]],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['credentialName'],
            properties: [
                new OA\Property(property: 'credentialName', type: 'string', example: 'KYCAgeCredential'),
            ],
        ),
    )]
    #[OA\Response(response: 200, description: 'Verification initiated')]
    public function verifySignIn(Request $request): JsonResponse
    {
        $this->setAuthFromRequest($request);
        $originalToken = $request->bearerToken();

        return $this->withTokenRefreshHeaders(
            response()->json($this->sdk->verifySignIn($request->all())),
            $originalToken
        );
    }

    #[OA\Get(
        path: '/api/identity/verification/link-store',
        summary: 'Get link store',
        description: 'Retrieves link store data by ID.',
        tags: ['Identity - Verification'],
        security: [['bearerAuth' => []]],
    )]
    #[OA\Parameter(name: 'id', in: 'query', required: true, schema: new OA\Schema(type: 'string'))]
    #[OA\Response(response: 200, description: 'Link store data retrieved')]
    public function getLinkStore(Request $request): JsonResponse
    {
        $this->setAuthFromRequest($request);
        $originalToken = $request->bearerToken();

        return $this->withTokenRefreshHeaders(
            response()->json($this->sdk->getLinkStore($request->query())),
            $originalToken
        );
    }

    #[OA\Post(
        path: '/api/identity/verification/link-store',
        summary: 'Post to link store',
        description: 'Posts data to the link store for verification.',
        tags: ['Identity - Verification'],
        security: [['bearerAuth' => []]],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['id', 'thid', 'type', 'from', 'typ', 'body'],
            properties: [
                new OA\Property(property: 'id', type: 'string'),
                new OA\Property(property: 'thid', type: 'string'),
                new OA\Property(property: 'type', type: 'string'),
                new OA\Property(property: 'from', type: 'string'),
                new OA\Property(property: 'typ', type: 'string'),
                new OA\Property(property: 'body', type: 'object'),
            ],
        ),
    )]
    #[OA\Response(response: 200, description: 'Link store updated')]
    public function postLinkStore(Request $request): JsonResponse
    {
        $this->setAuthFromRequest($request);
        $originalToken = $request->bearerToken();

        return $this->withTokenRefreshHeaders(
            response()->json($this->sdk->postLinkStore($request->all())),
            $originalToken
        );
    }

    #[OA\Post(
        path: '/api/identity/verification/callback',
        summary: 'Verification callback',
        description: 'Handles the verification callback with session ID and token.',
        tags: ['Identity - Verification'],
        security: [['bearerAuth' => []]],
    )]
    #[OA\Parameter(name: 'sessionId', in: 'query', required: false, schema: new OA\Schema(type: 'string'))]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['sessionId', 'token'],
            properties: [
                new OA\Property(property: 'sessionId', type: 'string'),
                new OA\Property(property: 'token', type: 'string'),
            ],
        ),
    )]
    #[OA\Response(response: 200, description: 'Verification callback processed')]
    public function verificationCallback(Request $request): JsonResponse
    {
        $this->setAuthFromRequest($request);
        $originalToken = $request->bearerToken();

        $data = $request->all();
        if ($request->query('sessionId')) {
            $data['sessionId'] = $request->query('sessionId');
        }

        return $this->withTokenRefreshHeaders(
            response()->json($this->sdk->verifyCallback($data)),
            $originalToken
        );
    }

    // =========================================================================
    // Analytics
    // =========================================================================

    #[OA\Post(
        path: '/api/analytics/start-session',
        summary: 'Start an analytics session',
        description: 'Starts a new analytics tracking session.',
        tags: ['Analytics'],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'sessionId', type: 'string'),
                new OA\Property(property: 'userId', type: 'string'),
                new OA\Property(property: 'anonymousId', type: 'string'),
                new OA\Property(property: 'pageLocation', type: 'string', example: 'https://example.com/home'),
                new OA\Property(property: 'extra', type: 'object'),
            ],
        ),
    )]
    #[OA\Response(response: 200, description: 'Session started')]
    public function startSession(Request $request): JsonResponse
    {
        return response()->json($this->sdk->startSession($request->all()));
    }

    #[OA\Post(
        path: '/api/analytics/end-session',
        summary: 'End an analytics session',
        description: 'Ends an existing analytics tracking session.',
        tags: ['Analytics'],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['sessionId'],
            properties: [
                new OA\Property(property: 'sessionId', type: 'string'),
                new OA\Property(property: 'endedAt', type: 'string', format: 'date-time'),
                new OA\Property(property: 'extra', type: 'object'),
            ],
        ),
    )]
    #[OA\Response(response: 200, description: 'Session ended')]
    public function endSession(Request $request): JsonResponse
    {
        return response()->json($this->sdk->endSession($request->all()));
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private function setAuthFromRequest(Request $request): void
    {
        if ($request->bearerToken()) {
            $this->sdk->setAuthToken($request->bearerToken());
        }
        if ($request->header('X-Refresh-Token')) {
            $this->sdk->setRefreshToken($request->header('X-Refresh-Token'));
        }
    }

    /**
     * If the SDK auto-refreshed tokens during this request, attach the new
     * tokens as response headers so the client can update its stored tokens.
     */
    private function withTokenRefreshHeaders(JsonResponse $response, ?string $originalToken): JsonResponse
    {
        $currentToken = $this->sdk->getAuthToken();
        if ($currentToken && $originalToken && $currentToken !== $originalToken) {
            $response->header('X-New-Access-Token', $currentToken);
            $refreshToken = $this->sdk->getRefreshToken();
            if ($refreshToken) {
                $response->header('X-New-Refresh-Token', $refreshToken);
            }
        }
        return $response;
    }
}
