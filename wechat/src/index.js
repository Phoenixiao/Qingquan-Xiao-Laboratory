
/**
 * Qingquan Xiao Laboratory
 * WeChat Official Account Auto Reply
 *
 * Platform: Cloudflare Workers
 * Mode: Plaintext callback
 * Version: 1.1.0
 */

const LAB_WEBSITE = "https://phoenixiao.github.io/Qingquan-Xiao-Laboratory";

// ==========================================
// 1. XML parsing
// ==========================================

function getXmlValue(xml, tag) {
  const regex = new RegExp(
    `<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`
  );

  const match = xml.match(regex);

  if (!match) return "";

  const value = match[1].trim();

  const cdataMatch = value.match(
    /^<!\\[CDATA\\[([\\s\\S]*)\\]\\]>$/
  );

  if (cdataMatch) {
    return cdataMatch[1];
  }

  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// ==========================================
// 2. WeChat signature verification
// ==========================================

async function verifySignature(
  token,
  timestamp,
  nonce,
  signature
) {
  if (!token || !timestamp || !nonce || !signature) {
    return false;
  }

  const raw = [token, timestamp, nonce]
    .sort()
    .join("");

  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(raw)
  );

  const hash = Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  return hash === signature.toLowerCase();
}

// ==========================================
// 3. XML CDATA helper
// ==========================================

function cdata(value) {
  return String(value).replace(
    /]]>/g,
    "]]]]><![CDATA[>"
  );
}

// ==========================================
// 4. Generate WeChat text reply
// ==========================================

function createReply(toUser, fromUser, content) {
  const now = Math.floor(Date.now() / 1000);

  return `
<xml>
  <ToUserName><![CDATA[${cdata(toUser)}]]></ToUserName>
  <FromUserName><![CDATA[${cdata(fromUser)}]]></FromUserName>
  <CreateTime>${now}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${cdata(content)}]]></Content>
</xml>`.trim();
}

// ==========================================
// 5. Laboratory reply database
// ==========================================

const replies = {
  "实验室介绍": `浙江大学肖庆全实验室

致力于新一代基因编辑工具与基因治疗技术的开发。

欢迎关注我们的研究进展与学术活动。

官方网站：
${LAB_WEBSITE}`,

  "研究方向": `实验室主要研究方向：

1. 新一代基因编辑工具的开发
2. 紧凑型CRISPR-Cas系统研究
3. 基因编辑技术的优化与应用
4. 基因治疗技术开发

更多信息：
${LAB_WEBSITE}`,

  "论文": `欢迎了解肖庆全实验室的学术成果。

请访问实验室官方网站查看论文及科研成果：

${LAB_WEBSITE}`,

  "网站": `浙江大学肖庆全实验室官方网站：

${LAB_WEBSITE}`,

  "联系方式": `欢迎访问实验室官方网站了解团队及联系信息：

${LAB_WEBSITE}`,

  "加入我们": `欢迎对基因编辑与基因治疗研究感兴趣的同学加入我们。

请访问实验室官方网站了解更多信息：

${LAB_WEBSITE}`
};

// ==========================================
// 6. Keyword recognition
// ==========================================

function getReply(content) {
  const text = (content || "").trim();

  if (!text) {
    return defaultReply();
  }

  // Exact matching
  if (replies[text]) {
    return replies[text];
  }

  // Partial matching
  for (const keyword of Object.keys(replies)) {
    if (text.includes(keyword)) {
      return replies[keyword];
    }
  }

  return defaultReply();
}

// ==========================================
// 7. Default reply
// ==========================================

function defaultReply() {
  return `感谢关注浙江大学肖庆全实验室！

您可以发送以下关键词获取信息：

【实验室介绍】
【研究方向】
【论文】
【网站】
【联系方式】
【加入我们】

官方网站：
${LAB_WEBSITE}`;
}

// ==========================================
// 8. HTTP XML response
// ==========================================

function xmlResponse(xml) {
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

// ==========================================
// 9. Cloudflare Worker
// ==========================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check
    if (
      url.pathname === "/" &&
      request.method === "GET"
    ) {
      return new Response(
        "Qingquan Xiao Laboratory WeChat Service is running.",
        {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        }
      );
    }

    // WeChat callback endpoint
    if (url.pathname !== "/wechat") {
      return new Response("Not Found", {
        status: 404
      });
    }

    if (request.method !== "GET" &&
        request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }

    // Check environment configuration
    if (!env.WECHAT_TOKEN) {
      console.error("WECHAT_TOKEN is not configured.");

      return new Response("Server configuration error", {
        status: 500
      });
    }

    const signature = url.searchParams.get("signature");
    const timestamp = url.searchParams.get("timestamp");
    const nonce = url.searchParams.get("nonce");

    try {
      // Verify WeChat signature
      const valid = await verifySignature(
        env.WECHAT_TOKEN,
        timestamp,
        nonce,
        signature
      );

      if (!valid) {
        return new Response("Invalid signature", {
          status: 403
        });
      }

      // ======================================
      // GET: WeChat server URL verification
      // ======================================

      if (request.method === "GET") {
        const echostr = url.searchParams.get("echostr");

        if (echostr === null) {
          return new Response("Missing echostr", {
            status: 400
          });
        }

        return new Response(echostr, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      }

      // ======================================
      // POST: Receive WeChat messages
      // ======================================

      const xml = await request.text();

      if (!xml) {
        return new Response("Empty message", {
          status: 400
        });
      }

      const toUser = getXmlValue(xml, "FromUserName");
      const fromUser = getXmlValue(xml, "ToUserName");
      const msgType = getXmlValue(xml, "MsgType");

      if (!toUser || !fromUser || !msgType) {
        console.error("Invalid WeChat XML message.");

        return new Response("Invalid message", {
          status: 400
        });
      }

      // New subscriber event
      if (msgType === "event") {
        const event = getXmlValue(xml, "Event");

        if (event === "subscribe") {
          const welcome = `欢迎关注浙江大学肖庆全实验室！

我们致力于新一代基因编辑工具与基因治疗技术的开发。

发送以下关键词了解更多：

【实验室介绍】
【研究方向】
【论文】
【网站】
【加入我们】

官方网站：
${LAB_WEBSITE}`;

          return xmlResponse(
            createReply(toUser, fromUser, welcome)
          );
        }

        // Other events are not handled
        return new Response("", {
          status: 200
        });
      }

      // Text messages
      if (msgType === "text") {
        const content = getXmlValue(xml, "Content");
        const reply = getReply(content);

        return xmlResponse(
          createReply(toUser, fromUser, reply)
        );
      }

      // Unsupported message types
      return new Response("", {
        status: 200
      });

    } catch (error) {
      console.error("WeChat processing error:", error);

      return new Response("Internal Server Error", {
        status: 500
      });
    }
  }
};
