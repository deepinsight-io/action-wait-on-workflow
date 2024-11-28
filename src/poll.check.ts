import {Conclusion, maxBy} from './utils'
import type {components} from '@octokit/openapi-types'
import type {CheckOptions as Options} from './options'
import {poll, Poller} from './poll'
type CheckRun = components['schemas']['check-run']

class CheckPoller implements Poller<Options> {
  public async func(options: Options): Promise<Conclusion | undefined | null> {
    const {client, log, checkNames, intervalSeconds, owner, repo, ref} = options

    let hasLastStartedCheck = false
    for (const checkName of checkNames) {
      log(`Retrieving check runs named '${checkName}' on ${owner}/${repo}@${ref}...`)
      const result = await client.rest.checks.listForRef({
        check_name: checkName,
        owner,
        repo,
        ref,
      })
      log(`Retrieved ${result.data.check_runs.length} check runs named '${checkName}'`)

      const lastStartedCheck = this.getLastStartedCheck(result.data.check_runs)
      if (lastStartedCheck !== undefined) {
        if (isCompleted(lastStartedCheck)) {
          log(`Found a completed check with id ${lastStartedCheck.id} and conclusion '${lastStartedCheck.conclusion}'`)

          return lastStartedCheck.conclusion
        }
        hasLastStartedCheck = true
      }
    }

    log(`No completed checks named '${checkNames.join("', '")}', waiting for ${intervalSeconds} seconds...`)
    log('')

    return hasLastStartedCheck ? null : undefined
  }
  public onTimedOut(options: Options, warmupDeadlined: boolean): Conclusion {
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

function isCompleted(checkRun: CheckRun): checkRun is CheckRun & {conclusion: Exclude<CheckRun['conclusion'], null>} {
  // conclusion is only `null` if status is not `completed`.
  return checkRun.status === 'completed'
}
export async function pollCheckrun(options: Omit<Options, 'checkNames'> & {checkName: string}): Promise<Conclusion> {
  const checkNames = options.checkName.split('\n').map(name => name.trim())
  options.log(`Check names: '${checkNames.join("', '")}'`)
  return await poll({...options, checkNames}, new CheckPoller())
}
