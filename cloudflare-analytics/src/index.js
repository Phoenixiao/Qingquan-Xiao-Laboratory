const SITE_ID = "qingquan-xiao-lab";

const ALLOWED_ORIGINS = [
  "https://phoenixiao.github.io"
];

function makeResponse(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    }
  });
}

async function cloudbaseRequest(env, path, options = {}) {
  const envId = env.CLOUDBASE_ENV_ID;
  const apiKey = env.CLOUDBASE_API_KEY;

  if (!envId || !apiKey) {
    throw new Error("CloudBase environment variables are missing");
  }

  const url =
    `https://${envId}.api.tcloudbasegateway.com/v1/rdb/rest${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...options.headers
      }
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `CloudBase HTTP ${response.status}: ${text}`
      );
    }

    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getCount(env) {
  const result = await cloudbaseRequest(
    env,
    `/site_analytics?select=total_visits&site_id=eq.${SITE_ID}`,
    { method: "GET" }
  );

  if (!Array.isArray(result) || result.length === 0) {
    throw new Error("Analytics record not found");
  }

  return Number(result[0].total_visits);
}

async function recordVisit(env) {
  await cloudbaseRequest(
    env,
    "/rpc/record_site_visit",
    {
      method: "POST",
      body: JSON.stringify({
        p_site_id: SITE_ID
      })
    }
  );

  return await getCount(env);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (
      origin &&
      !ALLOWED_ORIGINS.includes(origin)
    ) {
      return makeResponse(
        { success: false, error: "Origin not allowed" },
        403
      );
    }

    const allowedOrigin = origin || ALLOWED_ORIGINS[0];

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === "GET" && path === "/health") {
        return makeResponse({
          success: true,
          service: "qxl-lab-global-analytics"
        }, 200, allowedOrigin);
      }

      if (request.method === "GET" && path === "/api/count") {
        const totalVisits = await getCount(env);

        return makeResponse({
          success: true,
          site_id: SITE_ID,
          total_visits: totalVisits
        }, 200, allowedOrigin);
      }

      if (request.method === "POST" && path === "/api/visit") {
        const totalVisits = await recordVisit(env);

        return makeResponse({
          success: true,
          message: "Visit recorded successfully",
          site_id: SITE_ID,
          total_visits: totalVisits
        }, 200, allowedOrigin);
      }

      return makeResponse({
        success: false,
        error: "Not found"
      }, 404, allowedOrigin);

    } catch (error) {
      return makeResponse({
        success: false,
        error: error.message || "Internal server error"
      }, 500, allowedOrigin);
    }
  }
};
