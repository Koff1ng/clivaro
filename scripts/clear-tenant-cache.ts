import { clearTenantCache } from '@/lib/tenant-db'

console.log('🧹 Limpiando cache de clientes Prisma de tenants...')
clearTenantCache()
console.log('✅ Cache limpiado. Los clientes se regenerarán automáticamente en el próximo uso.')

