import crypto from "node:crypto";
import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const network = process.env.NETWORK || "stellar:testnet";
const payTo = process.env.TESTNET_SERVER_STELLAR_ADDRESS;
const facilitatorUrl = process.env.TESTNET_FACILITATOR_URL || "https://channels.openzeppelin.com/x402/testnet";
const facilitatorApiKey = process.env.TESTNET_FACILITATOR_API_KEY || "";
const xlmAssetContract = process.env.TESTNET_XLM_ASSET_CONTRACT_ID || "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const paymentAmountBaseUnits = process.env.PAYMENT_AMOUNT_BASE_UNITS || "10000000";
const paymentPriceDisplay = process.env.PAYMENT_PRICE_DISPLAY || "1";
const paywallDisabled = String(process.env.PAYWALL_DISABLED || "false") === "true";

if (!payTo) {
  throw new Error("Missing TESTNET_SERVER_STELLAR_ADDRESS in apps/server/.env");
}

app.disable("x-powered-by");
app.use(cors({ origin: (process.env.CORS_ORIGINS || "http://localhost:5173").split(",") }));
app.use(express.json({ limit: "256kb" }));

const facilitatorClient = new HTTPFacilitatorClient({
  url: facilitatorUrl,
  createAuthHeaders: facilitatorApiKey
    ? async () => {
        const headers = { Authorization: `Bearer ${facilitatorApiKey}` };
        return { verify: headers, settle: headers, supported: headers };
      }
    : undefined,
});

const accepts = [
  {
    scheme: "exact",
    price: {
      asset: xlmAssetContract,
      amount: paymentAmountBaseUnits,
    },
    network,
    payTo,
  },
];

if (!paywallDisabled) {
  app.use(
    paymentMiddleware(
      {
        "POST /api/summarize": {
          accepts,
          description: "Summarize arbitrary text using a native XLM-gated route on Stellar testnet.",
          mimeType: "application/json",
        },
      },
      new x402ResourceServer(facilitatorClient).register(network, new ExactStellarScheme()),
    ),
  );
}

app.get("/api/config", async (_req, res) => {
  res.json({
    app: "Gated Testnet",
    route: "/api/summarize",
    network,
    paywallDisabled,
    payment: {
      asset: "XLM",
      assetContract: xlmAssetContract,
      amountBaseUnits: paymentAmountBaseUnits,
      amountDisplay: paymentPriceDisplay,
      payTo,
      facilitatorUrl,
      hasFacilitatorApiKey: Boolean(facilitatorApiKey),
    },
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, network, paywallDisabled });
});

app.post("/api/summarize", (req, res) => {
  const text = String(req.body?.text || "").trim();

  if (!text) {
    return res.status(400).json({ error: "Text is required." });
  }

  const summary = summarizeText(text);
  const requestHash = sha256(JSON.stringify({ text }));
  const responseHash = sha256(summary);

  const receipt = {
    requestHash,
    responseHash,
    generatedAt: new Date().toISOString(),
    network,
    asset: "XLM",
    price: paymentPriceDisplay,
    payTo,
  };

  res.setHeader("x-mushee-receipt", JSON.stringify(receipt));

  return res.json({
    summary,
    receipt,
    meta: {
      inputCharacters: text.length,
      inputWords: countWords(text),
      sentencesUsed: Math.min(splitSentences(text).length, 3),
    },
  });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`Protected route: POST http://localhost:${port}/api/summarize`);
  console.log(`Network: ${network}`);
  console.log(`Pay to: ${payTo}`);
  console.log(`Price: ${paymentPriceDisplay} XLM (${paymentAmountBaseUnits} base units)`);
  console.log(`Paywall disabled: ${paywallDisabled}`);
});

function summarizeText(text) {
  const sentences = splitSentences(text).filter(Boolean);
  if (sentences.length === 0) {
    return text.slice(0, 220);
  }

  const first = sentences[0] || "";
  const second = sentences[1] || "";
  const longest = [...sentences].sort((a, b) => b.length - a.length)[0] || "";

  const picked = [first, second, longest].filter(Boolean);
  const unique = [...new Set(picked)];
  return unique.join(" ").trim();
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
