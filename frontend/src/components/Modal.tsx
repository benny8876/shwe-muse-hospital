import type { ReactNode } from 'react'

type Props = {
  title?: string
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}

export default function Modal({ title, onClose, children, maxWidth = 'max-w-md' }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`card ${maxWidth} w-full space-y-3`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 -mx-4 -mt-4 px-4 pt-4 mb-1">
            <h2 className="font-semibold text-slate-800">{title}</h2>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer text-lg leading-none">×</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
