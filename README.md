# Mushee Gate Backend

Express + x402 backend for Stellar Testnet.

## What it does

- exposes `POST /api/summarize`
- protects it with x402 payment middleware
- returns a summary only after a valid payment settlement
- exposes config and health routes for the frontend

## Deploy to Vercel

- Create a new Vercel project from this folder
- Framework preset: **Other**
- Install command: `npm install`
- Build command: leave empty
- Output directory: leave empty
- Root directory: this backend folder

## Required environment variables

Use `.env.example` as the template.

### Recommended mode

For the hosted testnet facilitator, start with:

- `PAYMENT_ASSET_MODE=usdc`
- `PAYMENT_PRICE_USD=$0.01`

This matches the officially documented quickstart path on Stellar and is the most reliable option for the hosted facilitator. The Stellar quickstart uses testnet USDC for its working example, and the hosted Built on Stellar facilitator is available on testnet. citeturn792724view0turn827598search2

### Optional native XLM mode

The code also supports:

- `PAYMENT_ASSET_MODE=xlm`
- `TESTNET_XLM_ASSET_CONTRACT_ID`
- `PAYMENT_AMOUNT_BASE_UNITS`
- `PAYMENT_PRICE_DISPLAY`

Stellar docs note that all Stellar assets, including native XLM, can be handled through Stellar Asset Contracts. citeturn155214search4turn155214search2

## Routes

- `GET /`
- `GET /health`
- `GET /api/config`
- `POST /api/summarize`

## Notes

- `CORS_ORIGINS` must include your frontend URL
- the backend exposes `PAYMENT-REQUIRED` and `PAYMENT-RESPONSE` headers so the browser can read the x402 challenge and settlement response
- Freighter browser extension is supported for x402 on Stellar; Freighter mobile is not currently supported. citeturn827598search2
