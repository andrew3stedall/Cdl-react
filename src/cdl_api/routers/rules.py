"""Rules knowledge base API routes."""

from fastapi import APIRouter, Query, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ApiErrorResponse, ErrorCode
from cdl_api.contracts.rules_models import RuleCategory, RuleSection, RulesIndexResponse
from cdl_api.services.rules_service import RulesService

router = APIRouter(prefix="/rules", tags=["rules"])
_service = RulesService()


@router.get("", response_model=RulesIndexResponse)
def list_rules(category: RuleCategory | None = None) -> RulesIndexResponse:
    return _service.list_rules(category=category)


@router.get("/search", response_model=RulesIndexResponse)
def search_rules(
    q: str = Query(default="", max_length=100),
    category: RuleCategory | None = None,
) -> RulesIndexResponse:
    return _service.search_rules(query=q, category=category)


@router.get(
    "/{rule_id}",
    response_model=RuleSection,
    responses={status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse}},
)
def get_rule(rule_id: str) -> RuleSection | JSONResponse:
    rule = _service.get_rule(rule_id)
    if rule is not None:
        return rule

    error = ApiErrorResponse(
        code=ErrorCode.NOT_FOUND,
        message="Rule section missing.",
        details={"rule_id": rule_id},
    )
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=error.model_dump(mode="json"),
    )
