import * as core from '@actions/core'
import {context, getOctokit} from '@actions/github'
import {SharedOptions} from './options'
import {pollCheckrun} from './poll.check'
import {pollWorkflowruns} from './poll.workflow'
import {parseSuccessConclusions, stringToList} from './utils'
import type {GitHub} from '@actions/github/lib/utils'

async function run(): Promise<void> {
  try {
    const checkName = core.getInput('checkName')
    const workflowName = core.getInput('workflowName')
    if (!areCheckNameAndWorkflowNameValid(checkName, workflowName)) {
      return
    }

    const workflowNames = stringToList(workflowName, 'workflowName')

    const successConclusions = parseSuccessConclusions(core.getInput('successConclusions'), core)
    if (successConclusions === undefined) {
      return
    }

    const inputs: SharedOptions = {
      client: getOctokit(core.getInput('token', {required: true})),

      owner: core.getInput('owner') || context.repo.owner,
      repo: core.getInput('repo') || context.repo.repo,
      ref: core.getInput('ref') || context.payload.pull_request?.head.sha || context.sha,
      timeoutSeconds: parseInt(core.getInput('timeoutSeconds')),
      intervalSeconds: parseInt(core.getInput('intervalSeconds')),
      warmupSeconds: parseInt(core.getInput('warmupSeconds')),
      successConclusions,

      log: msg => core.info(msg),
      warn: msg => core.warning(msg),
    }

    const conclusion =
      checkName !== '' //
        ? await pollCheckrun({...inputs, checkName})
        : await pollWorkflowruns({...inputs, workflowNames})
    core.setOutput('conclusion', conclusion)
    if (!successConclusions.includes(conclusion)) {
      if (core.getInput('cancelOnFailure') === 'true') {
        await cancelCurrentWorkflow(inputs.client)
          
        core.info('Waiting for workflow to be cancelled...')
        for (let index = 0; index < 60; index++) {
          core.info('Waiting for workflow to be cancelled...')
          await new Promise(res => setTimeout(res, 1_000))
        }
      }
      
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

function cancelCurrentWorkflow(client: InstanceType<typeof GitHub>) {
  return client.rest.actions.cancelWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId
  })
}
run()
