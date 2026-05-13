'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-red-100 p-10 text-center shadow-sm">
      <p className="text-[#E74C3C] font-semibold mb-2">Failed to load dashboard data</p>
      <p className="text-gray-400 text-sm mb-6">{error.message}</p>
      <button
        onClick={reset}
        className="bg-[#F26522] hover:bg-[#d4561e] text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
      >
        Retry
      </button>
    </div>
  )
}
