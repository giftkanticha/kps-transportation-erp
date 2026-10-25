"""Shared helpers for WAT tools.

Import these from any script in tools/ so env loading and temp-file paths stay
consistent across the toolbox.
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP_DIR = ROOT / ".tmp"
ENV_FILE = ROOT / ".env"


def load_env(env_file: Path = ENV_FILE) -> None:
    """Load KEY=VALUE pairs from the root .env into os.environ.

    A tiny dependency-free loader so tools work without python-dotenv.
    Existing environment variables are not overwritten.
    """
    if not env_file.exists():
        return
    for raw in env_file.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def require_env(name: str) -> str:
    """Return an env var or raise a clear error naming the missing key."""
    load_env()
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"Missing required environment variable: {name} (set it in .env)")
    return value


def tmp_path(name: str) -> Path:
    """Return a path inside .tmp/, creating the directory if needed."""
    TMP_DIR.mkdir(exist_ok=True)
    return TMP_DIR / name
