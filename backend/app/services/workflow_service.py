import json
import yaml
from sqlalchemy.orm import Session

from app.models.entities import Workflow, WorkflowVersion, AuditLog
from app.services.prompt_engine import PromptEngine


class WorkflowService:
    def __init__(self, db: Session):
        self.db = db
        self.engine = PromptEngine()

    def create_from_prompt(self, prompt: str, user_email: str) -> dict:
        generated = self.engine.generate_workflow(prompt)
        workflow = Workflow(
            name=generated["name"],
            prompt=prompt,
            created_by=1,
            status="draft",
            structured_logic=generated["structured_logic"],
            xsoar_json=generated["xsoar_json"],
            splunk_json=generated["splunk_json"],
            flow_nodes=generated["visual_flow"],
        )
        self.db.add(workflow)
        self.db.flush()

        version = WorkflowVersion(workflow_id=workflow.id, version=1, snapshot=generated)
        audit = AuditLog(user_id=1, action="workflow.create", metadata={"name": workflow.name, "actor": user_email})
        self.db.add_all([version, audit])
        self.db.commit()
        return generated | {"id": workflow.id}

    def export_workflow(self, workflow_id: int, format_name: str) -> str:
        workflow = self.db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise ValueError("Workflow not found")
        payload = workflow.xsoar_json if format_name == "xsoar" else workflow.splunk_json
        if format_name == "yaml":
            return yaml.safe_dump(payload, sort_keys=False)
        return json.dumps(payload, indent=2)
