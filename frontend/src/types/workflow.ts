export interface WorkflowResponse {
  name: string
  structured_logic: Record<string, unknown>
  playbook_steps: { title: string; action: string }[]
  branches: { if: string; then: string; else?: string }[]
  integrations: string[]
  api_calls: { service: string; method: string; path: string }[]
  error_handling: Record<string, unknown>[]
  approvals: Record<string, unknown>[]
  escalation: Record<string, unknown>
  xsoar_json: Record<string, unknown>
  splunk_json?: Record<string, unknown>
  visual_flow: { nodes: { id: string; label: string }[]; edges: { source: string; target: string }[] }
}
