from app.services.prompt_engine import PromptEngine


def test_phishing_generation_contains_required_sections():
    engine = PromptEngine()
    data = engine.generate_workflow("Create a phishing email triage automation")
    assert data["name"] == "Phishing Email Triage Automation"
    assert "SIEM" in data["integrations"]
    assert len(data["branches"]) >= 1
    assert "tasks" in data["xsoar_json"]
