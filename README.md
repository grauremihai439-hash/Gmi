# AI Chatbot・Ask AI Anything

An independent Windows AI assistant powered by the OpenAI API. The repository contains:

- an Electron + React desktop client;
- a TypeScript API that keeps the OpenAI key on the server;
- local conversation storage for development;
- a free tier with five questions per day;
- a seven-day monthly trial plus monthly/annual plan metadata;
- Microsoft Store listing, certification, and subscription configuration.

## Current MVP

- streaming chat responses;
- conversation history, rename-by-first-message, and deletion;
- guest identity with a signed local session;
- free, trial, and subscription status with daily/monthly message limits;
- Fast mode for free users and Fast/Advanced modes for subscribers;
- subscriber image/document attachments up to 5 MB;
- image analysis and AI image editing, plus document analysis and rewriting;
- a development fallback that works without an OpenAI key;
- Windows packaging configuration for APPX/MSIX preparation.
- Microsoft Store upgrade buttons linked to the monthly and annual add-ons.
- server-verified Microsoft Store subscription entitlements via the collections API.
- a Windows GitHub Actions build that produces the x64 APPX artifact.
- a production Docker image that keeps OpenAI and Microsoft credentials on the server.

The application does not copy the proprietary ChatGPT product or imply that it is an official OpenAI application. Before release, review the final name, branding, and store metadata against current OpenAI and Microsoft rules.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `JWT_SECRET` and optionally `OPENAI_API_KEY`.
3. Install packages with `npm install`.
4. Start the API and desktop app with `npm run dev`.

Without `OPENAI_API_KEY`, the server returns a clearly labeled demo response so the complete interface can still be tested.

## Build

```bash
npm run typecheck
npm run build
```

Windows Store packaging must run on Windows. Set `VITE_API_BASE_URL` to the public HTTPS API URL, then use:

```powershell
npm run package:windows
```

The repository also includes `.github/workflows/build-windows-store.yml`. Set the GitHub Actions repository variable `API_BASE_URL` before running it. The workflow intentionally fails rather than package a client pointed at localhost.

## Deploy the API

The root `Dockerfile` builds the API as a non-root production container. Configure a persistent volume at `/data` and set at least:

- `APP_ORIGIN=null` for the packaged Electron client;
- `JWT_SECRET` to a random value of 32 characters or more;
- `OPENAI_API_KEY` in the hosting provider's secret manager;
- `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, and `MICROSOFT_CLIENT_SECRET` for Store entitlement verification;
- the approved OpenAI model names and usage limits.

Production startup fails if `OPENAI_API_KEY` or a strong `JWT_SECRET` is missing. Never put the OpenAI or Microsoft client secrets in Electron, GitHub source, or the APPX package.

## Production checklist

- replace guest sessions with Microsoft Entra External ID or another verified identity provider;
- replace the local JSON store with managed PostgreSQL;
- deploy the API behind HTTPS and a managed secret store;
- verify the Store entitlement bridge using a licensed flight/test account;
- add abuse detection, reporting workflow, support tooling, backups, and observability;
- obtain final privacy/terms review and personally accept the IARC declaration;
- deploy the HTTPS API, build on Windows, upload the APPX, and run Store certification tests.
