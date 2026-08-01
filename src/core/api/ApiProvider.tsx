import { useMemo, type ReactNode } from 'react'
import { createNtouApi } from './index'
import { ApiContext } from './hooks'
import { authStore } from '../storage/authStorage'
import { clearPortalCookies } from './portalHttp'

export function ApiProvider({
  children,
  onUnauthorized,
}: {
  children: ReactNode
  onUnauthorized: () => void
}) {
  const api = useMemo(() => {
    return createNtouApi(async () => {
      await authStore.clearSession()
      clearPortalCookies()
      onUnauthorized()
    })
  }, [onUnauthorized])

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
}
