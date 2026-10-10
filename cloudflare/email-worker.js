async function sign(secret, timestamp, body) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${body}`),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export default {
  async fetch(_request, env) {
    if (!env.HEXAWAVE_API_URL || !env.HEXAWAVE_EMAIL_WEBHOOK_SECRET) {
      return Response.json(
        { status: "not_configured", message: "Set the Worker API URL and webhook secret." },
        { status: 503 },
      );
    }

    let response;
    try {
      response = await fetch(
        `${env.HEXAWAVE_API_URL.replace(/\/$/, "")}/api/email/cloudflare/status`,
      );
    } catch {
      return Response.json(
        { status: "backend_unreachable" },
        { status: 502 },
      );
    }

    if (!response.ok) {
      return Response.json(
        { status: "backend_unavailable", backendStatus: response.status },
        { status: 502 },
      );
    }

    const backend = await response.json();
    return Response.json({
      status: backend.inboundConfigured ? "ready" : "backend_secret_missing",
      backend,
    });
  },

  async email(message, env) {
    if (!env.HEXAWAVE_API_URL || !env.HEXAWAVE_EMAIL_WEBHOOK_SECRET) {
      throw new Error("HexaWave inbound email worker is not configured.");
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      type: "reply",
      email: message.from,
    });
    const signature = await sign(
      env.HEXAWAVE_EMAIL_WEBHOOK_SECRET,
      timestamp,
      body,
    );

    const response = await fetch(
      `${env.HEXAWAVE_API_URL.replace(/\/$/, "")}/api/email/cloudflare/inbound`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hw-timestamp": timestamp,
          "x-hw-signature": signature,
        },
        body,
      },
    );
    if (!response.ok) {
      throw new Error(
        `HexaWave inbound email webhook failed with HTTP ${response.status}.`,
      );
    }
  },
};
