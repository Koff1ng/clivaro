'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

async function fetchMonthlyReport(year: number, month: number) {
  const params = new URLSearchParams({
    year: year.toString(),
    month: month.toString(),
  })
  const res = await fetch(`/api/dashboard/monthly-report?${params}`)
  if (!res.ok) throw new Error('Failed to fetch monthly report')
  return res.json()
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export function DashboardCharts() {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const { data, isLoading } = useQuery({
    queryKey: ['monthly-report', currentYear, currentMonth],
    queryFn: () => fetchMonthlyReport(currentYear, currentMonth),
    staleTime: 5 * 60 * 1000, // 5 minutes - monthly data changes infrequently
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  })

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cargando gráficos...</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cargando gráficos...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const report = data || {}
  const salesByDay = report.salesByDay || []
  const salesByPaymentMethod = report.salesByPaymentMethod || {}
  const topProducts = report.topProducts || []

  const paymentMethodData = Object.entries(salesByPaymentMethod).map(([method, amount]) => ({
    name: method === 'CASH' ? 'Efectivo' : method === 'CARD' ? 'Tarjeta' : method === 'TRANSFER' ? 'Transferencia' : method,
    value: amount as number,
  }))

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Gráfico de ventas por día */}
      <Card>
        <CardHeader>
          <CardTitle>Ventas por Día del Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
              <Legend />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#0088FE"
                strokeWidth={2}
                name="Ventas"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de ventas por método de pago */}
      <Card>
        <CardHeader>
          <CardTitle>Ventas por Método de Pago</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentMethodData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(((percent ?? 0) as number) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentMethodData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de top productos */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Top 10 Productos del Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
              <Legend />
              <Bar dataKey="revenue" fill="#0088FE" name="Ingresos" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

