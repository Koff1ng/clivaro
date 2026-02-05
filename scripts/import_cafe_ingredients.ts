import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TENANT_SLUG = 'cafe-singular'

// Ingredientes base extraídos de las descripciones del menú
const ingredients = [
    // ===== HUEVOS Y LÁCTEOS =====
    { sku: "ING-001", name: "Huevos", category: "Lácteos y Huevos", unit: "UNIT", cost: 500 },
    { sku: "ING-002", name: "Queso crema", category: "Lácteos y Huevos", unit: "GRAM", cost: 20 },
    { sku: "ING-003", name: "Mozzarella", category: "Lácteos y Huevos", unit: "GRAM", cost: 15 },
    { sku: "ING-004", name: "Queso parmesano", category: "Lácteos y Huevos", unit: "GRAM", cost: 30 },
    { sku: "ING-005", name: "Queso gruyere", category: "Lácteos y Huevos", unit: "GRAM", cost: 35 },
    { sku: "ING-006", name: "Queso ricotta", category: "Lácteos y Huevos", unit: "GRAM", cost: 18 },
    { sku: "ING-007", name: "Mozzarella de búfala", category: "Lácteos y Huevos", unit: "GRAM", cost: 40 },
    { sku: "ING-008", name: "Queso campesino", category: "Lácteos y Huevos", unit: "GRAM", cost: 12 },
    { sku: "ING-009", name: "Queso madurado", category: "Lácteos y Huevos", unit: "GRAM", cost: 25 },
    { sku: "ING-010", name: "Yogurt griego", category: "Lácteos y Huevos", unit: "GRAM", cost: 8 },
    { sku: "ING-011", name: "Mantequilla", category: "Lácteos y Huevos", unit: "GRAM", cost: 10 },
    { sku: "ING-012", name: "Crema chantilly", category: "Lácteos y Huevos", unit: "GRAM", cost: 12 },
    { sku: "ING-013", name: "Helado de vainilla", category: "Lácteos y Huevos", unit: "GRAM", cost: 15 },

    // ===== CARNES Y PROTEÍNAS =====
    { sku: "ING-020", name: "Jamón york (cerdo)", category: "Carnes", unit: "GRAM", cost: 18 },
    { sku: "ING-021", name: "Jamón serrano", category: "Carnes", unit: "GRAM", cost: 45 },
    { sku: "ING-022", name: "Tocineta", category: "Carnes", unit: "GRAM", cost: 20 },
    { sku: "ING-023", name: "Pechuga de pollo", category: "Carnes", unit: "GRAM", cost: 15 },
    { sku: "ING-024", name: "Lomo de cerdo", category: "Carnes", unit: "GRAM", cost: 22 },
    { sku: "ING-025", name: "Salchicha ranchera", category: "Carnes", unit: "UNIT", cost: 1500 },

    // ===== VERDURAS Y HORTALIZAS =====
    { sku: "ING-030", name: "Cebolla", category: "Verduras", unit: "GRAM", cost: 3 },
    { sku: "ING-031", name: "Papa criolla", category: "Verduras", unit: "GRAM", cost: 4 },
    { sku: "ING-032", name: "Tomate cherry", category: "Verduras", unit: "GRAM", cost: 8 },
    { sku: "ING-033", name: "Champiñones", category: "Verduras", unit: "GRAM", cost: 12 },
    { sku: "ING-034", name: "Espinaca", category: "Verduras", unit: "GRAM", cost: 6 },
    { sku: "ING-035", name: "Lechuga", category: "Verduras", unit: "GRAM", cost: 4 },
    { sku: "ING-036", name: "Aguacate", category: "Verduras", unit: "UNIT", cost: 2000 },
    { sku: "ING-037", name: "Albahaca", category: "Verduras", unit: "GRAM", cost: 10 },
    { sku: "ING-038", name: "Ajo", category: "Verduras", unit: "GRAM", cost: 5 },
    { sku: "ING-039", name: "Zanahoria", category: "Verduras", unit: "GRAM", cost: 3 },

    // ===== PANES Y MASAS =====
    { sku: "ING-040", name: "Pan brioche", category: "Panes y Masas", unit: "UNIT", cost: 1500 },
    { sku: "ING-041", name: "Pan artesanal", category: "Panes y Masas", unit: "UNIT", cost: 2000 },
    { sku: "ING-042", name: "Pan de masa madre", category: "Panes y Masas", unit: "UNIT", cost: 2500 },
    { sku: "ING-043", name: "Masa de focaccia", category: "Panes y Masas", unit: "GRAM", cost: 8 },
    { sku: "ING-044", name: "Masa de hojaldre", category: "Panes y Masas", unit: "GRAM", cost: 12 },
    { sku: "ING-045", name: "Masa de volován", category: "Panes y Masas", unit: "GRAM", cost: 15 },
    { sku: "ING-046", name: "Masa choux", category: "Panes y Masas", unit: "GRAM", cost: 10 },
    { sku: "ING-047", name: "Masa de panuozzo", category: "Panes y Masas", unit: "GRAM", cost: 10 },
    { sku: "ING-048", name: "Masa de croissant", category: "Panes y Masas", unit: "GRAM", cost: 12 },
    { sku: "ING-049", name: "Almojábana", category: "Panes y Masas", unit: "UNIT", cost: 800 },
    { sku: "ING-050", name: "Pandebono", category: "Panes y Masas", unit: "UNIT", cost: 700 },
    { sku: "ING-051", name: "Garulla", category: "Panes y Masas", unit: "UNIT", cost: 600 },
    { sku: "ING-052", name: "Mantecada", category: "Panes y Masas", unit: "UNIT", cost: 500 },
    { sku: "ING-053", name: "Arepa", category: "Panes y Masas", unit: "UNIT", cost: 500 },
    { sku: "ING-054", name: "Crepe", category: "Panes y Masas", unit: "UNIT", cost: 800 },
    { sku: "ING-055", name: "Masa para pizza", category: "Panes y Masas", unit: "GRAM", cost: 8 },
    { sku: "ING-056", name: "Galleta", category: "Panes y Masas", unit: "UNIT", cost: 600 },
    { sku: "ING-057", name: "Biscuit", category: "Panes y Masas", unit: "GRAM", cost: 10 },

    // ===== SALSAS Y ADEREZOS =====
    { sku: "ING-060", name: "Salsa bernesa", category: "Salsas", unit: "ML", cost: 20 },
    { sku: "ING-061", name: "Salsa napolitana", category: "Salsas", unit: "ML", cost: 8 },
    { sku: "ING-062", name: "Hogao", category: "Salsas", unit: "ML", cost: 6 },
    { sku: "ING-063", name: "Salsa de quesos", category: "Salsas", unit: "ML", cost: 15 },
    { sku: "ING-064", name: "Pesto", category: "Salsas", unit: "ML", cost: 25 },
    { sku: "ING-065", name: "Hummus", category: "Salsas", unit: "GRAM", cost: 12 },
    { sku: "ING-066", name: "Mermelada", category: "Salsas", unit: "GRAM", cost: 10 },
    { sku: "ING-067", name: "Arequipe", category: "Salsas", unit: "GRAM", cost: 8 },
    { sku: "ING-068", name: "Reducción de balsámico", category: "Salsas", unit: "ML", cost: 18 },
    { sku: "ING-069", name: "Miel de albahaca", category: "Salsas", unit: "ML", cost: 22 },
    { sku: "ING-070", name: "Miel picante", category: "Salsas", unit: "ML", cost: 15 },
    { sku: "ING-071", name: "Salsa de chocolate", category: "Salsas", unit: "ML", cost: 12 },
    { sku: "ING-072", name: "Manjar blanco", category: "Salsas", unit: "GRAM", cost: 10 },

    // ===== FRUTAS =====
    { sku: "ING-080", name: "Peras", category: "Frutas", unit: "GRAM", cost: 6 },
    { sku: "ING-081", name: "Mora", category: "Frutas", unit: "GRAM", cost: 8 },
    { sku: "ING-082", name: "Mango", category: "Frutas", unit: "GRAM", cost: 5 },
    { sku: "ING-083", name: "Banano", category: "Frutas", unit: "GRAM", cost: 3 },
    { sku: "ING-084", name: "Fresas", category: "Frutas", unit: "GRAM", cost: 10 },
    { sku: "ING-085", name: "Arándanos", category: "Frutas", unit: "GRAM", cost: 15 },
    { sku: "ING-086", name: "Uchuvas", category: "Frutas", unit: "GRAM", cost: 12 },
    { sku: "ING-087", name: "Piña", category: "Frutas", unit: "GRAM", cost: 4 },
    { sku: "ING-088", name: "Lulo", category: "Frutas", unit: "GRAM", cost: 6 },
    { sku: "ING-089", name: "Maracuyá", category: "Frutas", unit: "GRAM", cost: 8 },
    { sku: "ING-090", name: "Limón", category: "Frutas", unit: "UNIT", cost: 300 },
    { sku: "ING-091", name: "Naranja", category: "Frutas", unit: "UNIT", cost: 400 },
    { sku: "ING-092", name: "Durazno", category: "Frutas", unit: "GRAM", cost: 7 },
    { sku: "ING-093", name: "Cerezas", category: "Frutas", unit: "GRAM", cost: 20 },
    { sku: "ING-094", name: "Ciruelas", category: "Frutas", unit: "GRAM", cost: 8 },
    { sku: "ING-095", name: "Manzana", category: "Frutas", unit: "UNIT", cost: 800 },

    // ===== FRUTOS SECOS Y SEMILLAS =====
    { sku: "ING-100", name: "Nueces", category: "Frutos Secos", unit: "GRAM", cost: 25 },
    { sku: "ING-101", name: "Almendras", category: "Frutos Secos", unit: "GRAM", cost: 22 },
    { sku: "ING-102", name: "Pistacho", category: "Frutos Secos", unit: "GRAM", cost: 35 },
    { sku: "ING-103", name: "Granola", category: "Frutos Secos", unit: "GRAM", cost: 15 },

    // ===== CHOCOLATES Y DULCES =====
    { sku: "ING-110", name: "Chocolate 65%", category: "Chocolates", unit: "GRAM", cost: 18 },
    { sku: "ING-111", name: "Chocolate blanco", category: "Chocolates", unit: "GRAM", cost: 16 },
    { sku: "ING-112", name: "Fudge de chocolate", category: "Chocolates", unit: "GRAM", cost: 20 },
    { sku: "ING-113", name: "Dulces franceses", category: "Chocolates", unit: "GRAM", cost: 30 },

    // ===== ESPECIAS Y CONDIMENTOS =====
    { sku: "ING-120", name: "Cardamomo", category: "Especias", unit: "GRAM", cost: 40 },
    { sku: "ING-121", name: "Jengibre", category: "Especias", unit: "GRAM", cost: 12 },
    { sku: "ING-122", name: "Cúrcuma", category: "Especias", unit: "GRAM", cost: 15 },
    { sku: "ING-123", name: "Pimienta", category: "Especias", unit: "GRAM", cost: 8 },
    { sku: "ING-124", name: "Paprika", category: "Especias", unit: "GRAM", cost: 10 },
    { sku: "ING-125", name: "Canela", category: "Especias", unit: "GRAM", cost: 12 },
    { sku: "ING-126", name: "Tajín", category: "Especias", unit: "GRAM", cost: 10 },

    // ===== INGREDIENTES ESPECIALES =====
    { sku: "ING-130", name: "Tomates secos", category: "Ingredientes Especiales", unit: "GRAM", cost: 18 },
    { sku: "ING-131", name: "Tomates confitados", category: "Ingredientes Especiales", unit: "GRAM", cost: 20 },
    { sku: "ING-132", name: "Quinoa", category: "Ingredientes Especiales", unit: "GRAM", cost: 10 },
    { sku: "ING-133", name: "Chontaduro", category: "Ingredientes Especiales", unit: "GRAM", cost: 15 },
    { sku: "ING-134", name: "Café molido", category: "Ingredientes Especiales", unit: "GRAM", cost: 12 },
    { sku: "ING-135", name: "Ron", category: "Ingredientes Especiales", unit: "ML", cost: 25 },
    { sku: "ING-136", name: "Aguardiente", category: "Ingredientes Especiales", unit: "ML", cost: 20 },
    { sku: "ING-137", name: "Aceite de oliva", category: "Ingredientes Especiales", unit: "ML", cost: 15 },
    { sku: "ING-138", name: "Panela", category: "Ingredientes Especiales", unit: "GRAM", cost: 4 },
    { sku: "ING-139", name: "Melaza", category: "Ingredientes Especiales", unit: "ML", cost: 8 },
    { sku: "ING-140", name: "Chucula integral", category: "Ingredientes Especiales", unit: "GRAM", cost: 10 },
    { sku: "ING-141", name: "Chocolate caliente", category: "Ingredientes Especiales", unit: "ML", cost: 8 },
    { sku: "ING-142", name: "Chips de temporada", category: "Ingredientes Especiales", unit: "GRAM", cost: 6 },

    // ===== HARINAS Y BASE PARA REPOSTERÍA =====
    { sku: "ING-150", name: "Harina de trigo", category: "Harinas", unit: "GRAM", cost: 2 },
    { sku: "ING-151", name: "Azúcar", category: "Harinas", unit: "GRAM", cost: 2 },
    { sku: "ING-152", name: "Levadura", category: "Harinas", unit: "GRAM", cost: 5 },
    { sku: "ING-153", name: "Bizcocho base", category: "Harinas", unit: "GRAM", cost: 8 },
    { sku: "ING-154", name: "Merengue", category: "Harinas", unit: "GRAM", cost: 10 },
    { sku: "ING-155", name: "Crema pastelera", category: "Harinas", unit: "GRAM", cost: 12 },
    { sku: "ING-156", name: "Pannacotta", category: "Harinas", unit: "GRAM", cost: 15 },
]

