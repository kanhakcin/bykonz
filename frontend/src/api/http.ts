/**
 * Cliente HTTP da API real do painel (backend Express em /api/v1).
 * Ativado quando VITE_API_URL está definido — ver client.ts.
 */

import type { DiaryApi, DiaryDay, User } from './types'

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')
const TOKEN_KEY = 'diario.token'

let token: string | null = localStorage.getItem(TOKEN_KEY)

function setToken(value: string) {
  token = value
  localStorage.setItem(TOKEN_KEY, value)
}

export function clearToken() {
  token = null
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}/api/v1${path}`, { ...init, headers })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const httpApi: DiaryApi = {
  async login(email, password) {
    const data = await request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setToken(data.token)
    return data.user
  },

  getDiaryDay(dateISO) {
    return request<DiaryDay>(`/diary?date=${encodeURIComponent(dateISO)}`)
  },

  async resolveAlert(alertId) {
    await request(`/alerts/${alertId}/resolve`, { method: 'POST' })
  },

  async acknowledgeAlert(alertId) {
    await request(`/alerts/${alertId}/acknowledge`, { method: 'POST' })
  },

  async confirmMention(mentionId) {
    await request(`/mentions/${mentionId}/confirm`, { method: 'POST' })
  },

  async rejectMention(mentionId) {
    await request(`/mentions/${mentionId}/reject`, { method: 'POST' })
  },
}
