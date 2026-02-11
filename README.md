# SOC L3 Cybersecurity News Watch

A lightweight Python web app built on the standard library that aggregates fresh cybersecurity headlines relevant to **SOC L3 analysts** focused on **EDR/SIEM operations**.

## What it does

- Pulls latest items from multiple cyber RSS/Atom feeds (CISA, BleepingComputer, The Hacker News, etc.)
- Filters by a configurable time window (default: 48h)
- Optional keyword filtering (vendor, CVE, campaign, etc.)
- Priority scoring based on threat-centric terms (e.g., exploit, ransomware, CVE, EDR, SIEM)
- Highlights high-priority items for faster triage

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
python app.py
```

Then open: `http://localhost:8000`

## Notes

- Feeds can occasionally rate-limit or fail temporarily; the app skips failed sources gracefully.
- All timestamps are normalized to UTC.
