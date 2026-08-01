import { useState, useRef } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Bell, CalendarDays, ChevronRight, LogOut, Phone, Building2, Link as LinkIcon, Bus, ShieldCheck, Camera } from 'lucide-react'
import type { MoreView } from '../../types'
import { cropAvatarFile } from '../../avatar'
import { PortalSystemScreen } from '../portal/PortalSystemScreen'
import { LinkList } from '../../components/LinkList'
import { emergencyContacts } from '../../core/api/publicData'
import { apiMode } from '../../core/api'
import { useStudentProfile, useAppData } from '../../core/api/hooks'
import { useLocalDataStore } from '../../core/store/useLocalDataStore'
import { useAppStore } from '../../core/store/useAppStore'
import { authStore } from '../../core/storage/authStorage'
import { credentialsStore } from '../../core/storage/credentialsStorage'

const messageFromError = (error: unknown) =>
  error instanceof Error ? error.message : '發生未知錯誤'

export function MoreScreen() {
  return (
    <Routes>
      <Route path="/" element={<MoreRoot />} />
      <Route path=":view" element={<MoreSubviewWrapper />} />
    </Routes>
  )
}

function MoreRoot() {
  const navigate = useNavigate()
  const { data: profile } = useStudentProfile()
  
  const avatarUrl = useLocalDataStore(s => s.avatarUrl)
  const setAvatarUrl = useLocalDataStore(s => s.setAvatarUrl)
  const setPinLocked = useAppStore(s => s.setIsPinLocked)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)

  const changeAvatar = async (file?: File) => {
    if (!file) return
    setAvatarBusy(true)
    try {
      const url = await cropAvatarFile(file)
      setAvatarUrl(url)
    } catch (error) {
      alert(messageFromError(error))
    } finally {
      setAvatarBusy(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handleLogout = async () => {
    if (!confirm('確定要登出嗎？')) return
    await authStore.clearSession()
    await credentialsStore.clearCredentials()
    setPinLocked(false)
    navigate('/login', { replace: true })
  }

  const tools: Array<{ icon: typeof Bell; label: string; view: MoreView }> = [
    { icon: Building2, label: '海大校務系統', view: 'portal' },
    { icon: Bell, label: '校務公告', view: 'announcements' },
    { icon: CalendarDays, label: '重要日期', view: 'calendar' },
    { icon: LinkIcon, label: '海大連結', view: 'campus' },
    { icon: Bus, label: '交通與地圖', view: 'traffic' },
    { icon: Phone, label: '緊急聯絡', view: 'emergency' },
    { icon: ShieldCheck, label: '帳號與設定', view: 'settings' },
  ]

  if (!profile) return null

  return (
    <section className="more-screen">
      <div className="profile-block">
        <button
          className="avatar-picker"
          type="button"
          aria-label="更換頭像"
          title="更換頭像"
          disabled={avatarBusy}
          onClick={() => avatarInputRef.current?.click()}
        >
          <span className="student-avatar large">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : profile.avatarInitials}
          </span>
          <span className="avatar-picker-badge" aria-hidden="true">
            <Camera size={12} />
          </span>
        </button>
        <input
          ref={avatarInputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          tabIndex={-1}
          onChange={(event) => void changeAvatar(event.target.files?.[0])}
        />
        <div>
          <strong>{profile.name === profile.id ? '海大學生' : profile.name}</strong>
          <span>{profile.id}</span>
        </div>
      </div>
      <div className="tool-list">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <button key={tool.view} type="button" onClick={() => navigate(`/app/more/${tool.view}`)}>
              <Icon size={22} />
              <span>{tool.label}</span>
              <ChevronRight size={19} />
            </button>
          )
        })}
      </div>
      <button className="direct-logout" type="button" onClick={handleLogout}>
        <LogOut size={22} />
        <span>登出海大 AIS</span>
        <ChevronRight size={19} />
      </button>
    </section>
  )
}

function MoreSubviewWrapper() {
  const location = useLocation()
  const view = location.pathname.split('/').pop() as MoreView
  const { data: appData } = useAppData()
  const navigate = useNavigate()
  const setPinLocked = useAppStore(s => s.setIsPinLocked)

  const handleLogout = async () => {
    if (!confirm('確定要登出嗎？')) return
    await authStore.clearSession()
    await credentialsStore.clearCredentials()
    setPinLocked(false)
    navigate('/login', { replace: true })
  }

  // TODO: Add full Pin control later via the new showPinSetup flow
  const hasPin = credentialsStore.hasPin()
  const onEnablePin = () => alert('Please implement PIN Setup via useAppStore.setShowPinSetup(true)')
  const onDisablePin = () => alert('Please implement PIN disable')

  if (!appData) return null

  if (view === 'portal') {
    return (
      <PortalSystemScreen />
    )
  }

  if (view === 'settings') {
    return (
      <section className="subview">
        <div className="settings-row">
          <span>資料來源</span>
          <strong>{apiMode === 'portal' ? '海大 AIS 直連' : apiMode}</strong>
        </div>
        <div className="settings-row">
          <span>Cookie</span>
          <strong>僅存在本機</strong>
        </div>
        <div className="settings-row">
          <span>PIN 碼保護</span>
          <button 
            className="secondary-button" 
            onClick={hasPin ? onDisablePin : onEnablePin}
            style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px', background: 'var(--brand)', color: 'white', fontWeight: 'bold' }}
          >
            {hasPin ? '停用' : '啟用'}
          </button>
        </div>
        <button className="logout-button" type="button" onClick={handleLogout}>
          <LogOut size={19} />
          登出
        </button>
      </section>
    )
  }

  if (view === 'emergency') {
    return (
      <LinkList
        items={emergencyContacts.map((contact) => ({
          id: contact.id,
          title: contact.title,
          subtitle: contact.subtitle,
          url: `tel:${contact.phone}`,
        }))}
      />
    )
  }

  if (view === 'campus') return <LinkList items={appData.campusLinks} />
  if (view === 'traffic') return <LinkList items={appData.traffic} />

  if (view === 'announcements') {
    return appData.announcements.length ? (
      <LinkList items={appData.announcements.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: `${item.source} · ${item.publishedAt}`,
        url: item.url,
      }))} />
    ) : (
      <div className="inline-empty"><Bell size={24} /><span>尚未取得 AIS 公告</span></div>
    )
  }

  if (view === 'calendar') {
    return appData.calendar.length ? (
      <div className="event-list">
        {appData.calendar.map((event) => (
          <div className="event-row" key={event.id}>
            <CalendarDays size={20} />
            <div><strong>{event.title}</strong><span>{event.startsOn}</span></div>
          </div>
        ))}
      </div>
    ) : (
      <div className="inline-empty"><CalendarDays size={24} /><span>尚未取得海大官方行事曆</span></div>
    )
  }

  return null
}
