# Tools

Deterministic Python scripts — **Layer 3** of the WAT framework. These do the
actual work: API calls, data transforms, file ops, DB queries.

## Rules

- **Check here before building.** Only add a new script when nothing existing fits.
- Each tool should be runnable standalone (CLI args or env-driven) and testable.
- Read secrets from `.env` via `tools/_common.py` → `load_env()`. Never hardcode keys.
- Write disposable intermediates to `.tmp/`, never alongside source.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r tools/requirements.txt
```

## Conventions

- Name scripts by verb_noun: `scrape_single_site.py`, `export_dispatch_csv.py`
- Exit non-zero on failure with a clear message to stderr.
- Keep a short docstring at the top: purpose, inputs, output.
