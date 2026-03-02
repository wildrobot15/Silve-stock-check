# Example Workflows

## Phishing Email Triage
Prompt: `Create a phishing email triage automation`

- Trigger from SIEM/email alert
- Parse headers and URLs
- Sandbox detonation
- Conditional branch based on malicious score
- Approval checkpoint before tenant-wide sender block
- Escalate high severity to CSIRT in 15 minutes

## Brute Force Detection Response
Prompt: `Automate brute force detection response`

- Trigger on repeated failed login thresholds
- Geo and threat intel enrichment
- Block source IP in firewall
- Force reset affected identities
- Escalate when privileged account targeted
