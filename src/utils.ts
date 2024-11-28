import * as actionsCore from '@actions/core'

// I'm not 100% sure of the exhaustiveness of this lists as I can't find the spec, but for check-runs this is copied from the spec
export type GHStatus = 'queued' | 'in_progress' | 'completed'
export type GHConclusion = 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required'
export type Conclusion = GHConclusion | 'not_found'

export function isConclusion(s: string | null, warn: (message: string) => void): s is Conclusion | null {
  switch (s) {
    case null:
    case 'success':
    case 'failure':
    case 'neutral':
    case 'cancelled':
    case 'skipped':
    case 'timed_out':
    case 'action_required':
    case 'not_found':
      return true
    default:
      warn(
        `Conclusion '${s}' was not in the api spec list: [success, failure, neutral, cancelled, skipped, timed_out, action_required] + [not_found]`,
      )
      return false
  }
}
export function asConclusion(s: string | null, warn: (message: string) => void): Conclusion | null {
  if (isConclusion(s, warn)) {
    return s
  } else {
    return s as Conclusion // we could error, but a warning is given and suffices
  }
}
export function summarizeConclusions(conclusions: Conclusion[]): Conclusion {
  const inOrderOfPriority: Conclusion[] = [
    'timed_out',
    'cancelled',
    'failure',
    'action_required',
    'skipped',
    'neutral',
    'not_found',
    'success',
  ]
  for (const priority of inOrderOfPriority) {
    if (conclusions.includes(priority)) return priority
  }
  return 'success'
}
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
  let any = false
  successConclusions = successConclusions.trim()
  if (successConclusions.startsWith('anyOf(')) {
    if (!successConclusions.endsWith(')')) {
      core.setFailed("Invalid 'successConclusions'. If starting with 'anyOf(' it must end on a ')'")
      return undefined
    }
    any = true
    core.debug('Trimming "anyOf(" and ")"')
    successConclusions = successConclusions.substring('anyOf('.length, successConclusions.length - 1 - ')'.length)
    core.debug(`successConclusions=${successConclusions}`)
  }
  const regex =
    /^(success|failure|neutral|cancelled|skipped|timed_out|action_required|not_found)(\|(success|failure|neutral|cancelled|skipped|timed_out|action_required|not_found))*$/
  if (!regex.test(successConclusions)) {
    core.setFailed(
      "Invalid 'successConclusions'. It must be a pipe-separated non-empty subset of the options 'success|failure|neutral|cancelled|skipped|timed_out|action_required|not_found'",
    )
    return undefined
  }
  const result = successConclusions.split('|')
  if (any) {
    core.debug('Pushing "any"')
    result.push('any')
  }
  core.debug(`successConclusions.split('|'): ${JSON.stringify(result)}`)
  return result
}

export function stringToList(list: string, inputName: 'workflowName' | 'checkName'): string[] {
  // parses a newline-separated list, or a comma-separated list between block parentheses

  const trimmed = list.trim()
  let entries: string[]
  if (trimmed.startsWith('[')) {
    if (!trimmed.endsWith(']')) {
      throw new Error(`Invalid list format for '${inputName}'`)
    }

    const withoutBlockParens = trimmed.substring(1, trimmed.length - 2)
    entries = withoutBlockParens.split(',')
  } else {
    entries = trimmed.split('\n')
  }
  const result = entries.map(entry => entry.trim()).filter(entry => entry !== '')
  return result
}
