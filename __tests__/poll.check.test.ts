import {pollCheckrun as poll} from '../src/poll.check'

const client = {
  rest: {
    checks: {
      listForRef: jest.fn(),
    },
  },
}

const run = ({any, checkName}: {any: boolean; checkName?: string} = {any: true}) =>
  poll({
    client: client as any,
    log: () => {},
    warn: () => {},
    checkName: checkName ?? 'test',
    owner: 'testOrg',
    repo: 'testRepo',
    ref: 'abcd',
    timeoutSeconds: 3,
    intervalSeconds: 0.1,
    warmupSeconds: 1,
    successConclusions: ['success', 'skipped', 'not_found', ...(any ? ['any'] : [])],
  })

test('returns conclusion of last (completed) check', async () => {
  client.rest.checks.listForRef.mockResolvedValue({
    data: {
      check_runs: [
        {
          id: '1',
          status: 'pending',
          started_at: '2018-05-04T01:14:52Z',
        },
        {
          id: '2',
          status: 'completed',
          conclusion: 'success',
          started_at: '2018-05-04T01:14:53Z',
        },
      ],
    },
  })

  const result = await run()

  expect(result).toBe('success')
  expect(client.rest.checks.listForRef).toHaveBeenCalledWith({
    owner: 'testOrg',
    repo: 'testRepo',
    ref: 'abcd',
    check_name: 'test',
  })
})

test('polls until check is completed', async () => {
  client.rest.checks.listForRef
    .mockResolvedValueOnce({
      data: {
        check_runs: [
          {
            id: '1',
            status: 'pending',
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      data: {
        check_runs: [
          {
            id: '1',
            status: 'pending',
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      data: {
        check_runs: [
          {
            id: '1',
            status: 'completed',
            conclusion: 'failure',
          },
        ],
      },
    })

  const result = await run()

  expect(result).toBe('failure')
  expect(client.rest.checks.listForRef).toHaveBeenCalledTimes(3)
})

test(`returns 'timed_out' if exceeding deadline`, async () => {
  client.rest.checks.listForRef.mockResolvedValue({
    data: {
      check_runs: [
        {
          id: '1',
          status: 'pending',
        },
      ],
    },
  })

  const result = await run()
  expect(result).toBe('timed_out')
})

test(`returns 'not_found' if check not found in warmup`, async () => {
  client.rest.checks.listForRef.mockResolvedValue({
    data: {
      check_runs: [],
    },
  })

  const result = await run()
  expect(result).toBe('not_found')
})

test('polls until all checks are completed', async () => {
  client.rest.checks.listForRef
    .mockResolvedValueOnce({
      data: {
        check_runs: [
          {
            id: '1',
            status: 'completed',
            conclusion: 'failure',
            started_at: '2018-05-04T01:14:52Z',
          },
          {
            id: '2',
            status: 'pending',
            started_at: '2018-05-04T01:14:53Z',
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      data: {
        check_runs: [
          {
            id: '1',
            status: 'completed',
            conclusion: 'failure',
            started_at: '2018-05-04T01:14:52Z',
          },
          {
            id: '2',
            status: 'pending',
            started_at: '2018-05-04T01:14:53Z',
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      data: {
        check_runs: [
          {
            id: '1',
            status: 'completed',
            conclusion: 'failure',
            started_at: '2018-05-04T01:14:52Z',
          },
          {
            id: '2',
            status: 'completed',
            conclusion: 'success',
            started_at: '2018-05-04T01:14:53Z',
          },
        ],
      },
    })

  const result = await run()

  expect(result).toBe('success')
})

test('reflects the status of the last started run', async () => {
  client.rest.checks.listForRef.mockResolvedValueOnce({
    data: {
      check_runs: [
        {
          id: '1',
          status: 'completed',
          conclusion: 'failure',
          started_at: '2018-01-01T00:00:01Z',
        },
        {
          id: '2',
          status: 'completed',
          conclusion: 'success',
          started_at: '2018-01-01T00:00:00Z',
        },
      ],
    },
  })

  const result = await run()

  expect(result).toBe('failure')
})

test('can handle multiple check names (with anyOf)', async () => {
  client.rest.checks.listForRef
    .mockResolvedValueOnce({
      // t = 0, checkrun = 0
      data: {
        check_runs: [
          {
            id: '1',
            status: 'in_progress',
            started_at: '2018-01-01T00:00:01Z',
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      // t = 0, checkrun = 1
      data: {
        check_runs: [
          {
            id: '2',
            status: 'in_progress',
            started_at: '2018-01-01T00:00:01Z',
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      // t = 1, checkrun = 0
      data: {
        check_runs: [
          {
            id: '1',
            status: 'in_progress',
            started_at: '2018-01-01T00:00:01Z',
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      // t = 1, checkrun = 1
      data: {
        check_runs: [
          {
            id: '2',
            status: 'completed',
            conclusion: 'failure',
            started_at: '2018-01-01T00:00:01Z',
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      // t = 2, checkrun = 0
      data: {
        check_runs: [
          {
            id: '2',
            status: 'completed',
            conclusion: 'failure',
            started_at: '2018-01-01T00:00:01Z',
          },
        ],
      },
    })

  const result = await run({any: true, checkName: 'test1\ntest2'})

  expect(result).toBe('failure')
})

// skipped because it's not implemented yet
test.skip('awaiting multiple checks (not anyOf) of which one succeeded and one is pending does not result in succeeded', async () => {
  client.rest.checks.listForRef
    .mockResolvedValueOnce({
      // t = 0, checkrun = 0
      data: {
        check_runs: [
          {
            id: '1',
            status: 'completed',
            conclusion: 'success',
            started_at: '2018-01-01T00:00:01Z',
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      // t = 0, checkrun = 1
      data: {
        check_runs: [
          {
            id: '2',
            status: 'in_progress',
            started_at: '2018-01-01T00:00:01Z',
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      // t = 1, checkrun = 0
      data: {
        check_runs: [
          {
            id: '2',
            status: 'completed',
            conclusion: 'failure',
            started_at: '2018-01-01T00:00:01Z',
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      // t = 1, checkrun = 1
      data: {
        check_runs: [
          {
            id: '2',
            status: 'in_progress',
            started_at: '2018-01-01T00:00:01Z',
          },
        ],
      },
    })

  const result = await run({any: false, checkName: 'test1\ntest2'})

  expect(result).toBe('failure')
})
