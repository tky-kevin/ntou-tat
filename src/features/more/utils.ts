import type { MoreView } from '../../types'

export function moreViewTitle(view: MoreView) {
  if (view === 'portal') return '海大校務系統'
  if (view === 'settings') return '帳號與設定'
  if (view === 'emergency') return '緊急聯絡'
  if (view === 'campus') return '校園連結'
  if (view === 'traffic') return '交通與地圖'
  if (view === 'announcements') return '校務公告'
  return '重要日期'
}
