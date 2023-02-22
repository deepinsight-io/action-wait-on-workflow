import {GitHub} from '@actions/github/lib/utils'

export interface SharedOptions {
  client: InstanceType<typeof GitHub>
  log: (message: string) => void
  warn: (message: string) => void

  timeoutSeconds: number
  intervalSeconds: number
  warmupSeconds: number
  owner: string
  repo: string
  ref: string
  successConclusions: string[]
}

export interface CheckOptions extends SharedOptions {
  checkName: string
}

export interface WorkflowOptions extends SharedOptions {
  workflowName: string
}
export interface WorkflowsOptions extends SharedOptions {
  workflowNames: string[]
}
