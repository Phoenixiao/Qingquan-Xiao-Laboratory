/**
 * Qingquan Xiao Lab - Global Analytics Worker
 *
 * Worker: qxl-lab-global-analytics
 * Version: 1.0.0
 *
 * Backend: CloudBase PostgreSQL
 * Table: site_analytics
 * RPC: record_site_visit
 */

const SITE_ID = "qingquan-xiao-lab";

const WEBSITE_URL =
  "https://phoenixiao.github.io/Qingquan-Xiao-Laboratory/";

const ALLOWED_ORIGINS = [
  "https://phoenixiao.github.io"
];

const API_BASE = (env) =>
  `https://${env.CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest`;


// ================================
// Response helper
// ================================

function jsonResponse(data, status = 200, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };

  if (ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}


// ================================
// CloudBase request helper
// ================================

async function cloudbaseRequest(env, path, options = {}) {
  if (!env.CLOUDBASE_ENV_ID || !env.CLOUDBASE_API_KEY) {
    throw new Error("CloudBase environment variables are missing");
  }

  const response = await fetch(`${API_BASE(env)}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${env.CLOUDBASE_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(options.headers || {})
    }
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `CloudBase API error (${response.status}): ${responseText}`
    );
  }

  if (!responseText) {
    return null;
  }

  return JSON.parse(responseText);
}


// ================================
// Get current visitor count
// ================================

async function getVisitCount(env) {
  const result = await cloudbaseRequest(
    env,
    `/site_analytics?select=total_visits&site_id=eq.${SITE_ID}`,
    {
      method: "GET"
    }
  );

  if (!Array.isArray(result) || result.length === 0) {
    throw new Error("Analytics record not found");
  }

  return Number(result[0].total_visits || 0);
}


// ================================
// Record a new visit
// ================================

async function recordVisit(env) {
  const result = await cloudbaseRequest(
    env,
    "/rpc/record_site_visit",
    {
      method: "POST",
      body: JSON.stringify({
        p_site_id: SITE_ID
      })
    }
  );

  // Support numeric, string, array and object return values.
  let totalVisits = result;

  if (Array.isArray(result)) {
    totalVisits = result[0];
  }

  if (totalVisits && typeof totalVisits === "object") {
    totalVisits =
      totalVisits.total_visits ??
      totalVisits.total ??
      totalVisits.count;
  }

  totalVisits = Number(totalVisits);

  if (!Number.isFinite(totalVisits)) {
    throw new Error("Invalid visit count returned by PostgreSQL");
  }

  return totalVisits;
}


// ================================
// Main Worker
// ================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    const origin = request.headers.get("Origin") || "";

    // CORS preflight
    if (method === "OPTIONS") {
      if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin || ALLOWED_ORIGINS[0],
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    // Redirect homepage
    if (pathname === "/" && method === "GET") {
      return Response.redirect(WEBSITE_URL, 302);
    }

    // Reject other website origins
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse(
        { success: false, message: "Origin not allowed" },
        403,
        ""
      );
    }

    try {

      // ----------------------------
      // GET /health
      // ----------------------------

      if (pathname === "/health" && method === "GET") {
        const totalVisits = await getVisitCount(env);

        return jsonResponse({
          success: true,
          service: "Qingquan Xiao Lab Analytics - Cloudflare",
          status: "online",
          database: "connected",
          total_visits: totalVisits
        }, 200, origin);
      }


      // ----------------------------
      // GET /api/count
      // ----------------------------

      if (pathname === "/api/count" && method === "GET") {
        const totalVisits = await getVisitCount(env);

        return jsonResponse({
          success: true,
          site_id: SITE_ID,
          total_visits: totalVisits
        }, 200, origin);
      }


      // ----------------------------
      // POST /api/visit
      // ----------------------------

      if (pathname === "/api/visit" && method === "POST") {

        const contentType =
          request.headers.get("Content-Type") || "";

        if (!contentType.includes("application/json")) {
          return jsonResponse({
            success: false,
            message: "Content-Type must be application/json"
          }, 415, origin);
        }

        // Read request body.
        await request.json();

        // Record exactly one visit through PostgreSQL RPC.
        const totalVisits = await recordVisit(env);

        return jsonResponse({
          success: true,
          message: "Visit recorded successfully",
          site_id: SITE_ID,
          total_visits: totalVisits
        }, 200, origin);
      }


      // ----------------------------
      // 404
      // ----------------------------

      return jsonResponse({
        success: false,
        message: "API endpoint not found",
        path: pathname
      }, 404, origin);

    } catch (error) {

      // Server-side error logging.
      console.error("Analytics Worker Error:", error);

      return jsonResponse({
        success: false,
        message: "Analytics service error",
        error: error.message
      }, 500, origin);
    }
  }
};
