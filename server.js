import crypto from "node:crypto";
import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const network = process.env.NETWORK || "stellar:testnet";
const payTo = process.env.TESTNET_SERVER_STELLAR_ADDRESS || "";
const facilitatorUrl =
  process.env.TESTNET_FACILITATOR_URL ||
  "https://channels.openzeppelin.com/x402/testnet";
const facilitatorApiKey = process.env.TESTNET_FACILITATOR_API_KEY || "";
const paymentAssetMode = (process.env.PAYMENT_ASSET_MODE || "usdc").toLowerCase();
const paymentPriceUsd = process.env.PAYMENT_PRICE_USD || "$0.01";
const xlmAssetContract =
  process.env.TESTNET_XLM_ASSET_CONTRACT_ID ||
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const paymentAmountBaseUnits = process.env.PAYMENT_AMOUNT_BASE_UNITS || "10000000";
const paymentPriceDisplay = process.env.PAYMENT_PRICE_DISPLAY || "1";
const paywallDisabled = String(process.env.PAYWALL_DISABLED || "false") === "true";
const startupErrors = [];

if (!payTo) {
  startupErrors.push("Missing TESTNET_SERVER_STELLAR_ADDRESS");
}

if (!facilitatorApiKey) {
  startupErrors.push("Missing TESTNET_FACILITATOR_API_KEY");
}

app.disable("x-powered-by");

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "PAYMENT-SIGNATURE",
    "payment-signature",
  ],
  exposedHeaders: [
    "PAYMENT-REQUIRED",
    "PAYMENT-RESPONSE",
    "payment-required",
    "payment-response",
    "x-mushee-receipt",
  ],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "512kb" }));

const facilitatorClient = new HTTPFacilitatorClient({
  url: facilitatorUrl,
  createAuthHeaders: async () => {
    const headers = { Authorization: `Bearer ${facilitatorApiKey}` };
    return {
      verify: headers,
      settle: headers,
      supported: headers,
    };
  },
});

const accepts =
  paymentAssetMode === "xlm"
    ? {
        scheme: "exact",
        price: {
          asset: xlmAssetContract,
          amount: paymentAmountBaseUnits,
        },
        network,
        payTo,
      }
    : {
        scheme: "exact",
        price: paymentPriceUsd,
        network,
        payTo,
      };

if (!paywallDisabled && startupErrors.length === 0) {
  app.use(
    paymentMiddlewareFromConfig(
      {
        "POST /api/summarize": {
          accepts,
          description: "Summarize arbitrary text behind an x402 paywall on Stellar testnet.",
          mimeType: "application/json",
        },
      },
      facilitatorClient,
      [{ network, server: new ExactStellarScheme() }],
    ),
  );
}

app.get("/", (_req, res) => {
  res.json({
    ok: startupErrors.length === 0,
    app: "Mushee Gate backend",
    network,
    paymentAssetMode,
    routes: ["GET /", "GET /health", "GET /api/config", "POST /api/summarize"],
    startupErrors,
  });
});

app.get("/health", (_req, res) => {
  res.status(startupErrors.length === 0 ? 200 : 500).json({
    ok: startupErrors.length === 0,
    network,
    paymentAssetMode,
    paywallDisabled,
    startupErrors,
  });
});

app.get("/api/config", (_req, res) => {
  res.json({
    app: "Mushee Gate",
    network,
    route: "/api/summarize",
    paywallDisabled,
    startupErrors,
    payment: {
      mode: paymentAssetMode,
      display:
        paymentAssetMode === "xlm"
          ? `${paymentPriceDisplay} XLM`
          : paymentPriceUsd,
      payTo,
      facilitatorUrl,
      hasFacilitatorApiKey: Boolean(facilitatorApiKey),
      xlmAssetContract: paymentAssetMode === "xlm" ? xlmAssetContract : null,
      amountBaseUnits: paymentAssetMode === "xlm" ? paymentAmountBaseUnits : null,
    },
  });
});

app.post("/api/summarize", (req, res) => {
  if (startupErrors.length > 0) {
    return res.status(500).json({
      error: "Server configuration is incomplete.",
      startupErrors,
    });
  }

  const text = String(req.body?.text || "").trim();
  if (!text) {
    return res.status(400).json({ error: "Text is required." });
  }

  const summary = summarizeText(text);
  const receipt = {
    requestHash: sha256(JSON.stringify({ text })),
    responseHash: sha256(summary),
    generatedAt: new Date().toISOString(),
    network,
    payTo,
    paymentAssetMode,
    price:
      paymentAssetMode === "xlm"
        ? `${paymentPriceDisplay} XLM`
        : paymentPriceUsd,
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

if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
    console.log(`Protected route: POST http://localhost:${port}/api/summarize`);
    console.log(`Network: ${network}`);
    console.log(`Payment mode: ${paymentAssetMode}`);
    if (startupErrors.length > 0) {
      console.warn(`Startup errors: ${startupErrors.join(", ")}`);
    }
  });
}

export default app;

function summarizeText(text) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return text.slice(0, 220);
  }

  const first = sentences[0] || "";
  const second = sentences[1] || "";
  const longest = [...sentences].sort((a, b) => b.length - a.length)[0] || "";

  return [...new Set([first, second, longest].filter(Boolean))].join(" ").trim();
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
