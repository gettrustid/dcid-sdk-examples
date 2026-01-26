# DCID Backend SDK Test Server

A FastAPI-based test server that exposes HTTP endpoints for all DCID Backend SDK methods.

## Features

- Complete coverage of all SDK methods
- RESTful API endpoints
- Automatic error handling
- Request/response logging
- Compatible with the TypeScript and Go test servers

## Quick Start

### Installation

```bash
# Install dependencies
pip install -r requirements.txt
```

### Configuration

Set the required environment variables:

```bash
export DCID_API_KEY="your-api-key"
export DCID_ENVIRONMENT="dev"  # or "prod"
export PORT="8080"  # optional
```

Or create a `.env` file:

```
DCID_API_KEY=your-api-key
DCID_ENVIRONMENT=dev
PORT=8080
```

### Running the Server

```bash
# Using Python
python main.py

# Or using uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

The server will start on `http://localhost:8080`.

## API Documentation

Once the server is running, you can access the interactive API documentation at:

- Swagger UI: `http://localhost:8080/docs`
- ReDoc: `http://localhost:8080/redoc`

## Example Requests

### Health Check

```bash
curl http://localhost:8080/health
```

### Initiate Sign-In

```bash
curl -X POST http://localhost:8080/api/auth/sign-in/initiate \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

### Confirm Sign-In

```bash
curl -X POST http://localhost:8080/api/auth/sign-in/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "otp": "123456"
  }'
```

### Generate Encryption Key

```bash
curl -X POST http://localhost:8080/api/identity/generate-encrypted-key \
  -H "Content-Type: application/json" \
  -d '{
    "did": "did:iden3:dcid:main:...",
    "ownerEmail": "user@example.com"
  }'
```

### Start Analytics Session

```bash
curl -X POST http://localhost:8080/api/analytics/start-session \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "pageLocation": "https://example.com"
  }'
```

## Endpoints

### Authentication
- `POST /api/auth/sign-in/initiate`
- `POST /api/auth/sign-in/confirm`
- `POST /api/auth/admin-login`
- `POST /api/auth/token/refresh`

### Identity - Encryption
- `POST /api/identity/generate-encrypted-key`
- `POST /api/identity/get-encrypted-key`

### Identity - Issuer
- `POST /api/identity/issuer/issue-credential`
- `GET /api/identity/issuer/get-credential-offer`

### Identity - IPFS
- `POST /api/identity/ipfs/store-credential`
- `POST /api/identity/ipfs/retrieve-user-credential`
- `POST /api/identity/get-all-user-credentials`

### Identity - Verification
- `POST /api/identity/verify/sign-in`
- `GET /api/identity/verification/link-store`
- `POST /api/identity/verification/link-store`
- `POST /api/identity/verification/callback`

### Analytics
- `POST /api/analytics/start-session`
- `POST /api/analytics/end-session`

## Error Handling

The server returns consistent error responses:

```json
{
  "error": "Error message",
  "type": "ErrorType"
}
```

Error types:
- `AuthenticationError`: API-KEY or JWT token issues
- `NetworkError`: Network connectivity issues
- `ServerError`: Backend or gateway errors
- `SDKError`: General SDK errors
- `UnknownError`: Unexpected errors
