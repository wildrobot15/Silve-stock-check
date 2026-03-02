import axios from 'axios'
import { WorkflowResponse } from '../types/workflow'

const client = axios.create({ baseURL: 'http://localhost:8000/api/v1' })

export async function generateWorkflow(prompt: string, token?: string): Promise<WorkflowResponse> {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const { data } = await client.post<WorkflowResponse>('/workflows/generate', { prompt, output_format: 'both' }, { headers })
  return data
}
