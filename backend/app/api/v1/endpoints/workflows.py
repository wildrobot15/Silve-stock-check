from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.schemas.workflow import WorkflowCreateRequest, WorkflowResponse, WorkflowExportResponse
from app.services.workflow_service import WorkflowService

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.post("/generate", response_model=WorkflowResponse)
def generate_workflow(
    payload: WorkflowCreateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = WorkflowService(db)
    data = service.create_from_prompt(payload.prompt, current_user["email"])
    return WorkflowResponse(**data)


@router.get("/{workflow_id}/export", response_model=WorkflowExportResponse)
def export_workflow(
    workflow_id: int,
    format_name: str = "xsoar",
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles("engineer", "soc_manager", "admin")),
):
    service = WorkflowService(db)
    try:
        content = service.export_workflow(workflow_id, format_name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return WorkflowExportResponse(workflow_id=workflow_id, format=format_name, content=content)
