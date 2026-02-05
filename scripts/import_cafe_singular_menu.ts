import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TENANT_SLUG = 'cafe-singular'

const products = [
    // ===== DESAYUNOS (Con Receta) =====
    {
        sku: "DES-001",
        name: "La chelité",
        description: "Volován relleno de huevo pochado, coronado con salsa bernesa y acompañado de pequeños dulces franceses.",
        price: 21000,
        cost: 10000,
        category: "Desayunos",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "DES-002",
        name: "Huevos criollos",
        description: "Huevos sumergidos en hogao con tocineta y mozzarella, acompañado de arepitas fritas.",
        price: 23000,
        cost: 11000,
        category: "Desayunos",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "DES-003",
        name: "Karadeniz",
        description: "Desayuno de inspiración turca con huevos en cacerola sobre yogurt cremoso con ajo, mantequilla con paprika y mozzarella, acompañado de pan artesanal, mermelada y queso crema.",
        price: 26000,
        cost: 13000,
        category: "Desayunos",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "DES-004",
        name: "A la española",
        description: "Crepe rellena de queso crema, huevos revueltos, papa criolla y cebolla caramelizada.",
        price: 24000,
        cost: 12000,
        category: "Desayunos",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "DES-005",
        name: "Omelette heróico",
        description: "Omelette relleno de jamón york (cerdo), cebolla caramelizada, tomate cherry, champiñones, espinaca y mozzarella, acompañado de pan artesanal.",
        price: 22000,
        cost: 11000,
        category: "Desayunos",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "DES-006",
        name: "Napule",
        description: "Huevos sumergidos en salsa napolitana y mozzarella, acompañado de pan artesanal.",
        price: 18000,
        cost: 9000,
        category: "Desayunos",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "DES-007",
        name: "Porción de huevos",
        description: "Dos (2) huevos fritos o revueltos en mantequilla.",
        price: 3500,
        cost: 1500,
        category: "Desayunos",
        enableRecipeConsumption: false,
        productType: "RETAIL"
    },
    {
        sku: "ADI-001",
        name: "Adición salchicha ranchera",
        description: "Adición de salchicha ranchera",
        price: 3500,
        cost: 1500,
        category: "Adicionales",
        enableRecipeConsumption: false,
        productType: "RETAIL"
    },

    // ===== CESTAS Y SOPITAS (Con Receta) =====
    {
        sku: "CES-001",
        name: "Cesta artesanal",
        description: "Canasta de panes artesanales, acompañado de dos aderezos a elección: Tomates secos, mermelada, salsa de queso o hummus.",
        price: 18000,
        cost: 8000,
        category: "Cestas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "CES-002",
        name: "Cesta colombiana",
        description: "Selección de amasijos recién horneados: garulla, almojábanas y mantecada, acompañados de arequipe o mermelada.",
        price: 15000,
        cost: 7000,
        category: "Cestas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "SOP-001",
        name: "Sopitas de la abuela",
        description: "Migao tradicional colombiano con productos de panadería artesanal y quesos, servido con chucula integral o chocolate caliente.",
        price: 28000,
        cost: 14000,
        category: "Sopitas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },

    // ===== VIENNOISERIE (Panadería - Sin Receta) =====
    {
        sku: "VIE-001",
        name: "Croissant",
        description: "Croissant artesanal de mantequilla",
        price: 5000,
        cost: 2000,
        category: "Viennoiserie",
        enableRecipeConsumption: false,
        productType: "RETAIL"
    },
    {
        sku: "VIE-002",
        name: "Croissant con chocolate",
        description: "Croissant relleno de chocolate",
        price: 8500,
        cost: 3500,
        category: "Viennoiserie",
        enableRecipeConsumption: false,
        productType: "RETAIL"
    },
    {
        sku: "VIE-003",
        name: "Croissant de almendras",
        description: "Croissant relleno de crema de almendras",
        price: 11000,
        cost: 4500,
        category: "Viennoiserie",
        enableRecipeConsumption: false,
        productType: "RETAIL"
    },
    {
        sku: "VIE-004",
        name: "Croissant de pistacho",
        description: "Croissant relleno de crema de pistacho",
        price: 16000,
        cost: 7000,
        category: "Viennoiserie",
        enableRecipeConsumption: false,
        productType: "RETAIL"
    },
    {
        sku: "VIE-005",
        name: "Crookie",
        description: "Croissant con galleta",
        price: 12000,
        cost: 5000,
        category: "Viennoiserie",
        enableRecipeConsumption: false,
        productType: "RETAIL"
    },

    // ===== PANES PERSONALES (Sin Receta) =====
    {
        sku: "PAN-001",
        name: "Focaccia",
        description: "Pan italiano focaccia personal",
        price: 6500,
        cost: 2500,
        category: "Panes",
        enableRecipeConsumption: false,
        productType: "RETAIL"
    },
    {
        sku: "PAN-002",
        name: "Rollo de canela",
        description: "Rollo de canela personal",
        price: 5000,
        cost: 2000,
        category: "Panes",
        enableRecipeConsumption: false,
        productType: "RETAIL"
    },
    {
        sku: "PAN-003",
        name: "Pan manzana",
        description: "Pan de manzana personal",
        price: 5000,
        cost: 2000,
        category: "Panes",
        enableRecipeConsumption: false,
        productType: "RETAIL"
    },

    // ===== SÁNDWICHES Y TOSTADAS (Con Receta) =====
    {
        sku: "SAN-001",
        name: "Mlle. Pamela",
        description: "Sándwich francés en pan brioche con jamón de cerdo, mozzarella y salsa de quesos. Terminado con huevo frito y miel de albahaca.",
        price: 25000,
        cost: 12000,
        category: "Sándwiches",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "SAN-002",
        name: "Armonía bianca rossa",
        description: "Tres montaditos de focaccia con perfiles de sabor diferente: napolitano, queso con mermelada, pesto con tomates confitados y mozzarella de búfala.",
        price: 28000,
        cost: 14000,
        category: "Sándwiches",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "SAN-003",
        name: "Doña Piedad",
        description: "Tostada de pan de masa madre con aguacate, mix de lechugas y queso parmesano, sobre reducción de balsámico.",
        price: 22000,
        cost: 11000,
        category: "Sándwiches",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "QUI-001",
        name: "Quiche marco aurelio",
        description: "Base de hojaldre relleno de tocineta, jamón de cerdo, cebolla caramelizada, mozzarella y parmesano, acompañado con chips de temporada.",
        price: 28000,
        cost: 14000,
        category: "Quiches",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "QUI-002",
        name: "Quiche punto y coma",
        description: "Base de hojaldre relleno de pollo, champiñones, mozzarella y parmesano, acompañado con chips de temporada.",
        price: 28000,
        cost: 14000,
        category: "Quiches",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "BOW-001",
        name: "Selvina",
        description: "Waffle de pandebono con helado de vainilla, cerezas, salsa de chocolate caliente y crema chantilly.",
        price: 20000,
        cost: 10000,
        category: "Bowls y Waffles",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "BOW-002",
        name: "Trópico",
        description: "Bowl de granola con base cremosa de mango, banano, yogurt griego, cúrcuma, pimienta y cardamomo, con fresas, arándanos, chocolate amargo y almendras.",
        price: 20000,
        cost: 10000,
        category: "Bowls y Waffles",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },

    // ===== PANUOZZOS (Con Receta) =====
    {
        sku: "PANU-001",
        name: "Lomo al fuego",
        description: "Panuozzo relleno de lomo de cerdo marinado estilo coreano, lechuga y mozzarella",
        price: 25000,
        cost: 12000,
        category: "Panuozzos",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "PANU-002",
        name: "Plenitud",
        description: "Panuozzo relleno de jamón serrano, tomates secos, peras escalfadas en melado de panela y canela y mozzarella de búfala.",
        price: 27000,
        cost: 13000,
        category: "Panuozzos",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "PANU-003",
        name: "Kundan",
        description: "Panuozzo relleno de butter chicken (pollo a la mantequilla), lechuga y mozzarella.",
        price: 22000,
        cost: 11000,
        category: "Panuozzos",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "PANU-004",
        name: "Naime",
        description: "Panuozzo relleno de hummus, hamburguesa de quinoa, cebolla caramelizada, tomates cherry y lechuga.",
        price: 23000,
        cost: 11000,
        category: "Panuozzos",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },

    // ===== PIZZAS (Con Receta) =====
    {
        sku: "PIZ-001",
        name: "La Emilia",
        description: "Salsa napolitana, tomates secos, jamón serrano, albahaca y mozzarella de búfala. Tamaño personal, masa madre.",
        price: 32000,
        cost: 16000,
        category: "Pizzas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "PIZ-002",
        name: "La Isabella",
        description: "Salsa napolitana, pollo, champiñones, miel picante y mozzarella. Tamaño personal, masa madre.",
        price: 26000,
        cost: 13000,
        category: "Pizzas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "PIZ-003",
        name: "Los Alpes",
        description: "Base de queso crema, peras, nueces garrapiñadas, queso gruyere y mozzarella. Tamaño personal, masa madre.",
        price: 24000,
        cost: 12000,
        category: "Pizzas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "PIZ-004",
        name: "Cielo mediterráneo",
        description: "Base de queso crema, mora, albahaca, queso ricotta y mozzarella. Tamaño personal, masa madre.",
        price: 23000,
        cost: 11000,
        category: "Pizzas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },

    // ===== TORTAS (Con Receta) =====
    {
        sku: "TOR-001",
        name: "La Bananera",
        description: "Bizcocho esponjoso y húmedo de banano, crema de queso y nueces garrapiñadas.",
        price: 15000,
        cost: 7000,
        category: "Tortas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "TOR-002",
        name: "A la Orden de Orange - Zanahoria",
        description: "Bizcocho de zanahoria y nueces, crema de queso y nueces garrapiñadas.",
        price: 15000,
        cost: 7000,
        category: "Tortas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "TOR-003",
        name: "Al borde de la tentación",
        description: "Bizcocho de chocolate, relleno de crema de chocolate al 65%, cubierta de fudge y salsa de chocolate.",
        price: 15000,
        cost: 7000,
        category: "Tortas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "TOR-004",
        name: "Una nueva primavera",
        description: "Tarta de queso cremosa de queso crema y queso madurado y base de galleta, acompañado con confitura de ciruelas.",
        price: 15000,
        cost: 7000,
        category: "Tortas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "TOR-005",
        name: "En la Buena",
        description: "Torta caliente a base de pandebono, almojábana y queso campesino.",
        price: 15000,
        cost: 7000,
        category: "Tortas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "TOR-006",
        name: "Carlota de mango biche",
        description: "Biscuit sumergido en limonada de mango biche y cremoso de limón, coronado con mermelada de mango biche y tajín.",
        price: 10000,
        cost: 5000,
        category: "Tortas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },

    // ===== BROWNIES Y POSTRES (Mixto) =====
    {
        sku: "POS-001",
        name: "Brownie",
        description: "Brownie húmedo de chocolate al 65% (amargo).",
        price: 8700,
        cost: 3500,
        category: "Postres",
        enableRecipeConsumption: false,
        productType: "RETAIL"
    },
    {
        sku: "POS-002",
        name: "Nuqui",
        description: "Brownie, nueces, helado de vainilla, salsa de chocolate, crema chantilly y galleta.",
        price: 17000,
        cost: 8000,
        category: "Postres",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "POS-003",
        name: "Rebeldes del pacífico",
        description: "Masa choux rellena de crema de queso, durazno y crema de chontaduro.",
        price: 8000,
        cost: 4000,
        category: "Postres",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "POS-004",
        name: "Chocolina",
        description: "Postre sin azúcar añadida compuesto por capas de galleta de chocolate sumergidas en café y crema de arequipe y queso.",
        price: 12000,
        cost: 6000,
        category: "Postres",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "POS-005",
        name: "Brisa",
        description: "Masa choux en forma de dona rellena de bizcocho de naranja y crema de cardamomo y jengibre.",
        price: 11000,
        cost: 5500,
        category: "Postres",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "POS-006",
        name: "Pannacotta",
        description: "Biscuit de melaza relleno de pannacotta de aceite de oliva y uchuvas fermentadas caramelizadas con ron.",
        price: 14000,
        cost: 7000,
        category: "Postres",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "POS-007",
        name: "Las 3 niñas",
        description: "Mousse de limón y mermelada de piña y lulo, entre dos merengues de almendras.",
        price: 13000,
        cost: 6500,
        category: "Postres",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "BEB-001",
        name: "Café goloso",
        description: "Americano o espresso servido con mantecada y crème brûlée de aguardiente.",
        price: 15000,
        cost: 7000,
        category: "Bebidas y Postres",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },

    // ===== GALLETAS (Con Receta) =====
    {
        sku: "GAL-001",
        name: "Maracuyá",
        description: "Galleta suave de mantequilla con trozos de chocolate blanco, rellena de crema de maracuyá, coronada con jalea de maracuyá.",
        price: 10000,
        cost: 4500,
        category: "Galletas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    },
    {
        sku: "GAL-002",
        name: "Manjar blanco",
        description: "Galleta suave de mantequilla rellena de manjar blanco y queso, coronada con mermelada de mora.",
        price: 10000,
        cost: 4500,
        category: "Galletas",
        enableRecipeConsumption: true,
        productType: "SELLABLE"
    }
]

async function main() {
    try {
        console.log('🔍 Buscando tenant cafe-singular...')

        // Buscar el tenant
        const tenant = await prisma.tenant.findUnique({
            where: { slug: TENANT_SLUG }
        })

        if (!tenant) {
            throw new Error(`Tenant '${TENANT_SLUG}' no encontrado`)
        }

        console.log(`✅ Tenant encontrado: ${tenant.name} (ID: ${tenant.id})`)
        console.log(`\n📦 Importando ${products.length} productos...\n`)

        // Cambiar al schema del tenant
        await prisma.$executeRawUnsafe(`SET search_path TO "${tenant.id}", public`)

        let imported = 0
        let skipped = 0

        for (const product of products) {
            try {
                // Verificar si ya existe
                const existing = await prisma.product.findFirst({
                    where: { sku: product.sku }
                })

                if (existing) {
                    console.log(`⏭️  ${product.sku} - ${product.name} (ya existe)`)
                    skipped++
                    continue
                }

                // Crear producto
                await prisma.product.create({
                    data: {
                        sku: product.sku,
                        name: product.name,
                        description: product.description,
                        category: product.category,
                        price: product.price,
                        cost: product.cost,
                        taxRate: 0,
                        unitOfMeasure: 'UNIT',
                        productType: product.productType as any,
                        enableRecipeConsumption: product.enableRecipeConsumption,
                        active: true
                    }
                })

                const icon = product.enableRecipeConsumption ? '🍽️ ' : '📦'
                console.log(`${icon} ${product.sku} - ${product.name}`)
                imported++

            } catch (error: any) {
                console.error(`❌ Error con ${product.sku}: ${error.message}`)
            }
        }

        console.log(`\n✅ Importación completada:`)
        console.log(`   - Importados: ${imported}`)
        console.log(`   - Omitidos: ${skipped}`)
        console.log(`   - Total: ${products.length}`)

        const withRecipe = products.filter(p => p.enableRecipeConsumption).length
        const withoutRecipe = products.filter(p => !p.enableRecipeConsumption).length

        console.log(`\n📊 Resumen:`)
        console.log(`   - Con receta (🍽️): ${withRecipe}`)
        console.log(`   - Sin receta (📦): ${withoutRecipe}`)

    } catch (error) {
        console.error('❌ Error:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

main()
