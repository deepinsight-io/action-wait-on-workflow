import {GitHub} from '@actions/github/lib/utils'

export interface SharedOptions {
  client: InstanceType<typeof GitHub>
  log: (message: string) => void

  timeoutSeconds: number
  intervalSeconds: number
  warmupSeconds: number
  owner: string
  repo: string
  ref: string
}

export interface CheckOptions extends SharedOptions {
  checkName: string
}
