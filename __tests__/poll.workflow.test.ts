import {pollWorkflowrun as poll} from '../src/poll.workflow'
import type {components} from '@octokit/openapi-types'
import {WorkflowOptions} from '../src/options'
import {GHConclusion, GHStatus} from '../src/utils'
type WorkflowRun = components['schemas']['workflow-run'] & {
  status: null | GHStatus
  conclusion: null | GHConclusion
}

const client = {
  request: jest.fn(),
}

function run({workflowName}: {workflowName: WorkflowOptions['workflowName']} = {workflowName: 'workflow_name'}) {
  return poll({
    client: client as any,
    log: () => {},
    warn: () => {},
    workflowName,
    owner: 'testOrg',
    repo: 'testRepo',
    ref: 'abcd',
    timeoutSeconds: 3,
    intervalSeconds: 0.1,
    warmupSeconds: 1,
  })
}

function prepare_invariant_workflow(workflowRuns: WorkflowRun[]) {
  client.request.mockImplementation((...args) => {
    if (args[0] === 'GET /repos/{owner}/{repo}/actions/runs') {
      return {
        data: {
          workflow_runs: workflowRuns,
        },
      }
    }
    throw new Error(`Unmocked call ${args.length === 0 ? '<>' : args[0]}`)
  })
}
function prepare_progressing_workflow(workflowRuns: WorkflowRun[][] | WorkflowRun[]) {
  if (!isNestedArrays(workflowRuns)) {
    // for each next call, add one extra provided workflow run
    workflowRuns = Array(workflowRuns.length).fill(workflowRuns) as WorkflowRun[][]
    workflowRuns = workflowRuns.map((runs, index, _) => runs.slice(0, index + 1))
  }

  let callNumber = 0
  client.request.mockImplementation((...args) => {
    if (args[0] === 'GET /repos/{owner}/{repo}/actions/runs') {
      if (callNumber < workflowRuns.length - 1) {
        callNumber++
      }
      return {
        data: {
          workflow_runs: workflowRuns[callNumber],
        },
      }
    }
    throw new Error(`Unmocked call ${args.length === 0 ? '<>' : args[0]}`)
  })
  function isNestedArrays(workflowRuns: WorkflowRun[][] | WorkflowRun[]): workflowRuns is WorkflowRun[][] {
    if (workflowRuns.length === 0) throw new Error('workflowRuns.length === 0')
    return Array.isArray(workflowRuns[0])
  }
}

function prepare_fixture_without_workflows() {
  prepare_invariant_workflow([])
}
function prepare_fixture_workflow_already_completed() {
  prepare_invariant_workflow([
    {
      id: 10,
      name: 'workflow_name',
      run_attempt: 1,
      status: 'completed',
      conclusion: 'success',
    },
  ] as WorkflowRun[])
}
function prepare_fixture_with_wrongly_named_workflow() {
  prepare_invariant_workflow([
    {
      id: 10,
      name: 'wrong_workflow_name',
      run_attempt: 1,
      status: 'completed',
      conclusion: 'success',
    },
  ] as WorkflowRun[])
}
function prepare_fixture_workflow_already_failed() {
  prepare_invariant_workflow([
    {
      id: 10,
      name: 'workflow_name',
      run_attempt: 1,
      status: 'completed',
      conclusion: 'failure',
    },
  ] as WorkflowRun[])
}
function prepare_fixture_workflow_in_progress() {
  prepare_invariant_workflow([
    {
      id: 10,
      name: 'workflow_name',
      run_attempt: 1,
      status: 'in_progress',
      conclusion: null,
    },
  ] as WorkflowRun[])
}
function prepare_fixture_workflow_with_first_attempt_failure_and_second_success() {
  prepare_invariant_workflow([
    {
      id: 10,
      name: 'workflow_name',
      run_attempt: 1,
      status: 'completed',
      conclusion: 'failure',
    },
    {
      id: 10,
      name: 'workflow_name',
      run_attempt: 2,
      status: 'completed',
      conclusion: 'success',
    },
  ] as WorkflowRun[])
}

function prepare_fixture_workflow_with_first_attempt_success_and_second_failed() {
  prepare_invariant_workflow([
    {
      id: 10,
      name: 'workflow_name',
      run_attempt: 1,
      status: 'completed',
      conclusion: 'success',
    },
    {
      id: 10,
      name: 'workflow_name',
      run_attempt: 2,
      status: 'completed',
      conclusion: 'failure',
    },
  ] as WorkflowRun[])
}

function prepare_fixture_workflow_with_first_attempt_already_completed_and_second_still_ongoing() {
  prepare_invariant_workflow([
    {
      id: 10,
      name: 'workflow_name',
      run_attempt: 1,
      status: 'completed',
      conclusion: 'success',
    },
    {
      id: 10,
      name: 'workflow_name',
      run_attempt: 2,
      status: 'in_progress',
      conclusion: null,
    },
  ] as WorkflowRun[])
}
function prepare_fixture_workflow_with_many_in_progress_attempts() {
  const in_progresses: WorkflowRun[] = []
  for (let index = 0; index < 20; index++) {
    in_progresses.push({
      id: 10,
      name: 'workflow_name',
      run_attempt: index,
      status: 'in_progress',
      conclusion: null,
    } as WorkflowRun)
  }
  prepare_progressing_workflow(in_progresses)
}
function prepare_fixture_workflow_with_many_in_progress_attempts_and_one_success() {
  const in_progresses: WorkflowRun[] = []
  for (let index = 0; index < 5; index++) {
    // 5 otherwise we hit the warmup threshold
    in_progresses.push({
      id: 10,
      name: 'workflow_name',
      run_attempt: index,
      status: 'in_progress',
      conclusion: null,
    } as WorkflowRun)
  }
  in_progresses.push({
    id: 10,
    name: 'workflow_name',
    run_attempt: 5 + 1,
    status: 'completed',
    conclusion: 'success',
  } as WorkflowRun)
  prepare_progressing_workflow(in_progresses)
}

test('returns conclusion of only completed workflow', async () => {
  prepare_fixture_workflow_already_completed()

  const result = await run()

  expect(result).toBe('success')
})

test('returns conclusion of last completed workflow', async () => {
  prepare_fixture_workflow_with_first_attempt_failure_and_second_success()

  const result = await run()

  expect(result).toBe('success')
})

test('returns conclusion of last completed workflow, even if failure', async () => {
  prepare_fixture_workflow_with_first_attempt_already_completed_and_second_still_ongoing()

  const result = await run()

  expect(result).toBe('timed_out')
})

test('polls until workflow completed', async () => {
  prepare_fixture_workflow_with_many_in_progress_attempts_and_one_success()

  const result = await run()

  expect(result).toBe('success')
})

test(`returns 'timed_out' if exceeding deadline`, async () => {
  prepare_fixture_workflow_with_many_in_progress_attempts()
  const result = await run()

  expect(result).toBe('timed_out')
})

test(`returns 'not_found' if only workflows with other names exist`, async () => {
  prepare_fixture_with_wrongly_named_workflow()

  const result = await run()
  expect(result).toBe('not_found')
})

test(`returns 'not_found' if not found in warmup`, async () => {
  prepare_fixture_without_workflows()

  const result = await run()
  expect(result).toBe('not_found')
})
