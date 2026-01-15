import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // Create permissions
  const permissions = [
    { name: 'manage_users', description: 'Manage users and roles' },
    { name: 'manage_products', description: 'Manage products catalog' },
    { name: 'manage_inventory', description: 'Manage inventory and stock' },
    { name: 'manage_sales', description: 'Manage sales, orders, invoices' },
    { name: 'manage_purchases', description: 'Manage purchases and suppliers' },
    { name: 'manage_crm', description: 'Manage customers and leads' },
    { name: 'view_reports', description: 'View reports and analytics' },
    { name: 'manage_cash', description: 'Manage cash register and shifts' },
  ]

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    })
  }

  console.log('Permissions created')

  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Administrator with all permissions',
    },
  })

  const managerRole = await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: {
      name: 'MANAGER',
      description: 'Manager with most permissions',
    },
  })

  const cashierRole = await prisma.role.upsert({
    where: { name: 'CASHIER' },
    update: {},
    create: {
      name: 'CASHIER',
      description: 'Cashier for POS operations',
    },
  })

  const salesRole = await prisma.role.upsert({
    where: { name: 'SALES' },
    update: {},
    create: {
      name: 'SALES',
      description: 'Sales person',
    },
  })

  const warehouseRole = await prisma.role.upsert({
    where: { name: 'WAREHOUSE' },
    update: {},
    create: {
      name: 'WAREHOUSE',
      description: 'Warehouse staff',
    },
  })

  console.log('Roles created')

  // Assign permissions to roles
  const allPermissions = await prisma.permission.findMany()
  const permissionMap = new Map(allPermissions.map(p => [p.name, p.id]))

  // ADMIN gets all permissions
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    })
  }

  // MANAGER gets most permissions except manage_users
  const managerPermissions = allPermissions.filter(p => p.name !== 'manage_users')
  for (const perm of managerPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: managerRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: managerRole.id,
        permissionId: perm.id,
      },
    })
  }

  // CASHIER gets manage_sales, manage_cash, and manage_crm (for customers)
  const cashierPerms = ['manage_sales', 'manage_cash', 'manage_crm']
  for (const permName of cashierPerms) {
    const permId = permissionMap.get(permName)
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: cashierRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: {
          roleId: cashierRole.id,
          permissionId: permId,
        },
      })
    }
  }

  // SALES gets manage_sales and manage_crm
  const salesPerms = ['manage_sales', 'manage_crm', 'view_reports']
  for (const permName of salesPerms) {
    const permId = permissionMap.get(permName)
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: salesRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: {
          roleId: salesRole.id,
          permissionId: permId,
        },
      })
    }
  }

  // WAREHOUSE gets manage_inventory and manage_purchases
  const warehousePerms = ['manage_inventory', 'manage_purchases', 'manage_products']
  for (const permName of warehousePerms) {
    const permId = permissionMap.get(permName)
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: warehouseRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: {
          roleId: warehouseRole.id,
          permissionId: permId,
        },
      })
    }
  }

  console.log('Permissions assigned to roles')

  // Create users
  const hashedAdminPassword = await bcrypt.hash('Admin123!', 10)
  const hashedCashierPassword = await bcrypt.hash('Cashier123!', 10)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@local' },
    update: {
      isSuperAdmin: true,
    },
    create: {
      username: 'admin',
      email: 'admin@local',
      password: hashedAdminPassword,
      name: 'Administrator',
      active: true,
      isSuperAdmin: true,
    },
  })

  const cashierUser = await prisma.user.upsert({
    where: { email: 'cashier@local' },
    update: {},
    create: {
      username: 'cashier',
      email: 'cashier@local',
      password: hashedCashierPassword,
      name: 'Cashier',
      active: true,
    },
  })

  // Assign roles to users
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  })

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: cashierUser.id,
        roleId: cashierRole.id,
      },
    },
    update: {},
    create: {
      userId: cashierUser.id,
      roleId: cashierRole.id,
    },
  })

  console.log('Users created')

  // Create warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: { name: 'Almacén Principal' },
    update: {},
    create: {
      name: 'Almacén Principal',
      address: 'Calle Principal 123',
      active: true,
    },
  })

  console.log('Warehouse created')

  // Create products
  const products = [
    { sku: 'MART-001', name: 'Martillo de Acero', brand: 'Herramientas Pro', category: 'Herramientas', unitOfMeasure: 'UNIT' as const, cost: 15.50, price: 25.00, taxRate: 19, trackStock: true },
    { sku: 'DEST-002', name: 'Destornillador Phillips', brand: 'Herramientas Pro', category: 'Herramientas', unitOfMeasure: 'UNIT' as const, cost: 5.00, price: 8.50, taxRate: 19, trackStock: true },
    { sku: 'CLAV-003', name: 'Clavos 2.5"', brand: 'Ferretería', category: 'Fijaciones', unitOfMeasure: 'KILO' as const, cost: 3.50, price: 6.00, taxRate: 19, trackStock: true },
    { sku: 'TUBO-004', name: 'Tubo PVC 1/2"', brand: 'Plomería', category: 'Plomería', unitOfMeasure: 'METER' as const, cost: 2.00, price: 3.50, taxRate: 19, trackStock: true },
    { sku: 'PINT-005', name: 'Pintura Blanca 1L', brand: 'Color Plus', category: 'Pinturas', unitOfMeasure: 'UNIT' as const, cost: 12.00, price: 20.00, taxRate: 19, trackStock: true },
    { sku: 'CABL-006', name: 'Cable Eléctrico 2.5mm', brand: 'Electric', category: 'Eléctricos', unitOfMeasure: 'METER' as const, cost: 1.50, price: 2.80, taxRate: 19, trackStock: true },
    { sku: 'BROC-007', name: 'Brocha 4"', brand: 'Pinturas', category: 'Pinturas', unitOfMeasure: 'UNIT' as const, cost: 4.00, price: 7.00, taxRate: 19, trackStock: true },
    { sku: 'TORN-008', name: 'Tornillos 3/8"', brand: 'Ferretería', category: 'Fijaciones', unitOfMeasure: 'BOX' as const, cost: 8.00, price: 14.00, taxRate: 19, trackStock: true },
    { sku: 'CINT-009', name: 'Cinta Métrica 5m', brand: 'Medición', category: 'Herramientas', unitOfMeasure: 'UNIT' as const, cost: 6.50, price: 11.00, taxRate: 19, trackStock: true },
    { sku: 'LAMP-010', name: 'Lámpara LED 12W', brand: 'Iluminación', category: 'Eléctricos', unitOfMeasure: 'UNIT' as const, cost: 18.00, price: 30.00, taxRate: 19, trackStock: true },
  ]

  const createdProducts = []
  for (const product of products) {
    const created = await prisma.product.create({
      data: {
        ...product,
        cost: product.cost,
        price: product.price,
        taxRate: product.taxRate,
        createdById: adminUser.id,
      },
    })
    createdProducts.push(created)
  }

  console.log('Products created')

  // Create stock levels for products
  for (let i = 0; i < createdProducts.length; i++) {
    const product = createdProducts[i]
    const initialStock = Math.floor(Math.random() * 100) + 20 // Random stock between 20-120
    const minStock = Math.floor(initialStock * 0.2) // 20% of initial stock as min

    await prisma.stockLevel.create({
      data: {
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: initialStock,
        minStock: minStock,
      },
    })

    // Create initial stock movement
    await prisma.stockMovement.create({
      data: {
        warehouseId: warehouse.id,
        productId: product.id,
        type: 'IN',
        quantity: initialStock,
        reason: 'Stock inicial',
        createdById: adminUser.id,
        reference: 'INIT',
      },
    })
  }

  console.log('Stock levels created')

  // Create customers
  const customers = [
    { name: 'Juan Pérez', phone: '+34 600 123 456', email: 'juan@example.com', address: 'Calle Mayor 1', taxId: '12345678A' },
    { name: 'María García', phone: '+34 600 234 567', email: 'maria@example.com', address: 'Avenida Central 45', taxId: '23456789B' },
    { name: 'Pedro López', phone: '+34 600 345 678', email: 'pedro@example.com', address: 'Plaza del Sol 12', taxId: '34567890C' },
    { name: 'Ana Martínez', phone: '+34 600 456 789', email: 'ana@example.com', address: 'Calle Nueva 8', taxId: '45678901D' },
    { name: 'Carlos Ruiz', phone: '+34 600 567 890', email: 'carlos@example.com', address: 'Boulevard Norte 23', taxId: '56789012E' },
  ]

  for (const customer of customers) {
    await prisma.customer.create({
      data: {
        ...customer,
        createdById: adminUser.id,
      },
    })
  }

  console.log('Customers created')

  // Create suppliers
  const suppliers = [
    { name: 'Proveedor Mayorista SA', phone: '+34 900 111 222', email: 'contacto@mayorista.com', address: 'Polígono Industrial 1', taxId: 'A12345678' },
    { name: 'Distribuidora Ferretería SL', phone: '+34 900 222 333', email: 'ventas@distribuidora.com', address: 'Calle Comercial 10', taxId: 'B23456789' },
    { name: 'Suministros Industriales', phone: '+34 900 333 444', email: 'info@suministros.com', address: 'Zona Industrial 5', taxId: 'C34567890' },
  ]

  for (const supplier of suppliers) {
    await prisma.supplier.create({
      data: {
        ...supplier,
        createdById: adminUser.id,
      },
    })
  }

  console.log('Suppliers created')

  console.log('Seed completed successfully!')
  console.log('\nDefault users:')
  console.log('  Admin: admin@local / Admin123!')
  console.log('  Cashier: cashier@local / Cashier123!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

