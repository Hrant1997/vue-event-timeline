// utils/fleetDate.ts

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { useLocalStorage } from '@vueuse/core'

dayjs.extend(utc)
dayjs.extend(timezone)


const timezoneName = useLocalStorage('tz', 'Asia/Yerevan')

export function setFleetTimezone(timezone: string) {
  timezoneName.value = timezone
}


export function fleetDate(
  value?: string | number | Date | null
) {  
  if (value == null) {
    return dayjs().tz(timezoneName.value)
  }

  return dayjs(value).tz(timezoneName.value)
}


export const fleetToPickerDate = (value: dayjs.Dayjs | null | undefined): Date | null => {
  if (!value) {
    return null
  }

  return new Date(
    value.year(),
    value.month(),
    value.date(),
    value.hour(),
    value.minute(),
    value.second(),
    value.millisecond()
  )
}

export const pickerToFleetDate = (value: Date | null | undefined): dayjs.Dayjs | null => {
  if (!value) {
    return null
  }

  if (value instanceof dayjs) { 
    value = (value as unknown as dayjs.Dayjs).toDate()
  }
  

  const dateString =
    `${value.getFullYear()}-` +
    `${String(value.getMonth() + 1).padStart(2, '0')}-` +
    `${String(value.getDate()).padStart(2, '0')} ` +
    `${String(value.getHours()).padStart(2, '0')}:` +
    `${String(value.getMinutes()).padStart(2, '0')}:` +
    `${String(value.getSeconds()).padStart(2, '0')}`

  return dayjs.tz(
    dateString,
    'YYYY-MM-DD HH:mm:ss',
    timezoneName.value
  )
}