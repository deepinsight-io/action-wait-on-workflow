import {wait} from './wait'
import {maxBy} from './utils'
import type {components} from '@octokit/openapi-types'
import type {CheckOptions as Options} from './options'
type CheckRun = components['schemas']['check-run']

export const poll = async (options: Options): Promise<string> => {
  const {client, log, checkName, timeoutSeconds, intervalSeconds, warmupSeconds, owner, repo, ref} = options

  let now = new Date().getTime()
  const deadline = now + timeoutSeconds * 1000
  const warmupDeadline = now + warmupSeconds * 1000
  let foundRun = false

  while (now <= deadline) {
    log(`Retrieving check runs named ${checkName} on ${owner}/${repo}@${ref}...`)
    const result = await client.rest.checks.listForRef({
      check_name: checkName,
      owner,
      repo,
      ref
    })

    log(`Retrieved ${result.data.check_runs.length} check runs named ${checkName}`)

    foundRun = foundRun || result.data.check_runs.length !== 0

    if (now >= warmupDeadline && !foundRun) {
      log(`No checks found after ${warmupSeconds} seconds, exiting with conclusion 'not_found'`)
      return 'not_found'
    }

    const lastStartedCheck = getLastStartedCheck(result.data.check_runs)
    if (lastStartedCheck !== undefined && lastStartedCheck.status === 'completed') {
      log(`Found a completed check with id ${lastStartedCheck.id} and conclusion ${lastStartedCheck.conclusion}`)
      // conclusion is only `null` if status is not `completed`.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return lastStartedCheck.conclusion!
    }

    log(`No completed checks named ${checkName}, waiting for ${intervalSeconds} seconds...`)
    await wait(intervalSeconds * 1000)

    now = new Date().getTime()
  }

  log(`No completed checks after ${timeoutSeconds} seconds, exiting with conclusion 'timed_out'`)
  return 'timed_out'
}
function getLastStartedCheck(checks: CheckRun[]): CheckRun | undefined {
  if (checks.length === 0) return undefined

  return maxBy(checks, c => {
    if (c.started_at === null) throw new Error('c.started_at === null')
    return Date.parse(c.started_at)
  })
}
