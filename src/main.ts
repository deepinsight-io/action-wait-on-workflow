import * as core from '@actions/core'
import {context, getOctokit} from '@actions/github'
import {SharedOptions} from './options'
import {pollChecks} from './poll.check'
import {pollWorkflows} from './poll.workflow'
import {parseSuccessConclusions} from './utils'

async function run(): Promise<void> {
  try {
    const inputs: SharedOptions = {
      client: getOctokit(core.getInput('token', {required: true})),

      owner: core.getInput('owner') || context.repo.owner,
      repo: core.getInput('repo') || context.repo.repo,
      ref: core.getInput('ref') || context.payload.pull_request?.head.sha || context.sha,
      timeoutSeconds: parseInt(core.getInput('timeoutSeconds') || '600'),
      intervalSeconds: parseInt(core.getInput('intervalSeconds') || '10'),
      warmupSeconds: parseInt(core.getInput('warmupSeconds') || '10'),

      log: (msg: string) => core.info(msg),
    }

    const checkName = core.getInput('checkName')
    const workflowName = core.getInput('workflowName')
    if (!areCheckNameAndWorkflowNameValid(checkName, workflowName)) {
      return
    }

    const successConclusions = parseSuccessConclusions(core.getInput('successConclusions'), core)
    if (successConclusions === undefined) {
      return
    }

    const conclusion =
      checkName !== '' //
        ? await pollChecks({...inputs, checkName})
        : await pollWorkflows({...inputs, workflowName})
    core.setOutput('conclusion', conclusion)
    if (!successConclusions.includes(conclusion)) {
      core.setFailed(`Conclusion '${conclusion}' was not defined as a success`)
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
