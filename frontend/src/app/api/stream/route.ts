import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const MOCK_EVENTS = [
  { fixtureId: 18172379, homeTeam: "USA", awayTeam: "Mexico", homeScore: 2, awayScore: 1, gamePhase: "LIVE" },
  { fixtureId: 18143853, homeTeam: "England", awayTeam: "Japan", homeScore: 1, awayScore: 1, gamePhase: "HT" },
  { fixtureId: 18143852, homeTeam: "France", awayTeam: "Argentina", homeScore: 3, awayScore: 2, gamePhase: "FT" },
];

let hasLoggedStreamFallback = false;

function createDemoEventStream(signal: AbortSignal) {
  let idx = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const send = () => {
        const event = {
          ...MOCK_EVENTS[idx % MOCK_EVENTS.length],
          ts: Date.now(),
          source: "demo-fallback",
        };
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller already closed — stop sending
          if (timer) clearInterval(timer);
          return;
        }
        idx += 1;
      };

      send();
      timer = setInterval(send, 2500);

      signal.addEventListener("abort", () => {
        if (timer) { clearInterval(timer); timer = null; }
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      if (timer) { clearInterval(timer); timer = null; }
    },
  });
}

export async function GET(request: NextRequest) {
  const jwt = process.env.TXLINE_JWT;
  const apiToken = process.env.TXLINE_API_TOKEN;

  if (!jwt || !apiToken) {
    return new Response(createDemoEventStream(request.signal), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const STREAM_URL = "https://txline-dev.txodds.com/api/scores/stream";

  let fallbackTimer: ReturnType<typeof setInterval> | null = null;

  const responseStream = new ReadableStream({
    async start(controller) {
      const headers = {
        Authorization: `Bearer ${jwt}`,
        "X-Api-Token": apiToken,
        Accept: "text/event-stream",
      };

      const safeEnqueue = (chunk: Uint8Array) => {
        try {
          controller.enqueue(chunk);
        } catch {
          // Controller closed — clean up timer if any
          if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
        }
      };

      try {
        const streamController = new AbortController();
        const streamTimeout = setTimeout(() => streamController.abort(), 1500);
        request.signal.addEventListener("abort", () => streamController.abort(), { once: true });

        const response = await fetch(STREAM_URL, {
          headers,
          signal: streamController.signal,
        });
        clearTimeout(streamTimeout);

        if (!response.ok || !response.body) {
          throw new Error(`TxLINE Stream HTTP Error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          if (request.signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;
          safeEnqueue(new TextEncoder().encode(decoder.decode(value)));
        }

        try { controller.close(); } catch { /* already closed */ }
      } catch (err: any) {
        if (!hasLoggedStreamFallback) {
          console.info("TxLINE stream unavailable; using demo SSE stream.", err instanceof Error ? err.message : err);
          hasLoggedStreamFallback = true;
        }
        let idx = 0;
        const encoder = new TextEncoder();

        const sendFallback = () => {
          if (request.signal.aborted) {
            if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
            try { controller.close(); } catch { /* already closed */ }
            return;
          }
          const event = {
            ...MOCK_EVENTS[idx % MOCK_EVENTS.length],
            ts: Date.now(),
            source: "demo-fallback",
          };
          safeEnqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          idx += 1;
        };

        sendFallback();
        fallbackTimer = setInterval(sendFallback, 2500);
      }
    },
    cancel() {
      if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
