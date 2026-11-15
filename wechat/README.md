
# Qingquan Xiao Laboratory WeChat Auto Reply

WeChat Official Account automatic reply service.

## Platform

- Cloudflare Workers
- GitHub
- WeChat Official Account

## Features

- WeChat server signature verification
- Automatic keyword replies
- Subscribe welcome messages
- Laboratory information responses

## Deployment

Deploy through Cloudflare Workers Builds.

## Security

WECHAT_TOKEN must be configured as a Cloudflare Worker secret.
Never commit credentials to GitHub.


---

# Repository Structure

This repository contains the official website and supporting digital resources of the Qingquan Xiao Laboratory at Zhejiang University.

- `index.html` — English laboratory website
- `index-zh.html` — Chinese laboratory website
- `images/` — Laboratory images and visual resources
- `wechat/` — WeChat Official Account automatic reply service

## WeChat Official Account

The WeChat automatic reply service is developed using Cloudflare Workers and maintained independently in the `wechat/` directory.

For deployment instructions and configuration, please refer to [`wechat/README.md`](wechat/README.md).

## Laboratory Website

https://www.qingquanxiaolab.com
