# DCID Backend Server - PHP (Laravel)

Example backend server using Laravel to proxy requests to the DCID API. Exposes the same REST API endpoints as the TypeScript, Python, and Go examples.

## Requirements

- PHP 8.2+
- Composer

## Setup & Run

```bash
cd php

# Install dependencies
composer install

# Configure environment
cp .env.example .env
php artisan key:generate
# Edit .env and add your DCID_API_KEY

# Optimize for faster startup (caches config/routes/views)
php artisan optimize

# Run the server on port 5005
php artisan serve --port=5005
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DCID_API_KEY` | Yes | - | Your DCID API key |
| `DCID_ENVIRONMENT` | No | `dev` | Environment (`dev` or `prod`) |
| `SDK_TIMEOUT` | No | `120000` | Request timeout in milliseconds (min 120s) |
| `SDK_CONNECT_TIMEOUT` | No | `10000` | Connection timeout in milliseconds (min 10s) |

## Updating the SDK

To pull the latest version of `dcid/server-sdk`:

```bash
composer update dcid/server-sdk
```

## Project Structure

```
php/
├── app/
│   ├── Http/Controllers/
│   │   └── DCIDController.php    # All API endpoint handlers
│   └── Services/
│       └── DCIDService.php       # HTTP client wrapper for DCID API
├── bootstrap/
│   └── app.php                   # App config + error handling
├── config/
│   └── dcid.php                  # DCID config values
├── routes/
│   ├── api.php                   # API routes (/api/...)
│   └── web.php                   # Health check route
├── .env.example
├── composer.json
└── README.md
```

## Testing

```bash
# Health check
curl http://localhost:5005/health

# Test an endpoint
curl -X POST http://localhost:5005/api/auth/sign-in/initiate \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```
