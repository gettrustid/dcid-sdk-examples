# DCID Backend Server Examples

Example backend servers demonstrating how to use the DCID Server SDK in different languages. Each server exposes the same REST API endpoints for authentication, identity management, and analytics.

## Available Servers

| Language | Framework | Directory |
|----------|-----------|-----------|
| TypeScript | Express.js | `typescript/` |
| Python | FastAPI | `python/` |
| Go | net/http | `golang/` |

## Prerequisites

- A valid `DCID_API_KEY` from your DCID account
- The [DCID Backend SDK](../../dcid-backend-sdk) built locally
- Language-specific requirements (see below)

> **Note:** These examples reference the SDK locally (e.g., `file:../../../dcid-backend-sdk/typescript`). Make sure you have the SDK cloned and built before running.

## Environment Configuration

All servers use the same environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DCID_API_KEY` | Yes | - | Your DCID API key |
| `DCID_ENVIRONMENT` | No | `dev` | Environment (`dev` or `prod`) |
| `PORT` | No | `8080` | Server port |

---

## TypeScript (Express.js)

### Requirements
- Node.js 18+
- npm or yarn

### Setup & Run

```bash
# First, build the SDK (if not already built)
cd ../../../dcid-backend-sdk/typescript
npm install && npm run build
cd -

cd typescript

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your DCID_API_KEY

# Run in development mode
npm run dev

# Or build and run in production
npm run build
npm start
```

### Scripts
- `npm run dev` - Run with ts-node (development)
- `npm run build` - Compile TypeScript
- `npm start` - Run compiled JavaScript (production)

---

## Python (FastAPI)

### Requirements
- Python 3.8+
- pip

### Setup & Run

```bash
cd python

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your DCID_API_KEY

# Run the server
python main.py
```

### Features
- Interactive API docs at `http://localhost:8080/docs` (Swagger UI)
- Alternative docs at `http://localhost:8080/redoc`

---

## Go (net/http)

### Requirements
- Go 1.21+

### Setup & Run

```bash
cd golang

# Download dependencies
go mod tidy

# Configure environment
cp .env.example .env
# Edit .env and add your DCID_API_KEY

# Run the server
source .env && go run main.go

# Or build and run
go build -o server main.go
source .env && ./server
```

---

## API Endpoints

All servers expose the same endpoints:

### Health Check
- `GET /health` - Server health status

### Authentication
- `POST /api/auth/sign-in/initiate` - Initiate sign-in with OTP
- `POST /api/auth/sign-in/confirm` - Confirm OTP and get tokens
- `POST /api/auth/admin-login` - Admin login
- `POST /api/auth/token/refresh` - Refresh access token

### Identity - Encryption
- `POST /api/identity/generate-encrypted-key` - Generate encryption key
- `POST /api/identity/get-encrypted-key` - Get encryption key

### Identity - Issuer
- `POST /api/identity/issuer/issue-credential` - Issue a credential
- `GET /api/identity/issuer/get-credential-offer` - Get credential offer

### Identity - IPFS
- `POST /api/identity/ipfs/store-credential` - Store credential on IPFS
- `POST /api/identity/ipfs/retrieve-user-credential` - Retrieve user credential
- `POST /api/identity/get-all-user-credentials` - Get all user credentials

### Identity - Verification
- `POST /api/identity/verify/sign-in` - Initiate verification
- `GET /api/identity/verification/link-store` - Get link store
- `POST /api/identity/verification/link-store` - Post link store
- `POST /api/identity/verification/callback` - Verification callback

### Analytics
- `POST /api/analytics/start-session` - Start analytics session
- `POST /api/analytics/end-session` - End analytics session

---

## Testing

Test the health endpoint to verify the server is running:

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "dcid-server-sdk-test-server"
}
```

Test an API endpoint:

```bash
curl -X POST http://localhost:8080/api/auth/sign-in/initiate \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

---

## Environment URLs

The SDK connects to different backends based on `DCID_ENVIRONMENT`:

| Environment | Backend URL |
|-------------|-------------|
| `dev` | `http://krakend.dev-external.trustid.life/api` |
| `prod` | `https://gateway.trustid.life/api` |
