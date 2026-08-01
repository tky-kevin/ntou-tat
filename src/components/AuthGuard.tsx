import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authStore } from '../core/storage/authStorage'
import { credentialsStore } from '../core/storage/credentialsStorage'
import { LoadingScreen } from './LoadingScreen'
import { PinUnlockScreen } from '../features/pin/PinUnlockScreen'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  
  const [isBooting, setIsBooting] = useState(true)
  const [isPinLocked, setIsPinLocked] = useState(false)

  useEffect(() => {
    async function boot() {
      // 1. Check if PIN locked
      if (credentialsStore.hasPin()) {
        setIsPinLocked(true)
      }

      // 2. Check if logged in
      const session = await authStore.getSession()
      if (!session) {
        if (location.pathname !== '/login') {
          navigate('/login', { replace: true })
        }
      } else {
        if (location.pathname === '/' || location.pathname === '/login') {
          navigate('/app/timetable', { replace: true })
        }
      }
      setIsBooting(false)
    }
    boot()
  }, [navigate, location.pathname])

  if (isBooting) {
    return <LoadingScreen />
  }

  if (isPinLocked && location.pathname !== '/login') {
    return (
      <PinUnlockScreen
        onUnlocked={() => setIsPinLocked(false)}
        onForgotPin={() => {
          setIsPinLocked(false)
          navigate('/login')
        }}
      />
    )
  }

  return <>{children}</>
}
