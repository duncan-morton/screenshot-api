# URLShot API

Capture full-page screenshots of any public website URL with a simple HTTP API.

## Base URL

- Local: `http://localhost:3000`
- Production: `https://urlshot.dev`
- RapidAPI: `https://urlshot.dev` (if proxied through RapidAPI, use your assigned RapidAPI host in headers)

## Endpoints

### Health Check

`GET /api/test`

Returns service status.

#### Example response

```json
{
  "status": "ok",
  "message": "Screenshot API is running"
}
```

### Capture Screenshot

`POST /api/screenshot`

Captures a full-page screenshot and returns binary image data.

#### Request body

```json
{
  "url": "https://example.com",
  "width": 1920,
  "format": "png"
}
```

#### Parameters

- `url` (string, required): Target website URL. Must be `http://` or `https://`.
- `width` (number, optional): Viewport width in pixels (`320` to `3840`). Default: `1920`.
- `format` (string, optional): `png` or `jpeg`. Default: `png`.

#### Success response

- `200 OK`
- Content-Type: `image/png` or `image/jpeg`
- Body: binary image data

#### Error responses

- `400 Bad Request`
  - Invalid/missing JSON body
  - Invalid URL
  - Invalid width
- `429 Too Many Requests`
  - Rate limit exceeded
- `500 Internal Server Error`
  - Screenshot generation failed (browser startup, navigation, timeout, etc.)

## Rate Limits

- `10` requests per IP per minute
- Exceeded requests return `429 Too Many Requests`

## Known Limitations

- Only publicly accessible `http://` and `https://` pages are supported.
- Sites requiring login, session cookies, or MFA are not supported by default.
- Some websites block automated browsers (bot protection, anti-scraping, WAF rules), which may cause `500` errors.
- Very heavy or slow pages can exceed navigation/runtime limits in serverless environments.
- Screenshot output is full-page at a fixed default height strategy; dynamic/infinite-scroll pages may render differently than a human browser session.
- In-memory rate limiting resets when instances restart and is not shared across all serverless instances.

## Roadmap

- Add optional auth/session support (cookies and headers) for private pages.
- Support extra capture options (height, full-page toggle, quality, dark mode emulation).
- Add wait controls (selector-based wait and custom delay) for dynamic apps.
- Introduce distributed rate limiting/storage (Upstash Redis) for consistent limits across instances.
- Improve anti-bot resilience with configurable user-agent and stealth strategies.
- Add usage analytics, error metrics, and alerting for production monitoring.

## Usage Examples

### cURL (local)

```bash
curl -X POST "http://localhost:3000/api/screenshot" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","format":"png"}' \
  --output screenshot.png
```

### PowerShell

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/screenshot" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"url":"https://example.com","format":"jpeg"}' `
  -OutFile "screenshot.jpg"
```

### RapidAPI-style request

```bash
curl -X POST "https://urlshot.dev/api/screenshot" \
  -H "Content-Type: application/json" \
  -H "X-RapidAPI-Key: <your-key>" \
  -H "X-RapidAPI-Host: urlshot.dev" \
  -d '{"url":"https://example.com","width":1366,"format":"png"}' \
  --output screenshot.png
```

## Local Development

```bash
npm install
npm run dev
```

Then test:

```bash
curl "http://localhost:3000/api/test"
```

## Deploy

```bash
npm run build
npx vercel --prod
```
