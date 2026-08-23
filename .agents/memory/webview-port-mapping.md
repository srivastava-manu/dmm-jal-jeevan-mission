---
name: Webview port mapping
description: Keep the workspace preview URL mapped to the port the webview workflow actually serves.
---

For a Replit webview workflow, the app serves on port 5000, while the bare development URL
uses the external HTTP port. The default URL fails when that port is mapped to an inactive
legacy backend port instead.

**Why:** A healthy local process on port 5000 can still produce a 502 from the bare preview URL
if external port 80 forwards elsewhere.

**How to apply:** Map local port 5000 to external port 80 and make the production run command
use port 5000 as well. Avoid retaining a stale port-80 mapping to a separate development API.