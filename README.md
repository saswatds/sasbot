# sasbot

**Your personal AI agent for productivity, built for developers who ship.**

sasbot is an always-on assistant that manages your tasks, notes, reminders, and GitHub workflow — accessible from Slack or the web.

---

## What it does

**Stay organized** — Create tasks with priorities and due dates using natural language. Never lose a thought with tagged notes and instant search.

**Stay on schedule** — Set reminders that proactively notify you. sasbot understands relative dates like "tomorrow" or "next Friday."

**Stay informed** — Search the web, fetch content from URLs, and check your GitHub notifications, PRs, and issues without leaving the conversation.

---

## Try asking

> "Remind me to review the deployment checklist tomorrow at 10am"

> "Save a note tagged #ideas: build a CLI dashboard for server metrics"

> "What are my open GitHub notifications?"

> "Show me all high priority tasks that are still open"

> "Search the web for the latest Bun release notes"

> "What PRs are open on saswatds/astro-agent?"

> "Find my notes tagged #work"

---

## Capabilities

|                |                                                            |
| -------------- | ---------------------------------------------------------- |
| **Notes**      | Save, search, and list notes with tags                     |
| **Tasks**      | Create, complete, and filter tasks by status and priority  |
| **Reminders**  | Schedule proactive reminders with natural language dates   |
| **Web Search** | Search the web and fetch content from any URL              |
| **GitHub**     | View notifications, pull requests, and issues across repos |

---

## Interfaces

- **Slack** — Chat with sasbot directly in your workspace via Socket Mode
- **Web Playground** — Interactive UI at `localhost:3000` for local development

---

## Configuration

sasbot is configured in `astro.yml` and requires the following environment variables:

| Variable            | Purpose                             |
| ------------------- | ----------------------------------- |
| `ANTHROPIC_API_KEY` | Powers the AI model (Claude Sonnet) |
| `SLACK_APP_TOKEN`   | Slack Socket Mode connection        |
| `SLACK_BOT_TOKEN`   | Slack bot identity                  |
| `GITHUB_TOKEN`      | GitHub API access                   |
| `BRAVE_API_KEY`     | Web search                          |

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌───────────┐
│   Slack /   │────▶│     sasbot       │────▶│   Redis   │
│   Web UI    │◀────│   (agent core)   │     │ (storage) │
└─────────────┘     └──────────────────┘     └───────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              Claude API    External APIs
              (reasoning)   (GitHub, Brave,
                             web fetch)
```

---

Built with [Astro Agent Framework](https://github.com/saswatds) · Powered by Claude
