/**
 * Shared CORS module for Edge Functions
 *
 * Provides secure CORS headers with origin whitelist
 * instead of wildcard (*) which exposes APIs to any site.
 */

// Allowed origins - configure FRONTEND_URL in production
const ALLOWED_ORIGINS: string[] = [
  // Production URLs
  "https://liveroleplay.vercel.app",
  "https://admin.liveroleplay.com",
  Deno.env.get("FRONTEND_URL") || "",
  Deno.env.get("PLATFORM_ADMIN_URL") || "",
  // Development URLs
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://[::1]:5173",
  "http://[::1]:5174",
  "http://[::1]:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:3000",
].filter(Boolean); // Remove empty strings

/**
 * Get CORS headers for a request
 *
 * @param origin - The Origin header from the request
 * @returns CORS headers object
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // Check if origin is in whitelist
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin);

  // Use the request origin if allowed, otherwise use first allowed origin
  const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-access-code",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
  };
}

/**
 * Handle CORS preflight (OPTIONS) request
 *
 * @param req - The incoming request
 * @returns Response for OPTIONS request, or null if not OPTIONS
 */
export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    return new Response("ok", { headers: getCorsHeaders(origin) });
  }
  return null;
}

/**
 * Create a JSON response with CORS headers
 *
 * @param data - Response data
 * @param status - HTTP status code
 * @param req - Original request (to get origin)
 * @returns Response with CORS headers
 */
export function corsJsonResponse(
  data: unknown,
  status: number,
  req: Request
): Response {
  const origin = req.headers.get("origin");
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

/**
 * Create an error response with CORS headers
 *
 * @param error - Error message
 * @param status - HTTP status code (default: 500)
 * @param req - Original request (to get origin)
 * @returns Error response with CORS headers
 */
export function corsErrorResponse(
  error: string,
  status: number = 500,
  req: Request
): Response {
  return corsJsonResponse({ error }, status, req);
}
