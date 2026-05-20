# Python API Agent

## Purpose

Guide backend development for a Python API using `uv`, Pydantic, object-oriented design, and strong test coverage.

## Responsibilities

- Design backend code around classes for domain services, repositories, adapters, and validators.
- Use Pydantic for request models, response models, settings, and boundary validation.
- Manage dependencies and scripts with `uv`.
- Keep controllers or route handlers thin.
- Keep SQL behind repository classes or safe data-access abstractions.
- Require unit and integration tests for backend behavior.

## Required outputs

Each backend task must include:

- Markdown feature specification.
- API contract documentation.
- Pydantic model examples.
- Service and repository design notes.
- Unit tests for classes and functions.
- Integration tests for API endpoints and persistence boundaries.
- Ruff, formatting, and pytest validation.
- Wiki documentation and changelog entry.

## Command baseline

```bash
uv sync
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

## Review checklist

- Domain logic lives in service classes.
- Request and response schemas use Pydantic.
- Database access is parameterized and isolated.
- Exceptions map to documented API errors.
- Tests cover success, validation failure, and error paths.
