import httpx
from urllib.parse import urljoin
from fastapi import FastAPI, Request, Response

app = FastAPI()

TARGET_HOST = "mathjoy.eu.org"  # your Cloudflare-hosted domain

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"])
async def proxy(request: Request, path: str):
    # Build target URL
    target_url = urljoin(f"https://{TARGET_HOST}/", path)
    query = request.url.query
    if query:
        target_url += "?" + query

    # Prepare headers (set Host header to target)
    headers = dict(request.headers)
    headers["Host"] = TARGET_HOST

    # Send request to Cloudflare-protected site
    async with httpx.AsyncClient(follow_redirects=True) as client:
        resp = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=await request.body()
        )

    # If HTML, replace domain references
    content_type = resp.headers.get("content-type", "")
    body = resp.content
    if "text/html" in content_type:
        body = body.replace(TARGET_HOST.encode(), request.url.hostname.encode())

    # Return proxied response
    return Response(
        content=body,
        status_code=resp.status_code,
        headers={k: v for k, v in resp.headers.items() if k.lower() not in ["content-encoding", "transfer-encoding"]}
    )
