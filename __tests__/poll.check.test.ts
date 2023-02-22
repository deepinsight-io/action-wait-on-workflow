import {pollCheckrun as poll} from '../src/poll.check'

const client = {
  rest: {
    checks: {
      listForRef: jest.fn(),
    },
  },
}

const run = () =>
  poll({
    client: client as any,
    log: () => {},
    warn: () => {},
    checkName: 'test',
    owner: 'testOrg',
    repo: 'testRepo',
    ref: 'abcd',
    timeoutSeconds: 3,
    intervalSeconds: 0.1,
    warmupSeconds: 1,
    successConclusions: ['success', 'skipped', 'not_found'],
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
  expect(client.rest.checks.listForRef).toHaveBeenCalledTimes(3)
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
