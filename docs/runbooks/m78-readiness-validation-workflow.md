# M78 Readiness Validation Workflow

This is the intended repository-only validation flow for the prep pass.

## Checks

```bash
uv sync
uv run pytest tests/test_m78_readiness_docs.py
```

## Gate

This validation only checks documentation gates. It does not deploy, provision resources, or prove staging readiness.

## Follow-up

After manual bootstrap is complete, add the actual staging deployment workflow and require smoke checks before production go-live.
