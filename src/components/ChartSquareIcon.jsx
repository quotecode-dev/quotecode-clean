// Chart-in-a-rounded-square line icon (Expenses & Reports). Same stroke grammar as the lucide icons beside it.
export default function ChartSquareIcon({ size = 24, strokeWidth = 2, ...rest }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 17v-4" />
      <path d="M12 17V8" />
      <path d="M16 17v-6" />
    </svg>
  );
}
