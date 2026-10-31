#!/usr/bin/env node
/**
 * abf-list — Agent Bounty Feed için minimal, bağımlılıksız MCP istemcisi.
 *
 * Feed: https://agent-bounty-feed.dailydollar.workers.dev/mcp (Streamable HTTP, auth yok)
 *
 * Kullanım:
 *   node index.js                 # açık bounty'leri listele
 *   node index.js --source direct # yalnız doğrudan gönderilenler
 *   node index.js --json          # ham JSON
 *   node index.js --detail <id>   # tek bounty
 */

const ENDPOINT = process.env.ABF_ENDPOINT ?? "https://agent-bounty-feed.dailydollar.workers.dev/mcp";

let seq = 0;
const nextId = () => ++seq;

/** Streamable HTTP MCP çağrısı. Yanıt JSON ya da SSE olabilir; ikisi de okunur. */
async function rpc(method, params = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId(), method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const ctype = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (ctype.includes("text/event-stream")) {
    // SSE: "data: {...}" satırlarını ayıkla, id eşleşen yanıtı döndür
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      let msg;
      try { msg = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (msg.error) throw new Error(`${msg.error.code}: ${msg.error.message}`);
      if (msg.result) return msg.result;
    }
    throw new Error("SSE yanıtında sonuç bulunamadı");
  }

  const msg = JSON.parse(text);
  if (msg.error) throw new Error(`${msg.error.code}: ${msg.error.message}`);
  return msg.result;
}

/** MCP el sıkışması — uyumlu sunucularda zorunlu adım. */
async function handshake() {
  try {
    await rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "abf-list", version: "1.0.0" },
    });
  } catch {
    // bazı sunucular initialize'ı atlar; doğrudan devam
  }
}

const fmt = (b) =>
  [
    `#${b.id ?? "?"}  ${b.title}`,
    `  ödül: ${b.reward ?? "?"} ${b.currency ?? ""}${b.est_usd ? ` (~$${b.est_usd})` : ""}`.trimEnd(),
    b.deadline ? `  son: ${b.deadline}` : null,
    b.url ? `  url: ${b.url}` : null,
    b.requires?.length ? `  gerekli: ${b.requires.join(", ")}` : null,
    b.slots_left !== undefined ? `  kalan kontenjan: ${b.slots_left}` : null,
    b.verified?.checked_at ? `  doğrulandı: ${b.verified.checked_at}` : null,
  ]
    .filter(Boolean)
    .join("\n");

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => {
    const i = argv.indexOf(n);
    return i > -1 ? argv[i + 1] : undefined;
  };

  await handshake();

  if (flag("--detail")) {
    const r = await rpc("tools/call", { name: "get_bounty", arguments: { id: flag("--detail") } });
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  const args = {};
  if (flag("--source")) args.source = flag("--source");

  const r = await rpc("tools/call", { name: "list_bounties", arguments: args });

  if (argv.includes("--json")) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  // content: [{type:"text", text:"<json>"}] biçiminde döner
  const raw = r?.content?.find((c) => c.type === "text")?.text ?? "";
  let parsed;
  try { parsed = JSON.parse(raw); } catch { console.log(raw || JSON.stringify(r, null, 2)); return; }

  const items = parsed.bounties ?? parsed.items ?? (Array.isArray(parsed) ? parsed : []);
  if (!items.length) { console.log("Açık bounty yok."); return; }

  console.log(`${items.length} açık bounty\n`);
  for (const b of items) console.log(fmt(b) + "\n");
}

main().catch((e) => { console.error("hata:", e.message); process.exit(1); });
