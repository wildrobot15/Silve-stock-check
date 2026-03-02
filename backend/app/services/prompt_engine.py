from dataclasses import dataclass


@dataclass
class PromptEngine:
    provider: str = "mock"

    def generate_workflow(self, prompt: str) -> dict:
        low = prompt.lower()
        if "phishing" in low:
            return self._phishing_workflow(prompt)
        if "brute force" in low:
            return self._bruteforce_workflow(prompt)
        if "ransomware" in low:
            return self._ransomware_workflow(prompt)
        return self._generic_workflow(prompt)

    def _common(self, name: str, prompt: str, steps: list[dict], branches: list[dict]) -> dict:
        integrations = ["SIEM", "EDR", "Email Gateway", "Firewall", "Threat Intel"]
        api_calls = [
            {"service": "SIEM", "method": "GET", "path": "/alerts/{id}"},
            {"service": "EDR", "method": "POST", "path": "/contain/host"},
            {"service": "Firewall", "method": "POST", "path": "/block/ip"},
        ]
        visual_flow = {
            "nodes": [{"id": f"n{i}", "label": s["title"], "type": "action"} for i, s in enumerate(steps, 1)],
            "edges": [{"source": f"n{i}", "target": f"n{i+1}"} for i in range(1, len(steps))],
        }
        return {
            "name": name,
            "prompt": prompt,
            "structured_logic": {"trigger": "alert_created", "objective": name, "version": "1.0.0"},
            "playbook_steps": steps,
            "branches": branches,
            "integrations": integrations,
            "api_calls": api_calls,
            "error_handling": [
                {"step": "all", "on_error": "retry", "retries": 3, "fallback": "manual_investigation"}
            ],
            "approvals": [
                {"stage": "containment", "required_role": "incident_commander"},
                {"stage": "external_notification", "required_role": "soc_manager"},
            ],
            "escalation": {
                "condition": "severity >= high OR data_exfiltration == true",
                "target": "CSIRT",
                "sla_minutes": 15,
            },
            "xsoar_json": {"type": "playbook", "name": name, "tasks": steps, "branches": branches},
            "splunk_json": {"playbook": name, "actions": steps, "conditions": branches},
            "visual_flow": visual_flow,
        }

    def _phishing_workflow(self, prompt: str) -> dict:
        steps = [
            {"title": "Ingest suspicious email", "action": "pull_email_headers"},
            {"title": "Detonate URL and attachments", "action": "sandbox_analysis"},
            {"title": "Search similar emails", "action": "email_gateway_hunt"},
            {"title": "Disable malicious sender", "action": "block_sender"},
            {"title": "Notify affected users", "action": "user_notification"},
        ]
        branches = [
            {"if": "malicious_score >= 80", "then": "auto_contain", "else": "analyst_review"},
            {"if": "vip_user == true", "then": "priority_escalation", "else": "normal_queue"},
        ]
        return self._common("Phishing Email Triage Automation", prompt, steps, branches)

    def _bruteforce_workflow(self, prompt: str) -> dict:
        steps = [
            {"title": "Collect failed login telemetry", "action": "query_siem_auth_failures"},
            {"title": "Enrich source IP", "action": "threat_intel_lookup"},
            {"title": "Temporarily block source", "action": "firewall_block_ip"},
            {"title": "Force password reset", "action": "identity_reset"},
            {"title": "Raise incident and notify IAM", "action": "ticket_and_notify"},
        ]
        branches = [
            {"if": "failed_logins >= 20 in 5m", "then": "containment", "else": "monitor"},
            {"if": "geo_anomaly == true", "then": "MFA_enforcement", "else": "continue"},
        ]
        return self._common("Brute Force Detection Response", prompt, steps, branches)

    def _ransomware_workflow(self, prompt: str) -> dict:
        steps = [
            {"title": "Detect encryption behavior", "action": "edr_behavioral_alert"},
            {"title": "Isolate host", "action": "edr_isolate_host"},
            {"title": "Block C2 domains", "action": "firewall_block_domain"},
            {"title": "Snapshot evidence", "action": "collect_forensic_artifacts"},
            {"title": "Escalate to IR and legal", "action": "major_incident_protocol"},
        ]
        branches = [{"if": "critical_asset == true", "then": "executive_war_room", "else": "IR_standard"}]
        return self._common("Ransomware Containment Workflow", prompt, steps, branches)

    def _generic_workflow(self, prompt: str) -> dict:
        steps = [
            {"title": "Ingest alert", "action": "siem_ingest"},
            {"title": "Classify severity", "action": "severity_scoring"},
            {"title": "Execute containment", "action": "run_containment"},
        ]
        branches = [{"if": "severity == high", "then": "escalate", "else": "close_or_monitor"}]
        return self._common("Generated SOC Workflow", prompt, steps, branches)
