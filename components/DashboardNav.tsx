'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: 'Executive Summary', href: '/dashboard' },
  { label: 'Sales Pipeline', href: '/dashboard/sales' },
  { label: 'Client Care', href: '/dashboard/orders' },
  { label: 'Calls', href: '/dashboard/calls' },
  { label: 'Lead Sources', href: '/dashboard/sources' },
  { label: 'Pipelines Audit', href: '/dashboard/pipelines' },
  { label: 'Analytics Test', href: '/dashboard/analytics' },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="max-w-screen-xl mx-auto px-6">
        <div className="flex items-center gap-0 overflow-x-auto">
          {tabs.map((tab) => {
            const active =
              tab.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`whitespace-nowrap px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-[#F26522] text-[#F26522]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
