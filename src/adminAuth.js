const CREDENTIALS_KEY = 'jubba_admin_credentials'
const SESSION_KEY = 'jubba_admin_session'

const DEFAULT_CREDENTIALS = {
  login: 'admin',
  password: 'jubba2026',
}

export function getAdminCredentials() {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY)
    if (!raw) return DEFAULT_CREDENTIALS
    const parsed = JSON.parse(raw)
    if (!parsed?.login || !parsed?.password) return DEFAULT_CREDENTIALS
    return parsed
  } catch {
    return DEFAULT_CREDENTIALS
  }
}

export function setAdminCredentials(nextCredentials) {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(nextCredentials))
}

export function setAdminSession(login) {
  localStorage.setItem(SESSION_KEY, login)
}

export function clearAdminSession() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('jubba_admin')
}

export function isAuthenticated() {
  const sessionLogin = localStorage.getItem(SESSION_KEY)
  if (!sessionLogin) return false
  const { login } = getAdminCredentials()
  return sessionLogin === login
}
