export default async function handler(req, res) {
  const targetHost = 'mathjoy.eu.org';         // ← your main site
  const aliasHost = req.headers.host;    // alias.com
  const targetUrl = `https://${targetHost}${req.url}`;

  // Copy request headers, override Host
  const headers = { ...req.headers, host: targetHost, origin: `https://${targetHost}` };

  // Forward the request
  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: ['GET','HEAD'].includes(req.method) ? undefined : req.body,
    redirect: 'manual'
  });

  // Copy response headers
  response.headers.forEach((value, key) => {
    if (!['content-length','connection'].includes(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  // Cache static resources
  const contentType = response.headers.get('content-type') || '';
  if (/(image|javascript|css|font|svg)/i.test(contentType)) {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
  } else {
    res.setHeader('Cache-Control', 'no-cache'); // HTML no-cache
  }

  // Rewrite HTML links from main.com → alias.com
  if (contentType.includes('text/html')) {
    let html = await response.text();
    html = html.replaceAll(targetHost, aliasHost);
    res.status(response.status).send(html);
  } else {
    res.status(response.status);
    const reader = response.body.getReader();
    const writer = res;
    const stream = new ReadableStream({
      async start(controller) {
        while(true){
          const { done, value } = await reader.read();
          if(done) break;
          controller.enqueue(value);
        }
        controller.close();
      }
    });
    return new Response(stream).body.pipeTo(writer);
  }
}
