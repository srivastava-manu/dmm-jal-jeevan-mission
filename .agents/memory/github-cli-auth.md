---
name: GitHub CLI authentication
description: Replit GitHub API connections and Shell Git credentials are separate authentication paths.
---

A GitHub connection attached through Replit integrations does not necessarily configure the
Shell's `git` remote authentication. When HTTPS Git operations fail with invalid credentials,
reconnect GitHub through the Replit Git pane rather than asking for a token in chat.

**Why:** The API integration can be healthy while `git pull` still fails because the Git pane
uses its own repository authorization.

**How to apply:** Reconnect the repository account in the Git pane, then retry the Git command.