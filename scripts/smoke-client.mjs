import dotenv from "dotenv";
import { Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { createEd25519Signer, getNetworkPassphrase } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

dotenv.config();

const BUYER_SECRET = process.env.BUYER_SECRET;
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";
const STELLAR_RPC_URL = process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK = "stellar:testnet";
const ENDPOINT_PATH = "/api/summarize";
const SAMPLE_TEXT = `Stellar testnet lets builders try payment flows without touching mainnet. x402 on Stellar turns an HTTP request into a payable interaction. This smoke test signs the required Soroban authorization entry, retries the request, and prints the settlement response.`;

if (!BUYER_SECRET) {
  throw new Error("Missing BUYER_SECRET in root .env");
}

async function main() {
  const url = new URL(ENDPOINT_PATH, SERVER_URL).toString();
  const signer = createEd25519Signer(BUYER_SECRET, NETWORK);
  const client = new x402Client().register(
    "stellar:*",
    new ExactStellarScheme(signer, { url: STELLAR_RPC_URL }),
  );
  const httpClient = new x402HTTPClient(client);

  console.log(`Target: ${url}`);
  console.log(`Client address: ${signer.address}`);

  const firstTry = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: SAMPLE_TEXT }),
  });

  console.log(`Initial status: ${firstTry.status}`);

  const paymentRequired = httpClient.getPaymentRequiredResponse((name) => firstTry.headers.get(name));
  let paymentPayload = await client.createPaymentPayload(paymentRequired);

  const networkPassphrase = getNetworkPassphrase(NETWORK);
  const tx = new Transaction(paymentPayload.payload.transaction, networkPassphrase);
  const sorobanData = tx.toEnvelope().v1()?.tx()?.ext()?.sorobanData();

  if (sorobanData) {
    paymentPayload = {
      ...paymentPayload,
      payload: {
        ...paymentPayload.payload,
        transaction: TransactionBuilder.cloneFrom(tx, {
          fee: "1",
          sorobanData,
          networkPassphrase,
        })
          .build()
          .toXDR(),
      },
    };
  }

  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
  const paidResponse = await fetch(url, {
    method: "POST",
    headers: {
      ...paymentHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({ text: SAMPLE_TEXT }),
  });

  const payload = await paidResponse.json();
  const settlement = httpClient.getPaymentSettleResponse((name) => paidResponse.headers.get(name));

  console.log("Settlement response:", settlement);
  console.log("Response payload:", payload);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
