import { useState, useEffect } from 'react'

interface UseLocalStorageOptions<T> {
  deserializer?: (value: string) => T
  serializer?: (value: T) => string
}

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options: UseLocalStorageOptions<T> = {}
): [T, (value: T) => void] {
  const {
    deserializer = JSON.parse,
    serializer = JSON.stringify,
  } = options

  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? deserializer(item) : defaultValue
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, serializer(value))
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, value, serializer])

  return [value, setValue]
}