import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import EventSource from "eventsource";

// Load environment variables from .env.local
const envPath = path.join(__dirname, "..", ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("No .env.local file found. Please run the activation script first.");
  process.exit(1);
}

dotenv.config({ path: envPath });

const jwt = process.env.TXLINE_JWT;
const apiToken = process.env.TXLINE_API_TOKEN;

if (!jwt || !apiToken) {
  console.error("Missing TXLINE_JWT or TXLINE_API_TOKEN in .env.local");
  process.exit(1);
}

const STREAM_URL = "https://txline-dev.txodds.com/api/scores/stream";

console.log("Connecting to TxLINE SSE Stream...");
console.log(`URL: ${STREAM_URL}`);
console.log(`Using JWT: ${jwt.substring(0, 15)}...`);
console.log(`Using API Token: ${apiToken.substring(0, 15)}...`);

const es = new EventSource(STREAM_URL, {
  headers: {
    Authorization: `Bearer ${jwt}`,
    "X-Api-Token": apiToken,
    Accept: "text/event-stream",
  },
});

es.onopen = () => {
  console.log("SSE Connection opened successfully!");
};

es.onmessage = (event) => {
  console.log("\n--- Received Event ---");
  try {
    const data = JSON.parse(event.data);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.log("Raw Data:", event.data);
  }
};

es.onerror = (err) => {
  console.error("SSE Error:", err);
};

// Auto-close after 20 seconds
setTimeout(() => {
  console.log("Closing SSE connection after 20s test run...");
  es.close();
  process.exit(0);
}, 20000);
