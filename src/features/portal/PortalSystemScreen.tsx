import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, KeyRound, ExternalLink, Plus, AlertCircle, Building2 } from 'lucide-react'
import type { PortalSystemNode } from '../../types'

import { useApi } from '../../core/api/hooks'
import { authStore } from '../../core/storage/authStorage'
import { credentialsStore } from '../../core/storage/credentialsStorage'
import { useNavigate } from 'react-router-dom'

const messageFromError = (error: unknown) =>
  error instanceof Error ? error.message : '發生未知錯誤'

export function PortalSystemScreen() {
  const api = useApi()
  const navigate = useNavigate()
  
  const loadMenu = (path: string[]) => api.getPortalSystemMenu?.(path) ?? Promise.reject(new Error('Not supported'))
  const onOpenPage = (path: string[]) => api.openPortalSystemPage?.(path) ?? Promise.reject(new Error('Not supported'))
  
  const onReauthenticate = async () => {
    await authStore.clearSession()
    await credentialsStore.clearCredentials()
    navigate('/login', { replace: true })
  }
  const [path, setPath] = useState<string[]>([])
  const [nodes, setNodes] = useState<PortalSystemNode[]>([])
  const [loading, setLoading] = useState(true)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const cache = useRef(new Map<string, PortalSystemNode[]>())

  useEffect(() => {
    let active = true
    const key = path.join('>')
    const cached = cache.current.get(key)
    if (cached) {
      setNodes(cached)
      setError(null)
      setLoading(false)
      return () => {
        active = false
      }
    }

    if (!loadMenu) {
      setNodes([])
      setError('目前資料模式不支援海大校務系統')
      setLoading(false)
      return () => {
        active = false
      }
    }

    setLoading(true)
    setError(null)
    void loadMenu(path)
      .then((nextNodes) => {
        if (!active) return
        cache.current.set(key, nextNodes)
        setNodes(nextNodes)
      })
      .catch((loadError) => {
        if (!active) return
        setNodes([])
        setError(messageFromError(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [loadMenu, path, retryKey])

  const openNode = async (node: PortalSystemNode) => {
    if (node.kind === 'group') {
      setPath(node.path)
      return
    }
    if (!onOpenPage) {
      setError('目前資料模式無法開啟海大校務功能')
      return
    }

    setOpeningId(node.id)
    setError(null)
    try {
      await onOpenPage(node.path)
    } catch (openError) {
      setError(messageFromError(openError))
    } finally {
      setOpeningId(null)
    }
  }
  const sessionExpired = Boolean(error && /登入.*(?:過期|失效)|工作階段.*失效/i.test(error))

  return (
    <section className="portal-system-screen">
      <div className="portal-system-path">
        {path.length ? (
          <button
            className="plain-icon"
            type="button"
            aria-label="返回上一層校務系統"
            onClick={() => setPath((current) => current.slice(0, -1))}
          >
            <ChevronLeft size={21} />
          </button>
        ) : (
          <Building2 size={22} aria-hidden="true" />
        )}
        <div>
          <strong>{path.at(-1) ?? '海洋大學教學務系統'}</strong>
          {path.length > 1 ? <span>{path.slice(0, -1).join(' / ')}</span> : null}
        </div>
      </div>

      {error ? (
        <div className="portal-system-error-wrap">
          <div className="portal-system-error">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button
              type="button"
              aria-label="重新載入校務系統"
              title="重新載入"
              onClick={() => setRetryKey((key) => key + 1)}
            >
              <RefreshCw size={18} />
            </button>
          </div>
          {sessionExpired ? (
            <button
              className="portal-reauth-button"
              type="button"
              onClick={() => void onReauthenticate()}
            >
              <KeyRound size={18} />
              <span>重新登入 AIS</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="inline-empty compact">
          <div className="spinner small" aria-label="讀取校務系統" />
        </div>
      ) : nodes.length ? (
        <div className="portal-system-list">
          {nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              disabled={openingId === node.id}
              onClick={() => void openNode(node)}
            >
              <span className={`portal-node-icon ${node.kind}`}>
                {node.kind === 'group' ? <Plus size={16} /> : <ExternalLink size={15} />}
              </span>
              <span>{node.title}</span>
              {openingId === node.id ? (
                <RefreshCw className="spin" size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
          ))}
        </div>
      ) : !error ? (
        <div className="inline-empty compact">
          <span>此分類沒有可用功能</span>
        </div>
      ) : null}
    </section>
  )
}
