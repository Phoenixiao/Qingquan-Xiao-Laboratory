/**
 * Qingquan Xiao Lab - Global Website Analytics API
 * Worker: qxl-lab-global-analytics
 * Backend: Tencent CloudBase PostgreSQL REST API
 *
 * Required Worker secrets/variables (Production):
 *   CLOUDBASE_ENV_ID  (Text): actual CloudBase environment ID
 *   CLOUDBASE_API_KEY (Secret): CloudBase API Key
 */

const SITE_ID = "qingquan-xiao-lab";
const WEBSITE_URL = "https://phoenixiao.github.io/Qingquan-Xiao-Laboratory/";
const ALLOWED_ORIGINS = ["https://phoenixiao.github.io"];

function getApiBase(env) {
  return `https://${env.CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest`;
}

function jsonResponse(data, status = 200, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return new Response(JSON.stringify(data), { status, headers });
}

async function cloudbaseRequest(env, path, options = {}) {
  if (!env.CLOUDBASE_ENV_ID || !env.CLOUDBASE_API_KEY) {
    throw new Error("CloudBase environment variables are missing");
  }

  const response = await fetch(`${getApiBase(env)}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.CLOUDBASE_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error("CloudBase API error:", response.status, responseText);
    throw new Error(`CloudBase API returned HTTP ${response.status}`);
  }
  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error("Invalid JSON response from CloudBase");
  }
}

async function getVisitCount(env) {
  const path = `/site_analytics?select=total_visits&site_id=eq.${encodeURIComponent(SITE_ID)}`;
  const result = await cloudbaseRequest(env, path, { method: "GET" });

  if (!Array.isArray(result) || result.length === 0) {
    throw new Error("Analytics database record not found");
  }
  const total = Number(result[0].total_visits);
  if (!Number.isFinite(total)) throw new Error("Invalid total_visits value");
  return total;
}

async function recordVisit(env) {
  await cloudbaseRequest(env, "/rpc/record_site_visit", {
    method: "POST",
    body: JSON.stringify({ p_site_id: SITE_ID })
  });
  return getVisitCount(env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    const origin = request.headers.get("Origin") || "";

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
          Vary: "Origin"
        }
      });
    }

    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse({ success: false, message: "Origin not allowed" }, 403, origin);
    }

    try {
      if (pathname === "/" && method === "GET") {
        return Response.redirect(WEBSITE_URL, 302);
      }

      if (pathname === "/health" && method === "GET") {
        const totalVisits = await getVisitCount(env);
        return jsonResponse({
          success: true,
          service: "Qingquan Xiao Lab Global Analytics",
          status: "online",
          database: "connected",
          site_id: SITE_ID,
          total_visits: totalVisits
        }, 200, origin);
      }

      if (pathname === "/api/count" && method === "GET") {
        const totalVisits = await getVisitCount(env);
        return jsonResponse({
          success: true,
          site_id: SITE_ID,
          total_visits: totalVisits
        }, 200, origin);
      }

      if (pathname === "/api/visit" && method === "POST") {
        const contentType = request.headers.get("Content-Type") || "";
        if (!contentType.toLowerCase().includes("application/json")) {
          return jsonResponse({ success: false, message: "Content-Type must be application/json" }, 415, origin);
        }

        try {
          await request.json();
        } catch {
          return jsonResponse({ success: false, message: "Invalid JSON request body" }, 400, origin);
        }

        const totalVisits = await recordVisit(env);
        return jsonResponse({
          success: true,
          message: "Visit recorded successfully",
          site_id: SITE_ID,
          total_visits: totalVisits
        }, 200, origin);
      }

      return jsonResponse({ success: false, message: "API endpoint not found", path: pathname }, 404, origin);
    } catch (error) {
      console.error("QXL Analytics Worker Error:", error);
      return jsonResponse({ success: false, message: "Analytics service error" }, 500, origin);
    }
  }
};
