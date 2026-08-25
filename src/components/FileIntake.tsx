import { useRef } from 'react'

type Props = {
  file: File | null
  onFile: (file: File | null) => void
  label?: string
  busy?: boolean
}

export function FileIntake({ file, onFile, label = '上传文件，自动识别名称与日期', busy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const take = (next: File | undefined) => {
    if (next) onFile(next)
  }

  return (
    <div
      className={`file-intake${file ? ' has-file' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        take(event.dataTransfer.files[0])
      }}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(event) => {
          take(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <button className="outline-action" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? '正在识别…' : file ? '更换文件' : '上传文件'}
      </button>
      <span>{file ? file.name : label}</span>
      {file && (
        <button className="text-action" type="button" onClick={() => onFile(null)}>
          清除
        </button>
      )}
    </div>
  )
}
