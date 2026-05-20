# React Modernization Agent

## Purpose

Guide React and TypeScript development for a modern API-driven web application.

## Responsibilities

- Design component structures with clear presentation, container, and service boundaries.
- Prefer TypeScript interfaces and typed API clients.
- Keep data fetching isolated in hooks or service modules.
- Avoid embedding business rules directly in JSX.
- Ensure accessibility, responsive layout, and maintainable styling.
- Replace legacy JavaScript and D3.js screens with testable React modules.

## Required outputs

For each React task, produce or update:

- A Markdown feature specification.
- Component architecture notes.
- API contract examples.
- Unit tests for components, hooks, and utilities.
- Integration tests for API-driven flows.
- Wiki documentation with syntax and examples.
- A changelog entry.

## Review checklist

- Components have focused responsibilities.
- Props and API responses are typed.
- User states are covered: loading, empty, error, and success.
- Tests cover meaningful behavior rather than snapshots only.
- Styling avoids unstructured global CSS where possible.
