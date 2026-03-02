import { useState } from 'react'

export function PromptInput({ onGenerate }: { onGenerate: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState('Create a phishing email triage automation')

  return (
    <div className="rounded-xl bg-slate-900 p-4 shadow-lg">
      <p className="mb-2 text-sm text-slate-300">Describe the workflow in natural language</p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="h-28 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
      />
      <button onClick={() => onGenerate(prompt)} className="mt-3 rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950">
        Generate SOAR Workflow
      </button>
    </div>
  )
}
