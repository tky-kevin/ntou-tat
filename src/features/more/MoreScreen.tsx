import React, { useState, useRef } from 'react'
import { Bell, CalendarDays, ChevronRight, LogOut, Phone, Building2, Link as LinkIcon, Bus, ShieldCheck, Camera } from 'lucide-react'
import type { AppData, MoreView, PortalSystemNode } from '../../types'
import { cropAvatarFile } from '../../avatar'
import { PortalSystemScreen } from '../portal/PortalSystemScreen'
import { LinkList } from '../../components/LinkList'
import { emergencyContacts } from '../../core/api/publicData'
import { apiMode } from '../../core/api'

const messageFromError = (error: unknown) =>
  error instanceof Error ? error.message : '發生未知錯誤'

export function MoreScreen({
  avatarUrl,
  data,
  onAvatarChange,
  onLogout,
  onOpen,
}: {
  avatarUrl: string
  data: AppData
  onAvatarChange: (dataUrl: string) => void
  onLogout: () => Promise<void>
  onOpen: (view: MoreView) => void
}) {
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)

  const changeAvatar = async (file?: File) => {
    if (!file) return
    setAvatarBusy(true)
    try {
      onAvatarChange(await cropAvatarFile(file))
    } catch (error) {
      alert(messageFromError(error))
    } finally {
      setAvatarBusy(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
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
            {avatarUrl ? <img src={avatarUrl} alt="" /> : data.profile.avatarInitials}
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
          <strong>{data.profile.name === data.profile.id ? '海大學生' : data.profile.name}</strong>
          <span>{data.profile.id}</span>
        </div>
      </div>
      <div className="tool-list">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <button key={tool.view} type="button" onClick={() => onOpen(tool.view)}>
              <Icon size={22} />
              <span>{tool.label}</span>
              <ChevronRight size={19} />
            </button>
          )
        })}
      </div>
      <button className="direct-logout" type="button" onClick={() => void onLogout()}>
        <LogOut size={22} />
        <span>登出海大 AIS</span>
        <ChevronRight size={19} />
      </button>
    </section>
  )
}

export function MoreSubview({
  data,
  loadPortalMenu,
  onLogout,
  onOpenPortalPage,
  onReauthenticate,
  onEnablePin,
  onDisablePin,
  hasPin,
  view,
}: {
  data: AppData
  loadPortalMenu?: (path: string[]) => Promise<PortalSystemNode[]>
  onLogout: () => Promise<void>
  onOpenPortalPage?: (path: string[]) => Promise<void>
  onReauthenticate: () => Promise<void>
  onEnablePin?: () => void
  onDisablePin?: () => void
  hasPin?: boolean
  view: MoreView
}) {
  if (view === 'portal') {
    return (
      <PortalSystemScreen
        loadMenu={loadPortalMenu}
        onOpenPage={onOpenPortalPage}
        onReauthenticate={onReauthenticate}
      />
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
        <button className="logout-button" type="button" onClick={() => void onLogout()}>
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

  if (view === 'campus') return <LinkList items={data.campusLinks} />
  if (view === 'traffic') return <LinkList items={data.traffic} />

  if (view === 'announcements') {
    return data.announcements.length ? (
      <LinkList items={data.announcements.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: `${item.source} · ${item.publishedAt}`,
        url: item.url,
      }))} />
    ) : (
      <div className="inline-empty"><Bell size={24} /><span>尚未取得 AIS 公告</span></div>
    )
  }

  return data.calendar.length ? (
    <div className="event-list">
      {data.calendar.map((event) => (
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
