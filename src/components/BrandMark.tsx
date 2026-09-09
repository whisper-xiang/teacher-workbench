/** 侧栏印章，图形与 public/favicon.svg 保持一致 */
export function BrandMark({ size = 42 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" fill="#3f6b56" />
      <path
        fill="#f4f7f2"
        d="M32 17.5c-7.6-3.4-15.4-2.6-17.8.6A2.2 2.2 0 0 0 13 20.1v24.2a2.2 2.2 0 0 0 2.9 2.1c4.1-2.2 10-2.6 16.1.4.06.03.14.03.2 0 6.1-3 12-2.6 16.1-.4a2.2 2.2 0 0 0 2.9-2.1V20.1a2.2 2.2 0 0 0-1.2-2c-2.4-3.2-10.2-4-17.8-.6z"
      />
      <path fill="#2c4d3d" fillOpacity=".16" d="M32 19.2c-6.6-2.8-13.2-2.2-15.4.2v23.4c2.8-1.6 8.2-2 15.4.6z" />
      <path fill="#2c4d3d" fillOpacity=".1" d="M32 19.2c6.6-2.8 13.2-2.2 15.4.2v23.4c-2.8-1.6-8.2-2-15.4.6z" />
      <path fill="none" stroke="#2c4d3d" strokeWidth="1.7" strokeLinecap="round" d="M32 19.4v26.2" />
    </svg>
  )
}
