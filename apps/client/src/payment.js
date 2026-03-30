import { Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { getNetworkPassphrase } from "@x402/stellar";
import { createFreighterSigner } from "./freighterSigner";

export async function runPaidSummarize({ serverUrl, walletAddress, text, rpcUrl }) {
  const signer = createFreighterSigner(walletAddress);
  const client = new x402Client().register(
    "stellar:*",
    new ExactStellarScheme(signer, { url: rpcUrl }),
  );
  const httpClient = new x402HTTPClient(client);

  const url = new URL("/api/summarize", serverUrl).toString();
  const body = JSON.stringify({ text });

  const firstTry = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

  if (firstTry.status !== 402) {
    return {
      initialStatus: firstTry.status,
      paidStatus: firstTry.status,
      settlement: null,
      data: await firstTry.json(),
      paymentRequired: null,
    };
  }

  const paymentRequired = httpClient.getPaymentRequiredResponse((name) => firstTry.headers.get(name));
  let paymentPayload = await client.createPaymentPayload(paymentRequired);
  paymentPayload = tightenSorobanFee(paymentPayload, paymentRequired.network);
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

  const paidResponse = await fetch(url, {
    method: "POST",
    headers: {
      ...paymentHeaders,
      "content-type": "application/json",
    },
    body,
  });

  const data = await paidResponse.json();
  const settlement = httpClient.getPaymentSettleResponse((name) => paidResponse.headers.get(name));

  return {
    initialStatus: firstTry.status,
    paidStatus: paidResponse.status,
    settlement,
    paymentRequired,
    data,
  };
}

function tightenSorobanFee(paymentPayload, network) {
  const networkPassphrase = getNetworkPassphrase(network);
  const tx = new Transaction(paymentPayload.payload.transaction, networkPassphrase);
  const sorobanData = tx.toEnvelope().v1()?.tx()?.ext()?.sorobanData();

  if (!sorobanData) {
    return paymentPayload;
  }

  return {
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
