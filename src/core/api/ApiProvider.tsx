import { useMemo, type ReactNode } from 'react'
import { createNtouApi } from './index'
import { ApiContext } from './hooks'
import { authStore } from '../storage/authStorage'

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
      onUnauthorized()
    })
  }, [onUnauthorized])

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
}
