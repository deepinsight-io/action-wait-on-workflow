import * as actionsCore from '@actions/core'

export function maxBy<T>(array: T[], selector: (element: T) => number): T {
  if (array.length === 0) {
    throw new Error('Array empty')
  }

  let maxElement = array[0]
  let maxValue = selector(maxElement)
  for (const element of array) {
    const value = selector(element)
    if (value > maxValue) {
      maxValue = value
      maxElement = element
    }
  }
  return maxElement
}

export function parseSuccessConclusions(successConclusions: string, core: typeof actionsCore): string[] | undefined {
  const regex =
    /^(success|failure|neutral|cancelled|skipped|timed_out|action_required|not_found)(\|(success|failure|neutral|cancelled|skipped|timed_out|action_required|not_found))*$/
  if (!regex.test(successConclusions)) {
    core.setFailed(
      "Invalid 'successConclusions'. It must be a pipe-separated non-empty subset of the options 'success|failure|neutral|cancelled|skipped|timed_out|action_required|not_found'"
    )
    return undefined
  }
  const result = successConclusions.split('|')
  core.debug(`successConclusions.split('|'): ${JSON.stringify(result)}`)
  return result
}
