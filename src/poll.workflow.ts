import type {components} from '@octokit/openapi-types'
import type {Conclusion} from './utils'
import {WorkflowOptions as Options} from './options'
import {poll, Poller} from './poll'
import {asConclusion, maxBy} from './utils'

type WorkflowRun = components['schemas']['workflow-run']

class WorkflowPoller implements Poller<Options> {
  public async func(options: Options): Promise<Conclusion | null | undefined> {
    const workflow = await this.getLatestWorkflowRunId(options)
    options.log('')
    if (workflow === undefined) {
      return undefined
    }
    return asConclusion(workflow.conclusion, options.warn) || null
  }
  private async getWorkflowRuns(options: Options): Promise<WorkflowRun[]> {
    const {client, log, owner, repo, ref: head_sha, workflowName} = options
    log(`Getting workflow runs named '${workflowName}'`)
    const response = await client.request('GET /repos/{owner}/{repo}/actions/runs', {
      owner,
      repo,
      head_sha,
    })
    log(`Received ${response.data.total_count} runs`)
    return response.data.workflow_runs
  }

  private async getLatestWorkflowRunId(options: Options): Promise<WorkflowRun | undefined> {
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
    const conclusionLog = latestWorkflowRun.conclusion !== null ? ` (conlusion='${latestWorkflowRun.conclusion}')` : ''
    log(
      `The highest run_attempt is ${latestWorkflowRun.run_attempt} (id=${latestWorkflowRun.id}) with status '${latestWorkflowRun.status}'${conclusionLog}`
    )
    return latestWorkflowRun
  }
  public onTimedOut(options: Options, warmupDeadlined: boolean): 'not_found' | 'timed_out' {
    const {log, timeoutSeconds, warmupSeconds} = options
    if (warmupDeadlined) {
      log(`No workflow runs found after ${warmupSeconds} seconds, exiting with conclusion 'not_found'`)
      return 'not_found'
    } else {
      log(`No completed workflow runs after ${timeoutSeconds} seconds, exiting with conclusion 'timed_out'`)
      return 'timed_out'
    }
  }
}

export async function pollWorkflowrun(options: Options): Promise<Conclusion> {
  return poll(options, new WorkflowPoller())
}
