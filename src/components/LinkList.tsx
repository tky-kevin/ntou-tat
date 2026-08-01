import React from 'react'
import { ExternalLink } from 'lucide-react'

export function LinkList({
  items,
}: {
  items: Array<{ id: string; title: string; subtitle: string; url: string }>
}) {
  return (
    <div className="link-list">
      {items.map((item) => (
        <a href={item.url} key={item.id} rel="noreferrer" target="_blank">
          <div>
            <strong>{item.title}</strong>
            <span>{item.subtitle}</span>
          </div>
          <ExternalLink size={18} />
        </a>
      ))}
    </div>
  )
}
