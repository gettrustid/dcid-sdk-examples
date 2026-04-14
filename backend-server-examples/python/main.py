"""Test server for DCID Server Python SDK"""

from dotenv import load_dotenv
load_dotenv()

import os
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, status, Request, Header
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from dcid_server_sdk import (
    DCIDServerSDK,
    InitiateOTPOptions,
    ConfirmOTPOptions,
    RefreshTokenOptions,
    GenerateEncryptionKeyOptions,
    GetEncryptedKeyOptions,
    IssueCredentialOptions,
    GetCredentialOfferOptions,
    StoreCredentialOptions,
    RetrieveUserCredentialOptions,
    GetAllUserCredentialsOptions,
    VerifySignInOptions,
    PostLinkStoreOptions,
    GetLinkStoreOptions,
    VerifyCallbackOptions,
    DCIDServerSDKError,
    NetworkError,
    AuthenticationError,
    ServerError,
)
from dcid_server_sdk.modules.analytics.types import StartSessionEvent, EndSessionEvent

app = FastAPI(title="DCID Server SDK Test Server", version="0.1.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SDK
api_key = os.getenv("DCID_API_KEY")
if not api_key:
    raise RuntimeError("DCID_API_KEY environment variable is required")

environment = os.getenv("DCID_ENVIRONMENT", "dev")
# Use longer timeout (2 min) for credential operations which may involve blockchain
sdk = DCIDServerSDK(api_key=api_key, environment=environment, timeout=120000, enable_request_logging=True)


def set_auth_from_request(authorization: Optional[str] = None):
    """Extract and set auth token from request header"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        sdk.set_auth_token(token)


# Pydantic models for request bodies
class RegisterOTPRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None


class ConfirmOTPRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    otp: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., alias="refreshToken")


class GenerateEncryptionKeyRequest(BaseModel):
    did: str
    owner_email: str = Field(..., alias="ownerEmail")


class GetEncryptedKeyRequest(BaseModel):
    did: str


class IssueCredentialRequest(BaseModel):
    did: str
    credential_name: str = Field(..., alias="credentialName")
    values: Dict[str, Any]
    owner_email: str = Field(..., alias="ownerEmail")


class GetCredentialOfferQuery(BaseModel):
    claim_id: str = Field(..., alias="claimId")
    tx_id: str = Field(..., alias="txId")


class StoreCredentialRequest(BaseModel):
    did: str
    credential_type: str = Field(..., alias="credentialType")
    credential: Any
    encrypted: bool = True


class RetrieveUserCredentialRequest(BaseModel):
    did: str
    credential_type: str = Field(..., alias="credentialType")
    include_cid_only: bool = Field(False, alias="includeCidOnly")


class GetAllUserCredentialsRequest(BaseModel):
    did: str
    include_credential_data: bool = Field(False, alias="includeCredentialData")


class VerifySignInRequest(BaseModel):
    credential_name: str = Field(..., alias="credentialName")


class PostLinkStoreRequest(BaseModel):
    id: str
    thid: str
    type: str
    from_did: str = Field(..., alias="from")
    typ: str
    body: Dict[str, Any]


class GetLinkStoreQuery(BaseModel):
    id: str


class VerifyCallbackRequest(BaseModel):
    token: str


class StartSessionRequest(BaseModel):
    user_id: Optional[str] = Field(None, alias="userId")
    anonymous_id: Optional[str] = Field(None, alias="anonymousId")
    page_location: Optional[str] = Field(None, alias="pageLocation")
    session_id: Optional[str] = Field(None, alias="sessionId")


class EndSessionRequest(BaseModel):
    session_id: str = Field(..., alias="sessionId")
    user_id: Optional[str] = Field(None, alias="userId")
    anonymous_id: Optional[str] = Field(None, alias="anonymousId")
    ended_at: Optional[str] = Field(None, alias="endedAt")


def handle_sdk_error(error: Exception):
    """Handle SDK errors and return appropriate HTTP responses"""
    # Debug: print full error details
    print(f"SDK Error: {type(error).__name__}: {error}")
    if hasattr(error, 'context') and error.context:
        print(f"  Context: url={error.context.url}, status={error.context.status_code}, source={error.context.error_source}")

    if isinstance(error, AuthenticationError):
        return JSONResponse(
            status_code=error.status_code or status.HTTP_401_UNAUTHORIZED,
            content={
                "error": str(error),
                "type": "AuthenticationError",
                "isAPIKeyError": error.is_api_key_error,
            },
        )
    elif isinstance(error, NetworkError):
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"error": str(error), "type": "NetworkError", "code": error.code},
        )
    elif isinstance(error, ServerError):
        return JSONResponse(
            status_code=error.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": str(error), "type": "ServerError"},
        )
    elif isinstance(error, DCIDServerSDKError):
        return JSONResponse(
            status_code=error.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": str(error), "type": "SDKError"},
        )
    else:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": str(error), "type": "UnknownError"},
        )


@app.get("/health")
def health():
    """Health check endpoint"""
    return {"status": "ok", "service": "dcid-server-sdk-test-server"}


# ============================================================================
# AUTH ROUTES (client SDK compatible)
# ============================================================================

@app.post("/api/auth/sign-in/initiate")
def sign_in_initiate(request: RegisterOTPRequest):
    """Initiate sign-in with OTP"""
    try:
        result = sdk.auth.register_otp(
            InitiateOTPOptions(email=request.email, phone=request.phone)
        )
        return {"otp": result.otp}
    except Exception as e:
        return handle_sdk_error(e)


@app.post("/api/auth/sign-in/confirm")
def sign_in_confirm(request: ConfirmOTPRequest):
    """Confirm sign-in with OTP"""
    try:
        tokens = sdk.auth.confirm_otp(
            ConfirmOTPOptions(
                email=request.email, phone=request.phone, otp=request.otp
            )
        )
        sdk.set_tokens(tokens)
        return {
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
        }
    except Exception as e:
        return handle_sdk_error(e)


@app.post("/api/auth/admin-login")
def admin_login(request: RegisterOTPRequest):
    """Admin login endpoint"""
    try:
        result = sdk.auth.admin_login(
            InitiateOTPOptions(email=request.email, phone=request.phone)
        )
        return {"otp": result.otp}
    except Exception as e:
        return handle_sdk_error(e)


@app.post("/api/auth/token/refresh")
def token_refresh(request: RefreshTokenRequest):
    """Refresh token endpoint"""
    try:
        tokens = sdk.auth.refresh_token(
            RefreshTokenOptions(refresh_token=request.refresh_token)
        )
        sdk.set_tokens(tokens)
        return {
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
        }
    except Exception as e:
        return handle_sdk_error(e)


# ============================================================================
# IDENTITY - ENCRYPTION ROUTES (client SDK compatible)
# ============================================================================

@app.post("/api/identity/get-encrypted-key")
def get_encrypted_key(request: GetEncryptedKeyRequest, authorization: Optional[str] = Header(None)):
    """Get encrypted key endpoint"""
    try:
        set_auth_from_request(authorization)
        result = sdk.identity.encryption.get_key(
            GetEncryptedKeyOptions(did=request.did)
        )
        return {
            "encryptedKey": result.encrypted_key,
            "did": result.did,
            "message": result.message,
        }
    except Exception as e:
        return handle_sdk_error(e)


@app.post("/api/identity/generate-encrypted-key")
def generate_encrypted_key(request: GenerateEncryptionKeyRequest, authorization: Optional[str] = Header(None)):
    """Generate encryption key endpoint"""
    try:
        set_auth_from_request(authorization)
        result = sdk.identity.encryption.generate_key(
            GenerateEncryptionKeyOptions(
                did=request.did, owner_email=request.owner_email
            )
        )
        return {
            "encryptedKey": result.encrypted_key,
            "did": result.did,
            "ownerEmail": result.owner_email,
            "message": result.message,
        }
    except Exception as e:
        return handle_sdk_error(e)


# ============================================================================
# IDENTITY - ISSUER ROUTES
# ============================================================================

@app.post("/api/identity/issuer/issue-credential")
def issue_credential(request: IssueCredentialRequest, authorization: Optional[str] = Header(None)):
    """Issue credential endpoint"""
    try:
        set_auth_from_request(authorization)
        result = sdk.identity.issuer.issue_credential(
            IssueCredentialOptions(
                did=request.did,
                credential_name=request.credential_name,
                values=request.values,
                owner_email=request.owner_email,
            )
        )
        # Convert Python snake_case keys back to camelCase for API consistency
        if "qr_code_link" in result:
            return {"qrCodeLink": result["qr_code_link"], "schemaType": result["schema_type"]}
        else:
            return {"txId": result["tx_id"], "claimId": result["claim_id"]}
    except Exception as e:
        return handle_sdk_error(e)


@app.get("/api/identity/issuer/get-credential-offer")
def get_credential_offer(claimId: str, txId: str, authorization: Optional[str] = Header(None)):
    """Get credential offer endpoint"""
    try:
        set_auth_from_request(authorization)
        result = sdk.identity.issuer.get_credential_offer(
            GetCredentialOfferOptions(claim_id=claimId, tx_id=txId)
        )
        return {
            "status": result.status,
            "txId": result.tx_id,
            "claimId": result.claim_id,
            "offerAvailable": result.offer_available,
            "qrCodeLink": result.qr_code_link,
            "offer": result.offer,
            "message": result.message,
        }
    except Exception as e:
        return handle_sdk_error(e)


# ============================================================================
# IDENTITY - IPFS ROUTES
# ============================================================================

@app.post("/api/identity/ipfs/store-credential")
def store_credential(request: StoreCredentialRequest, authorization: Optional[str] = Header(None)):
    """Store credential endpoint"""
    try:
        set_auth_from_request(authorization)
        result = sdk.identity.ipfs.store_credential(
            StoreCredentialOptions(
                did=request.did,
                credential_type=request.credential_type,
                credential=request.credential,
                encrypted=request.encrypted,
            )
        )
        return {
            "cid": result.cid,
            "did": result.did,
            "credentialType": result.credential_type,
            "message": result.message,
            "encrypted": result.encrypted,
        }
    except Exception as e:
        return handle_sdk_error(e)


@app.post("/api/identity/ipfs/retrieve-user-credential")
def retrieve_user_credential(request: RetrieveUserCredentialRequest, authorization: Optional[str] = Header(None)):
    """Retrieve user credential endpoint"""
    try:
        set_auth_from_request(authorization)
        result = sdk.identity.ipfs.retrieve_user_credential(
            RetrieveUserCredentialOptions(
                did=request.did,
                credential_type=request.credential_type,
                include_cid_only=request.include_cid_only,
            )
        )
        return {
            "cid": result.cid,
            "did": result.did,
            "credentialType": result.credential_type,
            "message": result.message,
            "credential": result.credential,
            "encrypted": result.encrypted,
        }
    except Exception as e:
        return handle_sdk_error(e)


# Client SDK compatible route
@app.post("/api/identity/get-all-user-credentials")
def get_all_user_credentials(request: GetAllUserCredentialsRequest, authorization: Optional[str] = Header(None)):
    """Get all user credentials endpoint"""
    try:
        set_auth_from_request(authorization)
        result = sdk.identity.ipfs.get_all_user_credentials(
            GetAllUserCredentialsOptions(
                did=request.did,
                include_credential_data=request.include_credential_data,
            )
        )
        return {
            "credentials": result.credentials,
            "did": result.did,
            "count": result.count,
            "message": result.message,
        }
    except Exception as e:
        return handle_sdk_error(e)


# ============================================================================
# IDENTITY - VERIFICATION ROUTES (client SDK compatible)
# ============================================================================

@app.post("/api/identity/verify/sign-in")
def verify_sign_in(request: VerifySignInRequest, authorization: Optional[str] = Header(None)):
    """Verify sign-in endpoint"""
    try:
        set_auth_from_request(authorization)
        result = sdk.identity.verification.verify_sign_in(
            VerifySignInOptions(credential_name=request.credential_name)
        )
        return {
            "proofRequestUrl": result.proof_request_url,
            "iden3commUrl": result.iden3comm_url,
            "sessionId": result.session_id,
        }
    except Exception as e:
        return handle_sdk_error(e)


@app.get("/api/identity/verification/link-store")
def get_link_store(id: str, authorization: Optional[str] = Header(None)):
    """Get link store endpoint"""
    try:
        set_auth_from_request(authorization)
        result = sdk.identity.verification.get_link_store(GetLinkStoreOptions(id=id))
        return {
            "id": result.id,
            "thid": result.thid,
            "type": result.type,
            "from": result.from_did,
            "typ": result.typ,
            "body": result.body,
        }
    except Exception as e:
        return handle_sdk_error(e)


@app.post("/api/identity/verification/link-store")
def post_link_store(request: PostLinkStoreRequest, authorization: Optional[str] = Header(None)):
    """Post link store endpoint"""
    try:
        set_auth_from_request(authorization)
        result = sdk.identity.verification.post_link_store(
            PostLinkStoreOptions(
                id=request.id,
                thid=request.thid,
                type=request.type,
                from_did=request.from_did,
                typ=request.typ,
                body=request.body,
            )
        )
        return {
            "proofRequestUrl": result.proof_request_url,
            "iden3commUrl": result.iden3comm_url,
        }
    except Exception as e:
        return handle_sdk_error(e)


@app.post("/api/identity/verification/callback")
def verify_callback(request: VerifyCallbackRequest, sessionId: str, authorization: Optional[str] = Header(None)):
    """Verify callback endpoint"""
    try:
        set_auth_from_request(authorization)
        result = sdk.identity.verification.verify_callback(
            VerifyCallbackOptions(session_id=sessionId, token=request.token)
        )
        return {
            "id": result.id,
            "typ": result.typ,
            "type": result.type,
            "thid": result.thid,
            "body": result.body,
            "from": result.from_did,
            "to": result.to,
        }
    except Exception as e:
        return handle_sdk_error(e)


# ============================================================================
# ANALYTICS ROUTES
# ============================================================================

@app.post("/api/analytics/start-session")
def start_session(request: StartSessionRequest):
    """Start session endpoint"""
    try:
        result = sdk.analytics.start_session(
            StartSessionEvent(
                user_id=request.user_id,
                anonymous_id=request.anonymous_id,
                page_location=request.page_location,
                session_id=request.session_id,
            )
        )
        return {
            "success": result.success,
            "session_id": result.session_id,
            "timestamp": result.timestamp,
            "anonymous_id": result.anonymous_id,
            "linked": result.linked,
        }
    except Exception as e:
        return handle_sdk_error(e)


@app.post("/api/analytics/end-session")
def end_session(request: EndSessionRequest):
    """End session endpoint"""
    try:
        result = sdk.analytics.end_session(
            EndSessionEvent(
                session_id=request.session_id,
                user_id=request.user_id,
                anonymous_id=request.anonymous_id,
                ended_at=request.ended_at,
            )
        )
        return {"success": result.success, "timestamp": result.timestamp}
    except Exception as e:
        return handle_sdk_error(e)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    print("===========================================")
    print("DCID Server SDK Test Server (Python)")
    print("===========================================")
    print(f"Environment: {environment}")
    print(f"Port: {port}")
    print(f"Health check: http://localhost:{port}/health")
    print("===========================================")
    print("Server is running and ready for requests...")
    uvicorn.run(app, host="0.0.0.0", port=port)
