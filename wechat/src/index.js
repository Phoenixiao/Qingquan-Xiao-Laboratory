
/**
 * Qingquan Xiao Laboratory
 * WeChat Official Account Auto Reply
 * Cloudflare Workers
 *
 * Initial version: plaintext callback mode
 */

const LAB_WEBSITE = "https://www.qingquanxiaolab.com";

// XML字段读取
function getXmlValue(xml, tag) {
  const regex = new RegExp(
    `<${tag}>([\\s\\S]*?)</${tag}>`
  );

  const match = xml.match(regex);

  if (!match) return "";

  let value = match[1].trim();

  if (value.startsWith("<![CDATA[")) {
    return value.slice(9, -3);
  }

  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// 微信签名验证
async function verifySignature(token, timestamp, nonce, signature) {
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

// 生成微信文字回复
function createReply(toUser, fromUser, content) {
  const safeContent = String(content)
    .replace(/]]>/g, "]]]]><![CDATA[>");

  return `
<xml>
  <ToUserName><![CDATA[${toUser}]]></ToUserName>
  <FromUserName><![CDATA[${fromUser}]]></FromUserName>
  <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${safeContent}]]></Content>
</xml>`.trim();
}

// 自动回复内容
const replies = {
  "实验室介绍": `浙江大学肖庆全实验室

致力于新一代基因编辑工具与基因治疗技术的开发。

欢迎关注我们的研究进展与学术活动。

官方网站：
${LAB_WEBSITE}`,

  "研究方向": `实验室主要研究方向：

1. 新一代基因编辑工具的开发
2. 紧凑型CRISPR-Cas系统研究
3. 基因编辑技术优化及应用
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

// 关键词识别
function getReply(content) {
  const text = (content || "").trim();

  if (!text) {
    return defaultReply();
  }

  // 精确匹配
  if (replies[text]) {
    return replies[text];
  }

  // 模糊匹配
  for (const keyword of Object.keys(replies)) {
    if (text.includes(keyword)) {
      return replies[keyword];
    }
  }

  return defaultReply();
}

// 默认回复
function defaultReply() {
  return `感谢关注浙江大学肖庆全实验室！

您可以发送以下关键词：

【实验室介绍】
【研究方向】
【论文】
【网站】
【联系方式】
【加入我们】

官方网站：
${LAB_WEBSITE}`;
}

// HTTP响应
function xmlResponse(xml) {
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
}

// Worker入口
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 首页健康检查
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(
        "Qingquan Xiao Laboratory WeChat Service is running.",
        { status: 200 }
      );
    }

    // 仅开放微信回调接口
    if (url.pathname !== "/wechat") {
      return new Response("Not Found", { status: 404 });
    }

    if (!env.WECHAT_TOKEN) {
      return new Response("Server configuration error", {
        status: 500
      });
    }

    const signature = url.searchParams.get("signature");
    const timestamp = url.searchParams.get("timestamp");
    const nonce = url.searchParams.get("nonce");

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

    // 微信服务器首次验证URL
    if (request.method === "GET") {
      const echostr = url.searchParams.get("echostr");

      return new Response(echostr || "", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }

    try {
      const xml = await request.text();

      const toUser = getXmlValue(xml, "FromUserName");
      const fromUser = getXmlValue(xml, "ToUserName");
      const msgType = getXmlValue(xml, "MsgType");

      if (!toUser || !fromUser) {
        return new Response("", { status: 200 });
      }

      // 新用户关注事件
      if (msgType === "event") {
        const event = getXmlValue(xml, "Event");

        if (event === "subscribe") {
          const welcome = `欢迎关注浙江大学肖庆全实验室！

我们致力于新一代基因编辑工具与基因治疗技术的开发。

发送【研究方向】【论文】【网站】了解更多信息。

${LAB_WEBSITE}`;

          return xmlResponse(
            createReply(toUser, fromUser, welcome)
          );
        }

        return new Response("", { status: 200 });
      }

      // 普通文字消息
      if (msgType === "text") {
        const content = getXmlValue(xml, "Content");
        const reply = getReply(content);

        return xmlResponse(
          createReply(toUser, fromUser, reply)
        );
      }

      // 其他类型消息暂不处理
      return new Response("", { status: 200 });

    } catch (error) {
      console.error("WeChat processing error:", error);

      return new Response("Internal Server Error", {
        status: 500
      });
    }
  }
};

