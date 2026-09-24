import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

// A small WPS/LibreOffice-style toolbar over a contentEditable box — just the
// handful of formatting controls doctors actually reach for on a findings
// report (bold a key phrase, mark an impression, list out multiple lesions),
// not a full word processor. Uses the browser's own execCommand — deprecated,
// but still universally supported and more than enough for this scope.
export type RichTextEditorHandle = {
  insertHtml: (html: string) => void
}

type Props = {
  initialValue: string
  onChange: (html: string) => void
  placeholder?: string
  minHeightClass?: string
}

const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(
  ({ initialValue, onChange, placeholder, minHeightClass }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null)

    // Set the starting HTML exactly once on mount, not on every render.
    // dangerouslySetInnerHTML re-applies element.innerHTML whenever its
    // __html value changes between renders — and since onChange feeds
    // straight back into the parent's state (which becomes this component's
    // own `initialValue` prop on the next render), binding it reactively
    // would overwrite the live DOM on every keystroke, wiping out the
    // caret position each time. The component is uncontrolled after mount;
    // switching orders remounts it via the `key` prop instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
      if (editorRef.current) editorRef.current.innerHTML = initialValue
    }, [])

    // Clicking a toolbar button — even one that preventDefaults its
    // mousedown — can still silently collapse the editor's live Selection
    // back to the start of the content in this browser. Relying on the
    // browser to preserve the caret across that click isn't safe, so we
    // track the caret ourselves on every mouseup/keyup/input inside the
    // editor and explicitly restore it before any toolbar action runs.
    const savedRangeRef = useRef<Range | null>(null)

    function saveSelection() {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange()
      }
    }

    function restoreSelection() {
      const editor = editorRef.current
      if (!editor) return
      editor.focus()
      const sel = window.getSelection()
      if (!sel) return
      if (savedRangeRef.current) {
        sel.removeAllRanges()
        sel.addRange(savedRangeRef.current)
      } else if (sel.rangeCount === 0) {
        const range = document.createRange()
        range.selectNodeContents(editor)
        range.collapse(false)
        sel.addRange(range)
      }
    }

    function handleInput() {
      if (editorRef.current) onChange(editorRef.current.innerHTML)
      saveSelection()
    }

    function exec(command: string, value?: string) {
      restoreSelection()
      document.execCommand(command, false, value)
      handleInput()
    }

    // execCommand('bold'/'italic'/etc.) on a COLLAPSED selection (just a
    // blinking caret, no text picked) has a real quirk in this browser: it
    // silently resets the caret to the very start of the editable instead of
    // leaving it in place, so the next keystroke lands at the wrong spot.
    // Selecting actual text and toggling works fine — it's specifically the
    // "turn bold on, then keep typing" case that breaks. We sidestep it for
    // that case by inserting the wrapper element ourselves and placing the
    // caret inside it, without ever calling execCommand.
    function applyInlineWrap(makeEl: () => HTMLElement) {
      restoreSelection()
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      const el = makeEl()
      if (range.collapsed) {
        el.appendChild(document.createTextNode('​'))
        range.insertNode(el)
        const newRange = document.createRange()
        newRange.setStart(el.firstChild as Node, 1)
        newRange.collapse(true)
        sel.removeAllRanges()
        sel.addRange(newRange)
      } else {
        try {
          range.surroundContents(el)
        } catch {
          const contents = range.extractContents()
          el.appendChild(contents)
          range.insertNode(el)
        }
        const newRange = document.createRange()
        newRange.selectNodeContents(el)
        newRange.collapse(false)
        sel.removeAllRanges()
        sel.addRange(newRange)
      }
      handleInput()
    }

    useImperativeHandle(ref, () => ({
      insertHtml(html: string) {
        restoreSelection()
        document.execCommand('insertHTML', false, html)
        handleInput()
      },
    }))

    const btnClass = 'min-w-7 h-7 px-1.5 rounded border border-transparent text-sm text-slate-700 hover:bg-slate-200 hover:border-slate-300'

    return (
      <div className="border border-slate-300 rounded-lg overflow-hidden no-print">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-300 bg-slate-50 p-1">
          <button type="button" title="Bold" className={`${btnClass} font-bold`} onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineWrap(() => document.createElement('b'))}>B</button>
          <button type="button" title="Italic" className={`${btnClass} italic`} onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineWrap(() => document.createElement('i'))}>I</button>
          <button type="button" title="Underline" className={`${btnClass} underline`} onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineWrap(() => document.createElement('u'))}>U</button>
          <button type="button" title="Strikethrough" className={`${btnClass} line-through`} onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineWrap(() => document.createElement('s'))}>S</button>
          <span className="w-px self-stretch bg-slate-300 mx-0.5" />
          <button type="button" title="Bigger text" className={btnClass} onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineWrap(() => { const el = document.createElement('span'); el.style.fontSize = '1.3em'; return el })}>A+</button>
          <button type="button" title="Smaller text" className={btnClass} onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineWrap(() => { const el = document.createElement('span'); el.style.fontSize = '0.8em'; return el })}>A-</button>
          <button type="button" title="Clear formatting" className={btnClass} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('removeFormat')}>Clear</button>
          <span className="w-px self-stretch bg-slate-300 mx-0.5" />
          <input type="color" title="Text color" defaultValue="#000000" className="w-7 h-7 p-0.5 border border-slate-300 rounded cursor-pointer" onMouseDown={(e) => e.stopPropagation()} onChange={(e) => applyInlineWrap(() => { const el = document.createElement('span'); el.style.color = e.target.value; return el })} />
          <input type="color" title="Highlight color" defaultValue="#fff59d" className="w-7 h-7 p-0.5 border border-slate-300 rounded cursor-pointer" onMouseDown={(e) => e.stopPropagation()} onChange={(e) => applyInlineWrap(() => { const el = document.createElement('span'); el.style.backgroundColor = e.target.value; return el })} />
          <span className="w-px self-stretch bg-slate-300 mx-0.5" />
          <button type="button" title="Align left" className={btnClass} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyLeft')}>⯇≡</button>
          <button type="button" title="Align center" className={btnClass} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyCenter')}>≡</button>
          <button type="button" title="Align right" className={btnClass} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyRight')}>≡⯈</button>
          <button type="button" title="Justify" className={btnClass} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyFull')}>☰</button>
          <span className="w-px self-stretch bg-slate-300 mx-0.5" />
          <button type="button" title="Bullet list" className={btnClass} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')}>• List</button>
          <button type="button" title="Numbered list" className={btnClass} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertOrderedList')}>1. List</button>
          <button type="button" title="Decrease indent" className={btnClass} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('outdent')}>⇤</button>
          <button type="button" title="Increase indent" className={btnClass} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('indent')}>⇥</button>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          className={`rte-content ${minHeightClass || 'min-h-64'} p-3 text-sm outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5`}
          onInput={handleInput}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
        />
      </div>
    )
  },
)
RichTextEditor.displayName = 'RichTextEditor'

export default RichTextEditor
