const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
const FIREBASE_URL =
  "https://priofy-6b9b4-default-rtdb.firebaseio.com/sports_events.json" +
  "?auth=iKRIASgG5Wqc16qhFeP2UslbW1u9Mb4mkuAdrnB0";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
  Accept: "application/json",
};

const OUTPUT_FILE = path.join(__dirname, "..", "events.json");

// ── Helpers ───────────────────────────────────────────────────────────────────
function b64(str) {
  if (!str) return "";
  try {
    return Buffer.from(str, "base64").toString("utf8");
  } catch {
    return str;
  }
}

function decodeEvent(id, raw) {
  // Decode streams array if present
  const streams = Array.isArray(raw.s)
    ? raw.s.map((s) => ({
        name: b64(s.n),
        url: b64(s.u),
        referer: b64(s.ref),
        userAgent: b64(s.ua),
        drm: s.drm || "",
      }))
    : [];

  return {
    id,
    date: raw.d || "",
    time: raw.t || "",
    league: b64(raw.l),
    team1: b64(raw.t1),
    team2: b64(raw.t2),
    logo1: b64(raw.lg1),
    logo2: b64(raw.lg2),
    leagueLogo: b64(raw.llg),
    isHot: raw.is_hot || false,
    visibility: raw.visibility || "",
    streams,
  };
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
function fetchData() {
  return new Promise((resolve, reject) => {
    const url = new URL(FIREBASE_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      headers: HEADERS,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("JSON parse failed: " + e.message));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("Request timeout"));
    });
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[${new Date().toISOString()}] Fetching from Firebase...`);

  const raw = await fetchData();

  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid response from Firebase");
  }

  // Decode all events
  const events = Object.entries(raw).map(([id, event]) =>
    decodeEvent(id, event)
  );

  // Sort by date then time
  events.sort((a, b) => {
    const da = new Date(`${a.date} ${a.time}`);
    const db = new Date(`${b.date} ${b.time}`);
    return da - db;
  });

  const output = {
    lastUpdated: new Date().toISOString(),
    totalEvents: events.length,
    events,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(
    `[${new Date().toISOString()}] ✅ Saved ${events.length} events to events.json`
  );
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
