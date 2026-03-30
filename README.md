# Gated Testnet

A testnet-first x402 paywall for Stellar native XLM.

This repo gives you a working starting point for **Mushee Gate** on **Stellar testnet**:

- a protected `POST /api/summarize` route
- **x402** payment gating on `stellar:testnet`
- **native XLM** pricing using the native Stellar Asset Contract
- a browser client that uses **Freighter** for payment signing
- a Node smoke-test client for quick end-to-end verification

## What is in scope right now

This build is focused on getting the **testnet payment flow** working first.
Design polish, extra routes, richer receipts, and stronger policy layers can come next.

## Important defaults already wired in

- Seller / pay-to address: `GCELZCMTWIYXHKVDT7N42QN5WYJUQ5HBOUHRIW4TUSH7ZLTULCRSIHLH`
- Suggested buyer address: `GDRJBJ5LZARCRFZVBP2ROJGOOA2WBJKEZJIFDSQRYQCR4CENWYHWKI5J`
- Network: `stellar:testnet`
- Asset: **native XLM only**
- Protected endpoint: `POST /api/summarize`
- Price: **1 XLM** by default (`10000000` base units)
- Facilitator URL: `https://channels.openzeppelin.com/x402/testnet`
- RPC URL: `https://soroban-testnet.stellar.org`

## What you still need to provide locally

You did **not** share private keys in chat, which is the right call.
To actually run payments on testnet, you still need:

1. A **Built on Stellar testnet facilitator API key**
2. A **buyer wallet** with testnet XLM
3. Either:
   - Freighter connected to the buyer account, or
   - the buyer secret key placed in a local `.env` file for the smoke test

You do **not** need the seller secret key for this server build, because the server only needs a receive address.

## Setup

### 1. Install

```bash
npm install
```

### 2. Create server env

```bash
cp apps/server/.env.example apps/server/.env
```

Then fill in at least:

- `TESTNET_FACILITATOR_API_KEY`
- optionally change `PAYMENT_AMOUNT_BASE_UNITS`

### 3. Create root env for the smoke test (optional)

```bash
cp .env.example .env
```

Then fill in:

- `BUYER_SECRET`

### 4. Fund the buyer wallet with testnet XLM

Because this build uses **native XLM only**, the buyer just needs testnet XLM. No USDC trustline is needed.

### 5. Run both apps

```bash
npm run dev
```

- client: `http://localhost:5173`
- server: `http://localhost:3001`

## Smoke test without the browser

If you want a quick end-to-end verification from Node instead of Freighter, put the buyer secret in the root `.env` and run:

```bash
npm run smoke
```

This hits the protected summarize route, signs the payment payload, retries the request, and prints the settlement response.

## Browser flow

1. Open the client in a browser with **Freighter Browser Extension** installed
2. Connect the buyer account
3. Paste text into the form
4. Click **Pay 1 XLM and summarize**
5. Approve the x402 signing request in Freighter
6. View the summary, receipt, and settlement data


## Vercel deployment

Do **not** deploy this repo to Vercel as one root project yet. This repo is a monorepo with a separate Express server and Vite client, so the clean Vercel setup is:

- **Project 1 (backend):** set **Root Directory** to `apps/server`
- **Project 2 (frontend):** set **Root Directory** to `apps/client`

Then set `VITE_SERVER_URL` in the frontend project to your backend deployment URL. Vercel's current monorepo docs support setting a **Root Directory** per project, and Vercel's Express docs support deploying Express apps directly.

### Backend project settings

- Root Directory: `apps/server`
- Install Command: `npm install`
- Build Command: leave default
- Output Directory: leave blank

Backend environment variables:

```env
TESTNET_SERVER_STELLAR_ADDRESS=GCELZCMTWIYXHKVDT7N42QN5WYJUQ5HBOUHRIW4TUSH7ZLTULCRSIHLH
TESTNET_FACILITATOR_URL=https://channels.openzeppelin.com/x402/testnet
TESTNET_FACILITATOR_API_KEY=your_testnet_facilitator_key
TESTNET_XLM_ASSET_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
PAYMENT_AMOUNT_BASE_UNITS=10000000
PAYMENT_PRICE_DISPLAY=1
NETWORK=stellar:testnet
CORS_ORIGINS=https://your-frontend.vercel.app
```

### Frontend project settings

- Root Directory: `apps/client`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

Frontend environment variables:

```env
VITE_SERVER_URL=https://your-backend.vercel.app
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
```

### Why your current Vercel build failed

The immediate failure came from old package pins: the repo was asking for `@x402/fetch@^0.4.0`, but the current x402 packages are on the **v2** line. This repo has been updated to use `^2` for all `@x402/*` packages so npm can resolve the currently published v2 releases.

## Native XLM pricing

This build uses the explicit asset+amount x402 format so it can charge **native XLM** instead of the default USDC flow.

By default:

- `1 XLM = 10000000` base units
- `PAYMENT_AMOUNT_BASE_UNITS=10000000`

If you want `0.1 XLM`, use:

```env
PAYMENT_AMOUNT_BASE_UNITS=1000000
PAYMENT_PRICE_DISPLAY=0.1
```

## XLM asset contract ID

The server env template includes the **testnet native asset contract ID** used for XLM payments:

`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

If you want to verify it yourself with Stellar CLI:

```bash
stellar contract id asset --network testnet --asset native
```

## API routes

### `GET /api/config`
Returns the active testnet configuration.

### `POST /api/summarize`
Protected by x402.

Request body:

```json
{
  "text": "Long text to summarize"
}
```

Successful response:

```json
{
  "summary": "...",
  "receipt": {
    "requestHash": "...",
    "responseHash": "...",
    "generatedAt": "...",
    "network": "stellar:testnet",
    "asset": "XLM",
    "price": "1"
  },
  "meta": {
    "inputCharacters": 1234,
    "inputWords": 220,
    "sentencesUsed": 3
  }
}
```

## What is intentionally simple right now

- The summarizer is local and deterministic, not model-backed yet
- The receipt is app-level metadata plus the x402 settlement header
- Refund logic and post-response policy checks are not wired yet
- This is tuned for **testnet first**, not production hardening

## Next build steps after testnet payments work

- add richer receipt verification UI
- add failure-policy and refund flow
- add more gated endpoints like `/search` and `/extract`
- add premium design and brand layer
- deploy the client and server publicly
