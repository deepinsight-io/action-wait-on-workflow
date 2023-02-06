import {parseSuccessConclusions} from '../src/utils'

test(`parseSuccessConclusions`, async () => {
  const successConclusions = parseSuccessConclusions('success|skipped', {debug: jest.fn()} as any)

  const result = successConclusions?.includes('success')

  expect(result).toBe(true)
})
