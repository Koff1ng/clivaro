import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { POSScreen } from '@/components/pos/pos-screen'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default async function POSPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="px-3 py-1.5 bg-background/80 backdrop-blur-sm border-b border-border/60">
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <ArrowLeft className="h-3 w-3 mr-1" />
              Panel
            </Button>
          </Link>
          <h1 className="text-sm font-medium text-foreground">
            Punto de Venta
          </h1>
          <div className="w-16" /> {/* Spacer para centrar */}
        </div>
      </div>
      <POSScreen />
    </div>
  )
}

