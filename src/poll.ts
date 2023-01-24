import {wait} from './wait'
import {SharedOptions} from './options'

export interface Poller<TOptions> {
  func: (options: TOptions, start: number, now: number) => Promise<string | undefined>
  onTimedout: (options: TOptions) => string
}

export async function poll<TOptions extends Pick<SharedOptions, 'timeoutSeconds' | 'intervalSeconds'>>(
  options: TOptions,
  poller: Poller<TOptions>
): Promise<string> {
  const {timeoutSeconds, intervalSeconds} = options

  const start = new Date().getTime()
  const deadline = start + timeoutSeconds * 1000
  let now = start

  while (now <= deadline) {
    const result = await poller.func(options, start, now)
    if (result !== undefined) {
      return result
    }

    await wait(intervalSeconds * 1000)

    now = new Date().getTime()
  }

  return poller.onTimedout(options)
}
