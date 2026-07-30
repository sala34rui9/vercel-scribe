Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const { apiKey, payload } = await req.json();
  const upstream = await fetch("https://router.bynara.id/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  const body = await upstream.text();
  // Pass through the REAL upstream status so the client can distinguish 401/404/402
  return new Response(body, {
    status: upstream.status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
