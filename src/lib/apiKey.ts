const SESSION_KEY = 'claude_api_key'

export function getStoredApiKey(): string {
  return sessionStorage.getItem(SESSION_KEY) ?? ''
}

export function storeApiKey(key: string): void {
  if (key) {
    sessionStorage.setItem(SESSION_KEY, key)
  } else {
    sessionStorage.removeItem(SESSION_KEY)
  }
}
