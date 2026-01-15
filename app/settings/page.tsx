import { Metadata } from 'next'
import { MainLayout } from '@/components/layout/main-layout'
import { SettingsScreen } from '@/components/settings/settings-screen'

export const metadata: Metadata = {
  title: 'Configuración',
  description: 'Configuración del sistema',
}

export default function SettingsPage() {
  return (
    <MainLayout>
      <SettingsScreen />
    </MainLayout>
  )
}

