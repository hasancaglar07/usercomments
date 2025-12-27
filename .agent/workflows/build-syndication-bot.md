---
description: Build and Run Web 2.0 Syndication Bot
---

This workflow guides the process of building and running the SEO Syndication Bot.

# Prerequisites
- Python installed
- Medium Integration Token (Get from Settings > Integration Tokens)
- Tumblr OAuth Keys (Get from Tumblr API)
- Groq/OpenAI Key for content spinning

# Steps

1.  **Create Bot Script**: Create `tools/tools/syndicator_bot.py` with the core logic.
2.  **Implement Providers**:
    - Medium Provider
    - Tumblr Provider
3.  **Setup Environment**: Add keys to `.env`.
4.  **Run Bot**: Execute the bot to syndicate content.

# Usage

```bash
python tools/tools/syndicator_bot.py
```
