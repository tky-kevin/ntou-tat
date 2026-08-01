import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './App.css'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { ApiProvider } from './core/api/ApiProvider'
import { AuthGuard } from './components/AuthGuard'
import { AppShell } from './components/AppShell'

// Screens
import { LoginScreen } from './features/auth/LoginScreen'
import { TimetableScreen } from './features/timetable/TimetableScreen'
import { CalendarScreen } from './features/calendar/CalendarScreen'
import { GradesScreen } from './features/grades/GradesScreen'
import { ClockScreen } from './features/clock/ClockScreen'
import { MoreScreen } from './features/more/MoreScreen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Extracting routing logic so we can use useNavigate inside ApiProvider
function AppRoutes() {
  const navigate = useNavigate()

  return (
    <ApiProvider onUnauthorized={() => navigate('/login', { replace: true })}>
      <AuthGuard>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          
          <Route path="/app" element={<AppShell />}>
            {/* The individual tabs */}
            <Route path="timetable" element={<TimetableScreen />} />
            <Route path="calendar" element={<CalendarScreen />} />
            <Route path="grades" element={<GradesScreen />} />
            <Route path="clock" element={<ClockScreen />} />
            
            {/* More subviews */}
            <Route path="more/*" element={<MoreScreen />} />
          </Route>
        </Routes>
      </AuthGuard>
    </ApiProvider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  )
}
