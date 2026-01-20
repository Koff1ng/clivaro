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
      <div className="px-4 pt-4 pb-2 bg-background/80 backdrop-blur-sm border-b border-border/60">
        <Card className="border-none shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.55)] bg-card/95">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver al Panel
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Punto de Venta
                </h1>
                <p className="text-xs text-muted-foreground">
                  Registra ventas rápidas con una experiencia optimizada para caja.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
      <POSScreen />
    </div>
  )
}

