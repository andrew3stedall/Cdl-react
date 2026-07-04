import json
from pathlib import Path

DEVCONTAINER = Path(".devcontainer/devcontainer.json")
RUNBOOK = Path("docs/runbooks/github-codespaces-preview.md")


def test_devcontainer_forwards_frontend_and_backend_ports() -> None:
    config = json.loads(DEVCONTAINER.read_text(encoding="utf-8"))

    assert 5173 in config["forwardPorts"]
    assert 8000 in config["forwardPorts"]
    assert "mcr.microsoft.com/devcontainers/python:1-3.12-bookworm" == config["image"]
    assert "ghcr.io/devcontainers/features/node:1" in config["features"]


def test_devcontainer_installs_backend_and_frontend_dependencies() -> None:
    config = json.loads(DEVCONTAINER.read_text(encoding="utf-8"))
    command = config["postCreateCommand"]

    assert "uv sync" in command
    assert "npm install" in command
    assert "frontend" in command


def test_codespaces_runbook_has_preview_commands_and_cost_gate() -> None:
    content = RUNBOOK.read_text(encoding="utf-8")

    assert "Create codespace on main" in content
    assert "uv run uvicorn cdl_api.app:app" in content
    assert "npm run dev" in content
    assert "port `5173`" in content
    assert "stop or delete the Codespace" in content
