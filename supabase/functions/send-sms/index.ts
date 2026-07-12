// Scaffold: SMS sender edge function.
// Swap the provider block (TODO) when credentials are chosen (local aggregator / Twilio).
// Kept as an Edge Function so it can be called from DB webhooks or external triggers
// without changing the app code.

import "https://deno.land/x/xhr@0.1.0/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = { to: string; message: string; ref?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { to, message, ref }: Payload = await req.json();
    if (!to || !message) return json({ error: "to & message required" }, 400);

    // TODO: replace with real provider.
    // Example Twilio-style:
    // const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    // const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    // const from = Deno.env.get("TWILIO_FROM");
    // await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, ...)
    console.log(`[send-sms:mock] to=${to} ref=${ref ?? "-"} msg=${message.slice(0, 60)}...`);
    return json({ sent: false, mocked: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
