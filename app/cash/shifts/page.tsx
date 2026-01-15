import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CashShiftScreen } from '@/components/cash/cash-shift-screen'

export default async function CashShiftsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  return (
    <MainLayout>
      <CashShiftScreen />
    </MainLayout>
  )
}

