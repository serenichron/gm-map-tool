import { useEffect, useRef, useState } from 'react'
import type { Room } from '../lib/rooms.ts'

/**
 * GM room switcher: shows the active room's name + code, and a dropdown to
 * switch, create (named), rename, or delete rooms. Each room is its own table
 * with its own code and its own saved map/fog/pins.
 */
export function RoomMenu({
  rooms,
  activeId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: {
  rooms: Room[]
  activeId: string | null
  onSwitch: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const toggle = () => {
    setOpen((o) => {
      const next = !o
      if (next && triggerRef.current) {
        const r = triggerRef.current.getBoundingClientRect()
        setPos({ left: Math.min(r.left, window.innerWidth - 296), top: r.bottom + 6 })
      }
      return next
    })
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open])

  const active = rooms.find((r) => r.id === activeId)

  const create = () => {
    const n = newName.trim()
    if (!n) return
    onCreate(n)
    setNewName('')
    setOpen(false)
  }
  const commitRename = () => {
    if (editingId && editName.trim()) onRename(editingId, editName.trim())
    setEditingId(null)
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        onClick={toggle}
        className="flex items-center gap-2 rounded-[9px] border border-line bg-panel-2 px-3 py-2 font-ui text-[13px] text-bone transition hover:border-[#6a5232] hover:bg-[#352818]"
        title="Switch or manage rooms"
      >
        <span className="max-w-[140px] truncate font-medium">{active?.name ?? 'Room'}</span>
        {active && <span className="font-bold tracking-[0.15em] text-gold">{active.join_code}</span>}
        <span className="text-bone-dim">▾</span>
      </button>

      {open && (
        <div
          style={{ position: 'fixed', left: pos.left, top: pos.top }}
          className="z-50 w-[280px] rounded-xl border border-line bg-gradient-to-b from-panel-2 to-panel p-2 shadow-2xl"
        >
          <div className="max-h-[50vh] overflow-y-auto">
            {rooms.map((r) => (
              <div
                key={r.id}
                className={`group mb-1 flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
                  r.id === activeId ? 'border-ochre bg-[#33260f]' : 'border-transparent hover:bg-[#2a2015]'
                }`}
              >
                {editingId === r.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={commitRename}
                    className="min-w-0 flex-1 rounded border border-line bg-[#0f0b06] px-2 py-1 font-ui text-[13px] text-bone outline-none focus:border-ochre"
                  />
                ) : (
                  <button onClick={() => onSwitch(r.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="min-w-0 flex-1 truncate font-ui text-[13px] font-medium text-bone">{r.name}</span>
                    <span className="font-ui text-[12px] font-bold tracking-[0.12em] text-gold">{r.join_code}</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingId(r.id)
                    setEditName(r.name)
                  }}
                  title="Rename"
                  className="text-bone-dim opacity-0 transition group-hover:opacity-100 hover:text-bone"
                >
                  ✎
                </button>
                <button
                  onClick={() => onDelete(r.id)}
                  title="Delete room"
                  className="text-bone-dim opacity-0 transition group-hover:opacity-100 hover:text-rust"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="mt-1 flex gap-1.5 border-t border-line pt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="New room name"
              className="min-w-0 flex-1 rounded-lg border border-line bg-[#0f0b06] px-2.5 py-1.5 font-ui text-[13px] text-bone outline-none focus:border-ochre"
            />
            <button
              onClick={create}
              className="rounded-lg border border-ochre bg-gradient-to-b from-[#3f2e1a] to-[#30230f] px-3 py-1.5 font-ui text-[13px] font-semibold text-gold"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
