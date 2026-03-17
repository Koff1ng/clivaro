const { PrismaClient } = require('@prisma/client');
const { updateStockLevel } = require('./lib/inventory');

// Mock tenant logic or use a specific one
const tenantId = 'tenant_clivaro'; // Adjust based on your findings

async function test() {
  const prisma = new PrismaClient({
    datasourceUrl: 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres?schema=' + tenantId
  });

  try {
    console.log('Testing updateStockLevel...');
    
    // Find a valid warehouse and product
    const warehouse = await prisma.warehouse.findFirst({ where: { active: true } });
    const product = await prisma.product.findFirst({ where: { active: true } });

    if (!warehouse || !product) {
      console.log('No warehouse or product found to test with.');
      return;
    }

    console.log(`Using Warehouse: ${warehouse.name} (${warehouse.id})`);
    console.log(`Using Product: ${product.name} (${product.id})`);

    await updateStockLevel(
      warehouse.id,
      product.id,
      null, // variantId
      10, // quantityChange
      prisma
    );

    console.log('✅ Stock updated successfully in debug script.');

  } catch (err) {
    console.error('❌ Error in updateStockLevel:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
