import * as core from '@actions/core'
import {context, getOctokit} from '@actions/github'
import {SharedOptions} from './options'
import {pollChecks} from './poll.check'
import {pollWorkflows} from './poll.workflow'

async function run(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc: any = core.getInput('success_conclusions')
    core.info(sc)
    core.info(typeof sc)
    core.info(typeof sc === 'string' ? 'true' : 'false')
    core.info(`success_conclusions instanceof String: ${sc instanceof String}`)

    const inputs: SharedOptions = {
      client: getOctokit(core.getInput('token', {required: true})),

      owner: core.getInput('owner') || context.repo.owner,
      repo: core.getInput('repo') || context.repo.repo,
      ref: core.getInput('ref') || context.payload.pull_request?.head.sha || context.sha,
      timeoutSeconds: parseInt(core.getInput('timeoutSeconds') || '600'),
      intervalSeconds: parseInt(core.getInput('intervalSeconds') || '10'),
      warmupSeconds: parseInt(core.getInput('warmupSeconds') || '10'),

      log: msg => core.info(msg),
    }

    const checkName = core.getInput('checkName')
    const workflowName = core.getInput('workflowName')
    if (!areCheckNameAndWorkflowNameValid(checkName, workflowName)) {
      return
    }

    if (checkName !== '') {
      const result = await pollChecks({...inputs, checkName})
      core.setOutput('conclusion', result)
    } else {
      const result = await pollWorkflows({...inputs, workflowName})
      core.setOutput('conclusion', result)
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error : JSON.stringify(error))
  }
}

function areCheckNameAndWorkflowNameValid(checkName: string, workflowName: string): boolean {
  if (checkName === '' && workflowName === '') {
    core.setFailed("Either 'checkName' xor 'workflowName' must be provided")
    return false
  }
  if (checkName !== '' && workflowName !== '') {
    core.debug(`checkName: '${checkName}'`)
    core.debug(`workflowName: '${workflowName}'`)
    core.setFailed("'checkName' and 'workflowName' cannot both be provided")
    return false
  }
  return true
}
run()
