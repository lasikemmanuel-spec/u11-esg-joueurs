type Parent = 'father' | 'mother'

export function ParentAvatar({ parent }: { parent: Parent }) {
  const isFather = parent === 'father'

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full ${isFather ? 'bg-sky-100' : 'bg-rose-100'}`}
    >
      <svg viewBox="0 0 48 48" className="size-10" role="presentation">
        <path d="M7 48c1-9 7-14 17-14s16 5 17 14" fill={isFather ? '#26345f' : '#7a365f'} />
        <path d="M13 18c0-9 5-14 12-14s12 5 12 14v10c0 8-5 13-12 13s-12-5-12-13z" fill="#f1c6a5" />
        {isFather ? (
          <>
            <path d="M12 19C9 8 17 2 25 2c8 0 13 6 12 16-3-2-5-5-6-8-4 4-10 6-19 6z" fill="#34283a" />
            <path d="M14 28c3 2 6 3 10 3s8-1 11-3c-1 9-5 13-11 13s-9-4-10-13z" fill="#49303a" />
          </>
        ) : (
          <>
            <path d="M12 24C8 7 17 1 25 1c11 0 17 9 12 24l-4-8c-5 1-11 1-18-1z" fill="#49303a" />
            <path d="M34 22c8 0 8 12 1 14" fill="none" stroke="#49303a" strokeWidth="4" strokeLinecap="round" />
          </>
        )}
        <circle cx="20" cy="23" r="1.2" fill="#20213c" />
        <circle cx="29" cy="23" r="1.2" fill="#20213c" />
        <path d="M21 29c2 2 5 2 7 0" fill="none" stroke="#a85258" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <span className="absolute right-0 bottom-0 flex size-4 items-center justify-center rounded-full border border-white bg-accent text-[9px] leading-none">⚽</span>
    </span>
  )
}
