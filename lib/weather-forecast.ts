export function findClosestWeatherHour(times: string[], date: string, eventTime: string) {
  const requestedTime = eventTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!requestedTime) return -1

  const targetMinutes = Number(requestedTime[1]) * 60 + Number(requestedTime[2])
  let closestIndex = -1
  let closestDifference = Number.POSITIVE_INFINITY

  times.forEach((time, index) => {
    if (!time.startsWith(`${date}T`)) return
    const hourlyTime = time.slice(11, 16).match(/^([01]\d|2[0-3]):([0-5]\d)$/)
    if (!hourlyTime) return

    const forecastMinutes = Number(hourlyTime[1]) * 60 + Number(hourlyTime[2])
    const difference = Math.abs(forecastMinutes - targetMinutes)
    if (difference < closestDifference) {
      closestIndex = index
      closestDifference = difference
    }
  })

  return closestIndex
}
