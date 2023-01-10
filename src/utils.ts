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
