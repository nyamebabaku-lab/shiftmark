/** ShiftMark mark: a location pin whose head is a clock with a tick. */
export default function Logo({ className = 'h-10 w-10' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="smg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#6366f1" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#smg)" />
      <path d="M32 12c-9.4 0-17 7.4-17 16.6C15 41 32 54 32 54s17-13 17-25.4C49 19.4 41.4 12 32 12z" fill="#0f172a" opacity=".9" />
      <circle cx="32" cy="29" r="10.5" fill="none" stroke="#fff" strokeWidth="3" />
      <path d="M27 29.5l3.6 3.6L37.5 26" fill="none" stroke="#22d3ee" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
