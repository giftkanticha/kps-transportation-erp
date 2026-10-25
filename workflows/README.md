# Workflows

Markdown SOPs (Standard Operating Procedures) — **Layer 1** of the WAT framework.

Each workflow is a plain-language brief for the agent. The agent reads the
relevant workflow, then orchestrates the `tools/` to carry it out.

## Writing a workflow

Copy `_template.md` and fill it in. A good workflow answers:

1. **Objective** — what done looks like
2. **Inputs** — what the agent needs before starting (and where to get them)
3. **Tools** — which scripts in `tools/` to run, in what order
4. **Output** — the deliverable and where it lands (usually a cloud service)
5. **Edge cases** — known failure modes and how to recover

## Conventions

- One workflow per file, named for the task: `scrape_website.md`, `sync_dispatch_to_sheet.md`
- Keep them current. When you learn something (rate limits, quirks), update the workflow.
- Don't create or overwrite workflows without the user's go-ahead.
