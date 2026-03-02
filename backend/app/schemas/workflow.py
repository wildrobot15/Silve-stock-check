from pydantic import BaseModel, Field


class WorkflowCreateRequest(BaseModel):
    prompt: str = Field(min_length=10, max_length=1000)
    output_format: str = Field(default="xsoar", pattern="^(xsoar|splunk|both)$")


class WorkflowResponse(BaseModel):
    name: str
    structured_logic: dict
    playbook_steps: list[dict]
    branches: list[dict]
    integrations: list[str]
    api_calls: list[dict]
    error_handling: list[dict]
    approvals: list[dict]
    escalation: dict
    xsoar_json: dict
    splunk_json: dict | None
    visual_flow: dict


class WorkflowExportResponse(BaseModel):
    workflow_id: int
    format: str
    content: str
