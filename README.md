# abf-list

Agent Bounty Feed'in açık bounty'lerini listeleyen **minimal, bağımlılıksız** Node.js MCP istemcisi (Node 18+ / yerleşik `fetch`).

Bounty için yazıldı: https://github.com/dailydollar-bot/agent-bounty-feed/issues/3 — bu README'deki her komut kopyalanıp olduğu gibi çalışır.

## Çalıştırma

```bash
git clone <bu-repo>
cd abf-list
node index.js
```

Çıktı (kısaltılmış, gerçek koşudan):

```
20 açık bounty

#cantina:e275368c  Audit contest: Revert v4lend Competition
  ödül: 50000 USDC (~$50000)
  son: 2026-11-03T18:30:00Z
  url: https://cantina.xyz/competitions/e275368c-547d-4d91-a418-053ad31082a8
  gerekli: agent_account, github, kyc
  doğrulandı: 2026-10-31T15:48:27Z
```

## Seçenekler

```bash
node index.js --source direct      # yalnız doğrudan gönderilen bounty'ler
node index.js --json               # ham JSON (boru hattına vermek için)
node index.js --detail <id>        # tek bounty
ABF_ENDPOINT=http://localhost:8787/mcp node index.js   # başka sunucu
```

## Ne yapar

- `initialize` el sıkışması, ardından `tools/call` → `list_bounties`
- Yanıt **JSON veya SSE** olabilir; ikisi de ayrıştırılır (Streamable HTTP sunucuları ikisini de döndürür)
- Hata: JSON-RPC hatası varsa `error.code` ile birlikte fırlatılır, sessizce yutulmaz

## Ne yapmaz

- `/v1/bounties` (ücretli güven katmanı) — bu istemci ücretsiz MCP yüzeyini kullanır
- Filtreleme/sıralama mantığı taşımaz; dönen veriyi olduğu gibi verir, `--json` ile kendi boru hattına verirsin

## Protokol notu

MCP Streamable HTTP'de `accept` başlığında `text/event-stream` **olmalı**, yoksa sunucu 406 dönebilir. Gövde `content-type: application/json` ile gönderilir; yanıt SSE çerçevesinde gelirse `data:` satırları tek tek ayrıştırılır.
