const ALLOWED_ORIGINS = [
  "https://phoenixiao.github.io",
  "https://github.com/Phoenixiao/Qingquan-Xiao-Laboratory",
  "https://phoenixiao.github.io/Qingquan-Xiao-Laboratory/index-zh.html"
];

function corsHeaders(origin) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  if (ALLOWED_ORIGINS.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  }

  return headers;
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin)
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (!ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse(
        { success: false, error: "Origin not allowed" },
        403,
        ""
      );
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    if (request.method !== "GET") {
      return jsonResponse(
        { success: false, error: "Method not allowed" },
        405,
        origin
      );
    }

    try {
      // 记录一次新的网页访问
      if (url.pathname === "/api/visit") {
        const result = await env.DB.prepare(`
          UPDATE site_stats
          SET total_visits = total_visits + 1
          WHERE id = ?
          RETURNING total_visits
        `).bind("qingquan-xiao-lab").first();

        if (!result) {
          throw new Error("Statistics record not found");
        }

        return jsonResponse({
          success: true,
          total_visits: result.total_visits
        }, 200, origin);
      }

      // 仅查询累计访问量，不增加计数
      if (url.pathname === "/api/count") {
        const result = await env.DB.prepare(`
          SELECT total_visits
          FROM site_stats
          WHERE id = ?
        `).bind("qingquan-xiao-lab").first();

        if (!result) {
          throw new Error("Statistics record not found");
        }

        return jsonResponse({
          success: true,
          total_visits: result.total_visits
        }, 200, origin);
      }

      return jsonResponse({
        success: false,
        error: "Not found"
      }, 404, origin);

    } catch (error) {
      return jsonResponse({
        success: false,
        error: "Internal server error"
      }, 500, origin);
    }
  }
};

