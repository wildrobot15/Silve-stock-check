import { useState } from 'react'
import { PromptInput } from '../components/PromptInput'
import { WorkflowDiagram } from '../components/WorkflowDiagram'
import { generateWorkflow } from '../services/api'
import { WorkflowResponse } from '../types/workflow'

export function Dashboard() {
  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null)

  return (
    <main className="mx-auto grid max-w-7xl gap-4 p-6">
      <h1 className="text-3xl font-bold">SOAR Workflow Studio</h1>
      <PromptInput onGenerate={async (prompt) => setWorkflow(await generateWorkflow(prompt))} />
      <WorkflowDiagram flow={workflow?.visual_flow} />
      {workflow && (
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-sm">{JSON.stringify(workflow.xsoar_json, null, 2)}</pre>
      )}
    </main>
  )
}
