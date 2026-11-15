
# Qingquan Xiao Laboratory
## WeChat Official Account Auto Reply

An automatic reply service for the WeChat Official Account of the Qingquan Xiao Laboratory, Zhejiang University.

### 1. Technology Stack

- GitHub
- Cloudflare Workers
- WeChat Official Account API
- JavaScript

### 2. Features

- WeChat server signature verification
- Automatic keyword recognition
- Laboratory introduction replies
- Research interests replies
- Publications information
- Laboratory website links
- Contact information
- Recruitment information
- New subscriber welcome messages
- Default replies for unknown messages

### 3. Project Structure

```text
wechat/
├── src/
│   └── index.js
├── wrangler.toml
├── package.json
├── README.md
└── .gitignore
```

### 4. Deployment

This project is deployed using Cloudflare Workers Builds.

GitHub repository:

https://github.com/Phoenixiao/Qingquan-Xiao-Laboratory

Worker name:

`qingquan-xiao-wechat`

Root directory:

`wechat`

Build command:

`npm install`

Deploy command:

`npm run deploy`

### 5. Environment Variables

Configure the following secret in Cloudflare Workers:

| Variable | Description |
|---|---|
| `WECHAT_TOKEN` | WeChat Official Account server verification token |

Never commit secrets, passwords, or API credentials to GitHub.

### 6. WeChat Server Configuration

URL:

`https://YOUR-WORKER-DOMAIN/wechat`

Token:

Use the same value configured as `WECHAT_TOKEN`.

Initial message encryption mode:

Plaintext mode.

### 7. Laboratory Website

https://phoenixiao.github.io/Qingquan-Xiao-Laboratory

### 8. Maintenance

The source code is maintained in this repository.

Changes pushed to the configured GitHub branch can trigger automatic deployment through Cloudflare Workers Builds.

### 9. Security Notes

The initial implementation supports plaintext callback mode only.

AES message encryption, encrypted callback compatibility, message deduplication, and additional production security controls should be implemented before enabling encrypted message modes or relying on the service for production use.
