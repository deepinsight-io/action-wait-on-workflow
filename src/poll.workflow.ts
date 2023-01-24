import type {components} from '@octokit/openapi-types'
import {WorkflowOptions as Options} from './options'
import {maxBy} from './utils'
import {poll, Poller} from './poll'

type WorkflowRun = components['schemas']['workflow-run']

class WorkflowPoller implements Poller<Options> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async func(options: Options, start: number, now: number): Promise<string | undefined> {
    throw new Error('Not implemented')
  }
  public onTimedout(options: Options): string {
    const {log, timeoutSeconds} = options
    log(`No completed workflows after ${timeoutSeconds} seconds, exiting with conclusion 'timed_out'`)
    return 'timed_out'
  }
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

export async function pollWorkflows(options: Options): Promise<string> {
  // returns 'success' | 'already_running' | 'not_found'
  return poll(options, new WorkflowPoller())
}
