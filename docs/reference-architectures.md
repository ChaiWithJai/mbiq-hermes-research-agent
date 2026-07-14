# Reference architecture map

## What exists in Google's TypeScript samples

At Google ADK Samples commit `68989de5a041a0be2321bfdb9f7d657b148e0558`, the `typescript` tree contains one implemented agent: `agents/customer_service`.

| Pattern | Google sample | MBIQ equivalent |
|---|---|---|
| One bounded agent | One `LlmAgent` owns the customer-service conversation | One Hermes project owns the research-brief job |
| Explicit tools | Typed functions for cart, inventory, discounts, scheduling, CRM, email, and QR codes | Exa MCP search and fetch, plus Hermes local file and terminal tools |
| Domain instruction | Global and task prompts define service behavior | `AGENTS.md` defines MBIQ's brand, evidence gates, and workflow |
| Configuration boundary | Model and environment settings live outside agent logic | Bonsai endpoint and Exa server live in Hermes config |
| Guard callbacks | Before-agent, before-tool, after-tool, and rate-limit callbacks | Approval mode, fetched-page requirement, source bar, and editorial gate |
| Service adapters | Mock tool layer separates the agent from real systems | MCP separates research behavior from Exa; local JSON separates it from the current site |
| Multimodal path | The sample can identify a product from video | Ternary Bonsai can accept vision input when the MLX VLM path is used |
| Runner | ADK's in-memory runner executes the loop | Hermes executes the loop and provides memory, skills, schedules, and sessions |

The sample does not contain TypeScript examples of planner-worker, sequential pipeline, parallel fan-out, or multi-agent delegation. Adding those patterns here would be invention, not reuse from the requested tree.

## Why Hermes is the harness

Hermes already supplies the parts ADK would otherwise provide: an agent loop, file and terminal tools, MCP discovery, persistent memory, learned skills, approvals, scheduling, and session history. A second orchestration library would add code without adding a job capability.

The minimal MBIQ architecture is:

```text
editor request
  -> Hermes in this repo (AGENTS.md)
  -> Ternary Bonsai 27B at localhost:8080/v1
  -> Exa MCP search + fetch
  -> data/events.json + local brand context
  -> briefs/<event-id>.md
  -> job-level rubric + human editorial review
```

## Growth path

Start with one bounded agent and measure completed briefs. Add parallel research only when the failure data shows that source discovery is the bottleneck. If that happens, Hermes can delegate separate source classes, such as archives, public records, and community voices, then merge them into one source ledger. Keep final claim checking and publication approval in a single accountable step.