async function main() {
    try {
        console.log('🔍 Buscando tenant cafe-singular...')

        const tenant = await prisma.tenant.findUnique({
            where: { slug: TENANT_SLUG }
        })

        if (!tenant) {
            throw new Error(`Tenant '${TENANT_SLUG}' no encontrado`)
        }

        console.log(`✅ Tenant encontrado: ${tenant.name}`)
        console.log(`\n🥘 Importando ${ingredients.length} ingredientes base...\n`)

        // Cambiar al schema del tenant
        await prisma.$executeRawUnsafe(`SET search_path TO "${tenant.id}", public`)

        let imported = 0
        let skipped = 0

        for (const ing of ingredients) {
            try {
                // Verificar si ya existe
                const existing = await prisma.product.findFirst({
                    where: { sku: ing.sku }
                })

                if (existing) {
                    skipped++
                    continue
                }

                // Crear ingrediente como producto tipo RAW
                await prisma.product.create({
                    data: {
                        sku: ing.sku,
                        name: ing.name,
                        category: ing.category,
                        price: ing.cost * 1.5, // Precio 50% sobre el costo por defecto
                        cost: ing.cost,
                        taxRate: 0,
                        unitOfMeasure: ing.unit as any,
                        productType: 'RAW', // Materia prima
                        enableRecipeConsumption: false,
                        active: true
                    }
                })

                console.log(`✅ ${ing.sku} - ${ing.name} (${ing.unit})`)
                imported++

            } catch (error: any) {
                console.error(`❌ Error con ${ing.sku}: ${error.message}`)
            }
        }

        console.log(`\n✅ Importación de ingredientes completada:`)
        console.log(`   - Importados: ${imported}`)
        console.log(`   - Omitidos: ${skipped}`)
        console.log(`   - Total: ${ingredients.length}`)

        console.log(`\n📊 Categorías creadas:`)
        const categories = [...new Set(ingredients.map(i => i.category))]
        categories.forEach(cat => {
            const count = ingredients.filter(i => i.category === cat).length
            console.log(`   - ${cat}: ${count} ingredientes`)
        })

    } catch (error) {
        console.error('❌ Error:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

main()
