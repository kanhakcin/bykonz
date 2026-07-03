const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')
const TOKEN_KEY = 'diario.token'

export async function loadMediaObjectUrl(mediaUrl: string): Promise<string> {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}/api/v1${mediaUrl}`, { headers })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  return URL.createObjectURL(await res.blob())
}
