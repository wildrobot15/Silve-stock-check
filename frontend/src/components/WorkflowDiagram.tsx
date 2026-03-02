import ReactFlow, { Background, Controls } from 'reactflow'
import 'reactflow/dist/style.css'

export function WorkflowDiagram({ flow }: { flow?: { nodes: { id: string; label: string }[]; edges: { source: string; target: string }[] } }) {
  if (!flow) return <div className="rounded-xl bg-slate-900 p-4">Generate a workflow to see the visual builder.</div>

  const nodes = flow.nodes.map((n, idx) => ({
    id: n.id,
    data: { label: n.label },
    position: { x: 150 * idx, y: 100 },
    type: 'default',
  }))

  return (
    <div className="h-80 rounded-xl bg-white text-black">
      <ReactFlow nodes={nodes} edges={flow.edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
