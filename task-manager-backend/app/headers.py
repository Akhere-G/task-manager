from flask import Flask, Response, request

CSP_REPORT_ONLY = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "connect-src 'self' https://*.posthog.com; "
    "worker-src 'self'; "
    "manifest-src 'self'; "
    "frame-ancestors 'none'"
)

REVALIDATED_FILES = {
    "/index.html",
    "/sw.js",
    "/site.webmanifest",
    "/robots.txt",
    "/sitemap.xml",
}


def register_response_headers(app: Flask) -> None:
    @app.after_request
    def set_response_headers(response: Response) -> Response:
        path = request.path

        if path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        elif path.startswith("/assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif path in REVALIDATED_FILES or response.mimetype == "text/html":
            response.headers["Cache-Control"] = "no-cache"

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        response.headers["Content-Security-Policy-Report-Only"] = CSP_REPORT_ONLY
        if request.is_secure:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response
