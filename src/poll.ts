import {wait} from './wait'
import {SharedOptions} from './options'
import type {Conclusion} from './utils'

export interface Poller<TOptions> {
  /*
  @returns: undefined if nothing has been found, null if something has been found but it doesn't meet the criteria.
            otherwise a string with the result
  */
  func: (options: TOptions) => Promise<Conclusion | undefined | null>
  onTimedOut: (options: TOptions, warmupDeadlined: boolean) => Conclusion
}

export async function poll<
  TOptions extends Pick<SharedOptions, 'timeoutSeconds' | 'intervalSeconds' | 'warmupSeconds'>
>(options: TOptions, poller: Poller<TOptions>): Promise<Conclusion> {
  const {timeoutSeconds, intervalSeconds, warmupSeconds} = options

  const start = new Date().getTime()
  const deadline = start + timeoutSeconds * 1000
  const warmupDeadline = start + warmupSeconds * 1000
  let now = start
  let previouslyFound = false

  while (now <= deadline) {
    const result = await poller.func(options)
    if (result !== undefined && result !== null) {
      return result
    }

    previouslyFound = previouslyFound || result === null
    if (!previouslyFound && now >= warmupDeadline) {
      return poller.onTimedOut(options, true)
    }

    await wait(intervalSeconds * 1000)
    now = new Date().getTime()
  }

  return poller.onTimedOut(options, false)
}
