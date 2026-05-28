// Deno Deploy XHS Proxy - deploy at: https://dash.deno.com
// Run: deno run --allow-net xhs-proxy-deno.js (local test)
// Deploy: deno deploy --entrypoint xhs-proxy-deno.js (after deno install)

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const target = url.searchParams.get('url');
  
  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const resp = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      redirect: 'follow'
    });
    
    const body = await resp.text();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
