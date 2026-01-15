'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Sparkles, Sun, Moon } from 'lucide-react'
import { useSession } from 'next-auth/react'

async function fetchOnboardingData() {
  const res = await fetch('/api/onboarding')
  if (!res.ok) return null
  return res.json()
}

export function DashboardGreeting() {
  const { data: session } = useSession()
  const { data: onboardingData } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: fetchOnboardingData,
    staleTime: 5 * 60 * 1000,
  })

  const userName = onboardingData?.settings?.onboardingUserName || session?.user?.name || 'Usuario'
  const companyName = onboardingData?.settings?.onboardingCompanyName

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'Buenos días'
    if (hour >= 12 && hour < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800"
    >
      <div className="flex items-center gap-4">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          className="flex-shrink-0"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-lg opacity-50" />
            <div className="relative bg-gradient-to-r from-blue-500 to-purple-500 rounded-full p-3">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
        </motion.div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {getGreeting()}, {userName.split(' ')[0]}! 👋
          </h2>
          {companyName && (
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Bienvenido a <span className="font-semibold">{companyName}</span>
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

