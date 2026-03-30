import { useEffect, useMemo, useState } from "react";
import { connectFreighter } from "./freighterSigner";
import { runPaidSummarize } from "./payment";

const DEFAULT_TEXT = `Agents are one of the biggest stories in tech right now, but most agents still run into the same hard stop: payments. They can reason, plan, and act — right up until they need to pay for an API call, unlock a tool, access premium data, or complete a paid task. With x402 on Stellar, builders can turn ordinary HTTP requests into paid interactions using stablecoin micropayments and Soroban authorization, letting apps, services, and agents transact natively on the web.`;

export default function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [config, setConfig] = useState(null);
  const [text, setText] = useState(DEFAULT_TEXT);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState("");

  const serverUrl = useMemo(() => import.meta.env.VITE_SERVER_URL || "http://localhost:3001", []);
  const rpcUrl = useMemo(() => import.meta.env.VITE_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org", []);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    const response = await fetch(`${serverUrl}/api/config`);
    const data = await response.json();
    setConfig(data);
  }

  async function handleConnect() {
    setError("");
    try {
      const address = await connectFreighter();
      setWalletAddress(address);
      setStatus("Freighter connected.");
    } catch (err) {
      setError(err.message || "Failed to connect Freighter.");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!walletAddress) {
      setError("Connect Freighter first.");
      return;
    }

    if (!text.trim()) {
      setError("Paste some text to summarize.");
      return;
    }

    try {
      setStatus("Requesting paywall...");
      const response = await runPaidSummarize({
        serverUrl,
        walletAddress,
        text,
        rpcUrl,
      });
      setResult(response);
      setStatus(response.paidStatus === 200 ? "Payment settled and summary returned." : `Request finished with status ${response.paidStatus}.`);
    } catch (err) {
      setError(err.message || "Payment failed.");
      setStatus("Failed");
    }
  }

  return (
    <div className="page">
      <div className="card hero">
        <p className="eyebrow">Stellar testnet · native XLM · x402</p>
        <h1>Gated Testnet</h1>
        <p className="subcopy">
          A working testnet build for a paid <code>/summarize</code> endpoint on Stellar.
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={handleConnect}>
            {walletAddress ? "Freighter connected" : "Connect Freighter"}
          </button>
          <span className="pill">{config?.payment?.amountDisplay || "1"} XLM</span>
        </div>
        {walletAddress ? <p className="mono">Buyer: {walletAddress}</p> : null}
      </div>

      <div className="grid">
        <section className="card">
          <h2>Endpoint</h2>
          <div className="stack small-gap">
            <div className="kv"><span>Route</span><span>/api/summarize</span></div>
            <div className="kv"><span>Network</span><span>{config?.network || "stellar:testnet"}</span></div>
            <div className="kv"><span>Asset</span><span>{config?.payment?.asset || "XLM"}</span></div>
            <div className="kv"><span>Price</span><span>{config?.payment?.amountDisplay || "1"} XLM</span></div>
            <div className="kv"><span>Pay to</span><span className="mono slim">{config?.payment?.payTo || "..."}</span></div>
          </div>
        </section>

        <section className="card">
          <h2>Status</h2>
          <div className="stack small-gap">
            <div className="status-box">{status}</div>
            {error ? <div className="error-box">{error}</div> : null}
            {result?.paymentRequired ? (
              <div className="note-box">
                Paywall detected. Freighter should prompt you to sign an authorization entry.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="card">
        <h2>Summarize with payment</h2>
        <form className="stack" onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={10}
            placeholder="Paste text here"
          />
          <div className="form-row">
            <button className="primary" type="submit">
              Pay {config?.payment?.amountDisplay || "1"} XLM and summarize
            </button>
          </div>
        </form>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Summary</h2>
          <div className="result-box">{result?.data?.summary || "No summary yet."}</div>
        </div>

        <div className="card">
          <h2>Receipt</h2>
          <pre className="json-box">{JSON.stringify(result?.data?.receipt || result?.settlement || {}, null, 2)}</pre>
        </div>
      </section>
    </div>
  );
}
