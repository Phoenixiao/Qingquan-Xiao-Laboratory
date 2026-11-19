const ALLOWED_ORIGINS = [
  "https://phoenixiao.github.io"
];

const SITE_ID = "qingquan-xiao-lab";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    // Check whether the request comes from an allowed website.
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Origin not allowed"
        }),
        {
          status: 403,
          headers: JSON_HEADERS
        }
      );
    }

    // CORS response headers.
    const corsHeaders = {};

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      corsHeaders["Access-Control-Allow-Origin"] = origin;
      corsHeaders["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
      corsHeaders["Access-Control-Allow-Headers"] = "Content-Type";
      corsHeaders["Access-Control-Max-Age"] = "86400";
      corsHeaders["Vary"] = "Origin";
    }

    // Unified JSON response.
    function jsonResponse(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          ...JSON_HEADERS,
          ...corsHeaders
        }
      });
    }

    // Handle browser CORS preflight requests.
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      // Check D1 database binding.
      if (!env.DB) {
        return jsonResponse({
          success: false,
          error: "Database binding DB is missing"
        }, 500);
      }

      // POST /api/visit
      // Record one website visit and atomically increment the counter.
      if (url.pathname === "/api/visit") {
        if (request.method !== "POST") {
          return jsonResponse({
            success: false,
            error: "Method Not Allowed"
          }, 405);
        }

        const result = await env.DB.prepare(`
          UPDATE site_stats
          SET total_visits = total_visits + 1
          WHERE site_id = ?
          RETURNING total_visits
        `)
          .bind(SITE_ID)
          .first();

        if (!result) {
          return jsonResponse({
            success: false,
            error: "Statistics record not found"
          }, 404);
        }

        return jsonResponse({
          success: true,
          total_visits: result.total_visits
        });
      }

      // GET /api/count
      // Read the current cumulative visit count without incrementing it.
      if (url.pathname === "/api/count") {
        if (request.method !== "GET") {
          return jsonResponse({
            success: false,
            error: "Method Not Allowed"
          }, 405);
        }

        const result = await env.DB.prepare(`
          SELECT total_visits
          FROM site_stats
          WHERE site_id = ?
        `)
          .bind(SITE_ID)
          .first();

        if (!result) {
          return jsonResponse({
            success: false,
            error: "Statistics record not found"
          }, 404);
        }

        return jsonResponse({
          success: true,
          total_visits: result.total_visits
        });
      }

      // Other paths.
      return jsonResponse({
        success: false,
        error: "Not Found"
      }, 404);

    } catch (error) {
      return jsonResponse({
        success: false,
        error: "Internal Server Error"
      }, 500);
    }
  }
};
