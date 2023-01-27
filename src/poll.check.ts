import {maxBy} from './utils'
import type {components} from '@octokit/openapi-types'
import type {CheckOptions as Options} from './options'
import {poll, Poller} from './poll'
type CheckRun = components['schemas']['check-run']

class CheckPoller implements Poller<Options> {
  public async func(options: Options): Promise<string | undefined | null> {
    const {client, log, checkName, intervalSeconds, owner, repo, ref} = options

    log(`Retrieving check runs named ${checkName} on ${owner}/${repo}@${ref}...`)
    const result = await client.rest.checks.listForRef({
      check_name: checkName,
      owner,
      repo,
      ref,
    })
    log(`Retrieved ${result.data.check_runs.length} check runs named ${checkName}`)

    const lastStartedCheck = this.getLastStartedCheck(result.data.check_runs)
    if (lastStartedCheck !== undefined && lastStartedCheck.status === 'completed') {
      log(`Found a completed check with id ${lastStartedCheck.id} and conclusion ${lastStartedCheck.conclusion}`)
      // conclusion is only `null` if status is not `completed`.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return lastStartedCheck.conclusion!
    }

    log(`No completed checks named ${checkName}, waiting for ${intervalSeconds} seconds...`)
    return lastStartedCheck === undefined ? undefined : null
  }
  public onTimedOut(options: Options, warmupDeadlined: boolean): string {
    const {log, timeoutSeconds, warmupSeconds} = options
    if (warmupDeadlined) {
      log(`No checks found after ${warmupSeconds} seconds, exiting with conclusion 'not_found'`)
      return 'not_found'
    } else {
      log(`No completed checks after ${timeoutSeconds} seconds, exiting with conclusion 'timed_out'`)
      return 'timed_out'
    }
  }

  private getLastStartedCheck(checks: CheckRun[]): CheckRun | undefined {
    if (checks.length === 0) return undefined

    return maxBy(checks, c => {
      if (c.started_at === null) throw new Error('c.started_at === null')
      return Date.parse(c.started_at)
    })
  }
}

export async function pollChecks(options: Options): Promise<string> {
  return await poll(options, new CheckPoller())
}
