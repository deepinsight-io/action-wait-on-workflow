import type {components} from '@octokit/openapi-types'
import {WorkflowOptions as Options} from './options'
import {maxBy} from './utils'

type WorkflowRun = components['schemas']['workflow-run']

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class WorkflowPoller {
  private async getWorkflowRuns(options: Options): Promise<WorkflowRun[]> {
    const {client, log, owner, repo, ref: head_sha} = options
    log(`Getting workflow runs`)
    const response = await client.request('GET /repos/{owner}/{repo}/actions/runs', {
      owner,
      repo,
      head_sha
    })
    log(`Received ${response.data.total_count} runs`)
    return response.data.workflow_runs
  }

  private async getLatestWorkflowRunId(options: Options): Promise<number | undefined> {
    const {log, workflowName, ref} = options
    const allWorkflowRuns = await this.getWorkflowRuns(options)
    if (allWorkflowRuns.length === 0) {
      log(`No workflow runs found for ${ref}`)
      return undefined
    }
    const workflowRuns = allWorkflowRuns.filter(run => run.name === workflowName)
    if (workflowRuns.length === 0) {
      log(`No workflow run name '${workflowName}' found for ${ref}. Names that exist are:`)
      for (const runName of [...new Set(allWorkflowRuns.map(run => run.name))].sort(undefined)) {
        log(`- ${runName}`)
      }

      return undefined
    }
    log(`${workflowRuns.length} workflow runs with name '${workflowName}' have been found`)
    const latestWorkflowRun = maxBy(workflowRuns, run => (run.run_attempt === undefined ? -1 : run.run_attempt))
    log(`The highest run_attempt is ${latestWorkflowRun.run_attempt}, id=${latestWorkflowRun.id}`)
    return latestWorkflowRun.id
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function poll(options: Options): Promise<'success' | 'already_running' | 'not_found'> {
  throw new Error('Not implemented')
}
