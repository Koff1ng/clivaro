import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TENANT_SLUG = 'cafe-singular'

// Mapeo de recetas: cada plato con sus ingredientes y cantidades
const recipes = {
    // DESAYUNOS
    "DES-001": [ // La chelité
        { ingredientSku: "ING-045", quantity: 80 },   // Masa de volován
        { ingredientSku: "ING-001", quantity: 2 },    // Huevos
        { ingredientSku: "ING-060", quantity: 50 },   // Salsa bernesa
        { ingredientSku: "ING-113", quantity: 30 },   // Dulces franceses
    ],
    "DES-002": [ // Huevos criollos
        { ingredientSku: "ING-001", quantity: 2 },    // Huevos
        { ingredientSku: "ING-062", quantity: 80 },   // Hogao
        { ingredientSku: "ING-022", quantity: 40 },   // Tocineta
        { ingredientSku: "ING-003", quantity: 50 },   // Mozzarella
        { ingredientSku: "ING-053", quantity: 3 },    // Arepitas
    ],
    "DES-003": [ // Karadeniz
        { ingredientSku: "ING-001", quantity: 2 },    // Huevos
        { ingredientSku: "ING-010", quantity: 100 },  // Yogurt griego
        { ingredientSku: "ING-038", quantity: 5 },    // Ajo
        { ingredientSku: "ING-011", quantity: 20 },   // Mantequilla
        { ingredientSku: "ING-124", quantity: 2 },    // Paprika
        { ingredientSku: "ING-003", quantity: 50 },   // Mozzarella
        { ingredientSku: "ING-041", quantity: 1 },    // Pan artesanal
        { ingredientSku: "ING-066", quantity: 30 },   // Mermelada
        { ingredientSku: "ING-002", quantity: 40 },   // Queso crema
    ],
    "DES-004": [ // A la española
        { ingredientSku: "ING-054", quantity: 1 },    // Crepe
        { ingredientSku: "ING-002", quantity: 50 },   // Queso crema
        { ingredientSku: "ING-001", quantity: 2 },    // Huevos
        { ingredientSku: "ING-031", quantity: 80 },   // Papa criolla
        { ingredientSku: "ING-030", quantity: 40 },   // Cebolla caramelizada
    ],
    "DES-005": [ // Omelette heróico
        { ingredientSku: "ING-001", quantity: 3 },    // Huevos
        { ingredientSku: "ING-020", quantity: 50 },   // Jamón york
        { ingredientSku: "ING-030", quantity: 40 },   // Cebolla
        { ingredientSku: "ING-032", quantity: 30 },   // Tomate cherry
        { ingredientSku: "ING-033", quantity: 40 },   // Champiñones
        { ingredientSku: "ING-034", quantity: 30 },   // Espinaca
        { ingredientSku: "ING-003", quantity: 50 },   // Mozzarella
        { ingredientSku: "ING-041", quantity: 1 },    // Pan artesanal
    ],
    "DES-006": [ // Napule
        { ingredientSku: "ING-001", quantity: 2 },    // Huevos
        { ingredientSku: "ING-061", quantity: 100 },  // Salsa napolitana
        { ingredientSku: "ING-003", quantity: 50 },   // Mozzarella
        { ingredientSku: "ING-041", quantity: 1 },    // Pan artesanal
    ],

    // CESTAS
    "CES-001": [ // Cesta artesanal
        { ingredientSku: "ING-041", quantity: 3 },    // Panes artesanales
        { ingredientSku: "ING-130", quantity: 30 },   // Tomates secos
        { ingredientSku: "ING-066", quantity: 40 },   // Mermelada
        { ingredientSku: "ING-063", quantity: 40 },   // Salsa de quesos
        { ingredientSku: "ING-065", quantity: 40 },   // Hummus
    ],
    "CES-002": [ // Cesta colombiana
        { ingredientSku: "ING-051", quantity: 2 },    // Garulla
        { ingredientSku: "ING-049", quantity: 2 },    // Almojábanas
        { ingredientSku: "ING-052", quantity: 2 },    // Mantecada
        { ingredientSku: "ING-067", quantity: 50 },   // Arequipe
        { ingredientSku: "ING-066", quantity: 50 },   // Mermelada
    ],

    // SOPITAS
    "SOP-001": [ // Sopitas de la abuela
        { ingredientSku: "ING-041", quantity: 100 },  // Pan artesanal
        { ingredientSku: "ING-003", quantity: 80 },   // Quesos
        { ingredientSku: "ING-140", quantity: 200 },  // Chucula integral
        { ingredientSku: "ING-141", quantity: 200 },  // Chocolate caliente
    ],

    // SÁNDWICHES
    "SAN-001": [ // Mlle. Pamela
        { ingredientSku: "ING-040", quantity: 1 },    // Pan brioche
        { ingredientSku: "ING-020", quantity: 60 },   // Jamón de cerdo
        { ingredientSku: "ING-003", quantity: 50 },   // Mozzarella
        { ingredientSku: "ING-063", quantity: 40 },   // Salsa de quesos
        { ingredientSku: "ING-001", quantity: 1 },    // Huevo frito
        { ingredientSku: "ING-069", quantity: 20 },   // Miel de albahaca
    ],
    "SAN-002": [ // Armonía bianca rossa
        { ingredientSku: "ING-043", quantity: 150 },  // Focaccia (3 montaditos)
        { ingredientSku: "ING-061", quantity: 50 },   // Napolitano
        { ingredientSku: "ING-003", quantity: 40 },   // Queso
        { ingredientSku: "ING-066", quantity: 30 },   // Mermelada
        { ingredientSku: "ING-064", quantity: 30 },   // Pesto
        { ingredientSku: "ING-131", quantity: 40 },   // Tomates confitados
        { ingredientSku: "ING-007", quantity: 50 },   // Mozzarella de búfala
    ],
    "SAN-003": [ // Doña Piedad
        { ingredientSku: "ING-042", quantity: 1 },    // Pan de masa madre
        { ingredientSku: "ING-036", quantity: 1 },    // Aguacate
        { ingredientSku: "ING-035", quantity: 40 },   // Mix de lechugas
        { ingredientSku: "ING-004", quantity: 20 },   // Queso parmesano
        { ingredientSku: "ING-068", quantity: 20 },   // Reducción de balsámico
    ],

    // QUICHES
    "QUI-001": [ // Quiche marco aurelio
        { ingredientSku: "ING-044", quantity: 120 },  // Base de hojaldre
        { ingredientSku: "ING-022", quantity: 50 },   // Tocineta
        { ingredientSku: "ING-020", quantity: 50 },   // Jamón de cerdo
        { ingredientSku: "ING-030", quantity: 40 },   // Cebolla caramelizada
        { ingredientSku: "ING-003", quantity: 60 },   // Mozzarella
        { ingredientSku: "ING-004", quantity: 30 },   // Parmesano
        { ingredientSku: "ING-142", quantity: 50 },   // Chips de temporada
    ],
    "QUI-002": [ // Quiche punto y coma
        { ingredientSku: "ING-044", quantity: 120 },  // Base de hojaldre
        { ingredientSku: "ING-023", quantity: 80 },   // Pollo
        { ingredientSku: "ING-033", quantity: 50 },   // Champiñones
        { ingredientSku: "ING-003", quantity: 60 },   // Mozzarella
        { ingredientSku: "ING-004", quantity: 30 },   // Parmesano
        { ingredientSku: "ING-142", quantity: 50 },   // Chips de temporada
    ],

    // BOWLS Y WAFFLES
    "BOW-001": [ // Selvina
        { ingredientSku: "ING-050", quantity: 2 },    // Waffle de pandebono
        { ingredientSku: "ING-013", quantity: 100 },  // Helado de vainilla
        { ingredientSku: "ING-093", quantity: 50 },   // Cerezas
        { ingredientSku: "ING-071", quantity: 50 },   // Salsa de chocolate
        { ingredientSku: "ING-012", quantity: 40 },   // Crema chantilly
    ],
    "BOW-002": [ // Trópico
        { ingredientSku: "ING-103", quantity: 80 },   // Granola
        { ingredientSku: "ING-082", quantity: 100 },  // Mango
        { ingredientSku: "ING-083", quantity: 80 },   // Banano
        { ingredientSku: "ING-010", quantity: 100 },  // Yogurt griego
        { ingredientSku: "ING-122", quantity: 2 },    // Cúrcuma
        { ingredientSku: "ING-123", quantity: 1 },    // Pimienta
        { ingredientSku: "ING-120", quantity: 2 },    // Cardamomo
        { ingredientSku: "ING-084", quantity: 50 },   // Fresas
        { ingredientSku: "ING-085", quantity: 30 },   // Arándanos
        { ingredientSku: "ING-110", quantity: 20 },   // Chocolate amargo
        { ingredientSku: "ING-101", quantity: 30 },   // Almendras
    ],

    // PANU OZZOS
    "PANU-001": [ // Lomo al fuego
        { ingredientSku: "ING-047", quantity: 150 },  // Masa de panuozzo
        { ingredientSku: "ING-024", quantity: 120 },  // Lomo de cerdo
        { ingredientSku: "ING-035", quantity: 40 },   // Lechuga
        { ingredientSku: "ING-003", quantity: 50 },   // Mozzarella
    ],
    "PANU-002": [ // Plenitud
        { ingredientSku: "ING-047", quantity: 150 },  // Masa de panuozzo
        { ingredientSku: "ING-021", quantity: 80 },   // Jamón serrano
        { ingredientSku: "ING-130", quantity: 40 },   // Tomates secos
        { ingredientSku: "ING-080", quantity: 60 },   // Peras escalfadas
        { ingredientSku: "ING-138", quantity: 20 },   // Panela
        { ingredientSku: "ING-125", quantity: 3 },    // Canela
        { ingredientSku: "ING-007", quantity: 50 },   // Mozzarella de búfala
    ],
    "PANU-003": [ // Kundan
        { ingredientSku: "ING-047", quantity: 150 },  // Masa de panuozzo
        { ingredientSku: "ING-023", quantity: 100 },  // Pollo
        { ingredientSku: "ING-011", quantity: 30 },   // Mantequilla
        { ingredientSku: "ING-035", quantity: 40 },   // Lechuga
        { ingredientSku: "ING-003", quantity: 50 },   // Mozzarella
    ],
    "PANU-004": [ // Naime
        { ingredientSku: "ING-047", quantity: 150 },  // Masa de panuozzo
        { ingredientSku: "ING-065", quantity: 60 },   // Hummus
        { ingredientSku: "ING-132", quantity: 80 },   // Hamburguesa de quinoa
        { ingredientSku: "ING-030", quantity: 40 },   // Cebolla caramelizada
        { ingredientSku: "ING-032", quantity: 30 },   // Tomates cherry
        { ingredientSku: "ING-035", quantity: 40 },   // Lechuga
    ],

    // PIZZAS
    "PIZ-001": [ // La Emilia
        { ingredientSku: "ING-055", quantity: 200 },  // Masa para pizza
        { ingredientSku: "ING-061", quantity: 80 },   // Salsa napolitana
        { ingredientSku: "ING-130", quantity: 40 },   // Tomates secos
        { ingredientSku: "ING-021", quantity: 60 },   // Jamón serrano
        { ingredientSku: "ING-037", quantity: 10 },   // Albahaca
        { ingredientSku: "ING-007", quantity: 80 },   // Mozzarella de búfala
    ],
    "PIZ-002": [ // La Isabella
        { ingredientSku: "ING-055", quantity: 200 },  // Masa para pizza
        { ingredientSku: "ING-061", quantity: 80 },   // Salsa napolitana
        { ingredientSku: "ING-023", quantity: 100 },  // Pollo
        { ingredientSku: "ING-033", quantity: 50 },   // Champiñones
        { ingredientSku: "ING-070", quantity: 30 },   // Miel picante
        { ingredientSku: "ING-003", quantity: 80 },   // Mozzarella
    ],
    "PIZ-003": [ // Los Alpes
        { ingredientSku: "ING-055", quantity: 200 },  // Masa para pizza
        { ingredientSku: "ING-002", quantity: 60 },   // Base de queso crema
        { ingredientSku: "ING-080", quantity: 80 },   // Peras
        { ingredientSku: "ING-100", quantity: 40 },   // Nueces garrapiñadas
        { ingredientSku: "ING-005", quantity: 60 },   // Queso gruyere
        { ingredientSku: "ING-003", quantity: 60 },   // Mozzarella
    ],
    "PIZ-004": [ // Cielo mediterráneo
        { ingredientSku: "ING-055", quantity: 200 },  // Masa para pizza
        { ingredientSku: "ING-002", quantity: 60 },   // Base de queso crema
        { ingredientSku: "ING-081", quantity: 60 },   // Mora
        { ingredientSku: "ING-037", quantity: 10 },   // Albahaca
        { ingredientSku: "ING-006", quantity: 60 },   // Queso ricotta
        { ingredientSku: "ING-003", quantity: 60 },   // Mozzarella
    ],

    // TORTAS
    "TOR-001": [ // La Bananera
        { ingredientSku: "ING-153", quantity: 150 },  // Bizcocho de banano
        { ingredientSku: "ING-083", quantity: 100 },  // Banano
        { ingredientSku: "ING-002", quantity: 80 },   // Crema de queso
        { ingredientSku: "ING-100", quantity: 40 },   // Nueces garrapiñadas
    ],
    "TOR-002": [ // A la Orden de Orange
        { ingredientSku: "ING-153", quantity: 150 },  // Bizcocho
        { ingredientSku: "ING-039", quantity: 120 },  // Zanahoria
        { ingredientSku: "ING-100", quantity: 40 },   // Nueces
        { ingredientSku: "ING-002", quantity: 80 },   // Crema de queso
    ],
    "TOR-003": [ // Al borde de la tentación
        { ingredientSku: "ING-153", quantity: 150 },  // Bizcocho de chocolate
        { ingredientSku: "ING-110", quantity: 80 },   // Chocolate 65%
        { ingredientSku: "ING-112", quantity: 60 },   // Fudge
        { ingredientSku: "ING-071", quantity: 50 },   // Salsa de chocolate
    ],
    "TOR-004": [ // Una nueva primavera
        { ingredientSku: "ING-002", quantity: 150 },  // Queso crema
        { ingredientSku: "ING-009", quantity: 100 },  // Queso madurado
        { ingredientSku: "ING-056", quantity: 3 },    // Base de galleta
        { ingredientSku: "ING-094", quantity: 60 },   // Confitura de ciruelas
    ],
    "TOR-005": [ // En la Buena
        { ingredientSku: "ING-050", quantity: 100 },  // Pandebono
        { ingredientSku: "ING-049", quantity: 100 },  // Almojábana
        { ingredientSku: "ING-008", quantity: 100 },  // Queso campesino
    ],
    "TOR-006": [ // Carlota de mango biche
        { ingredientSku: "ING-057", quantity: 100 },  // Biscuit
        { ingredientSku: "ING-082", quantity: 120 },  // Mango biche
        { ingredientSku: "ING-090", quantity: 1 },    // Limón
        { ingredientSku: "ING-126", quantity: 5 },    // Tajín
    ],

    // POSTRES
    "POS-002": [ // Nuqui
        { ingredientSku: "ING-110", quantity: 100 },  // Brownie (ingrediente)
        { ingredientSku: "ING-100", quantity: 40 },   // Nueces
        { ingredientSku: "ING-013", quantity: 80 },   // Helado de vainilla
        { ingredientSku: "ING-071", quantity: 50 },   // Salsa de chocolate
        { ingredientSku: "ING-012", quantity: 40 },   // Crema chantilly
        { ingredientSku: "ING-056", quantity: 2 },    // Galleta
    ],
    "POS-003": [ // Rebeldes del pacífico
        { ingredientSku: "ING-046", quantity: 80 },   // Masa choux
        { ingredientSku: "ING-002", quantity: 50 },   // Crema de queso
        { ingredientSku: "ING-092", quantity: 60 },   // Durazno
        { ingredientSku: "ING-133", quantity: 40 },   // Crema de chontaduro
    ],
    "POS-004": [ // Chocolina
        { ingredientSku: "ING-056", quantity: 4 },    // Galleta de chocolate
        { ingredientSku: "ING-110", quantity: 40 },   // Chocolate
        { ingredientSku: "ING-134", quantity: 20 },   // Café
        { ingredientSku: "ING-067", quantity: 60 },   // Arequipe
        { ingredientSku: "ING-002", quantity: 40 },   // Queso
    ],
    "POS-005": [ // Brisa
        { ingredientSku: "ING-046", quantity: 100 },  // Masa choux
        { ingredientSku: "ING-091", quantity: 1 },    // Naranja
        { ingredientSku: "ING-120", quantity: 3 },    // Cardamomo
        { ingredientSku: "ING-121", quantity: 5 },    // Jengibre
    ],
    "POS-006": [ // Pannacotta
        { ingredientSku: "ING-057", quantity: 80 },   // Biscuit de melaza
        { ingredientSku: "ING-139", quantity: 30 },   // Melaza
        { ingredientSku: "ING-156", quantity: 100 },  // Pannacotta
        { ingredientSku: "ING-137", quantity: 20 },   // Aceite de oliva
        { ingredientSku: "ING-086", quantity: 50 },   // Uchuvas
        { ingredientSku: "ING-135", quantity: 20 },   // Ron
    ],
    "POS-007": [ // Las 3 niñas
        { ingredientSku: "ING-090", quantity: 2 },    // Limón
        { ingredientSku: "ING-087", quantity: 60 },   // Piña
        { ingredientSku: "ING-088", quantity: 60 },   // Lulo
        { ingredientSku: "ING-154", quantity: 60 },   // Merengue de almendras
        { ingredientSku: "ING-101", quantity: 40 },   // Almendras
    ],
    "BEB-001": [ // Café goloso
        { ingredientSku: "ING-134", quantity: 20 },   // Café
        { ingredientSku: "ING-052", quantity: 1 },    // Mantecada
        { ingredientSku: "ING-002", quantity: 40 },   // Crème brûlée
        { ingredientSku: "ING-151", quantity: 20 },   // Azúcar
        { ingredientSku: "ING-136", quantity: 15 },   // Aguardiente
    ],

    // GALLETAS
    "GAL-001": [ // Maracuyá
        { ingredientSku: "ING-056", quantity: 2 },    // Galleta de mantequilla
        { ingredientSku: "ING-111", quantity: 30 },   // Chocolate blanco
        { ingredientSku: "ING-089", quantity: 50 },   // Maracuyá
    ],
    "GAL-002": [ // Manjar blanco
        { ingredientSku: "ING-056", quantity: 2 },    // Galleta de mantequilla
        { ingredientSku: "ING-072", quantity: 60 },   // Manjar blanco
        { ingredientSku: "ING-002", quantity: 30 },   // Queso
        { ingredientSku: "ING-081", quantity: 40 },   // Mermelada de mora
    ],
}

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
        console.log(`\n🍽️  Creando recetas para ${Object.keys(recipes).length} platos...\n`)

        // Cambiar al schema del tenant
        await prisma.$executeRawUnsafe(`SET search_path TO "${tenant.id}", public`)

        let created = 0
        let errors = 0

        for (const [productSku, ingredients] of Object.entries(recipes)) {
            try {
                // Buscar el producto
                const product = await prisma.product.findFirst({
                    where: { sku: productSku }
                })

                if (!product) {
                    console.error(`❌ Producto ${productSku} no encontrado`)
                    errors++
                    continue
                }

                // Eliminar receta existente
                const existingRecipe = await prisma.recipe.findUnique({
                    where: { productId: product.id }
                })

                if (existingRecipe) {
                    await prisma.recipe.delete({
                        where: { id: existingRecipe.id }
                    })
                }

                // Crear la receta
                const recipe = await prisma.recipe.create({
                    data: {
                        productId: product.id,
                        yield: 1,
                        active: true
                    }
                })

                // Crear cada línea de la receta
                let ingredientsAdded = 0
                for (const ing of ingredients) {
                    const ingredient = await prisma.product.findFirst({
                        where: { sku: ing.ingredientSku }
                    })

                    if (!ingredient) {
                        console.log(`   ⚠️  Ingrediente ${ing.ingredientSku} no encontrado para ${productSku}`)
                        continue
                    }

                    await prisma.recipeItem.create({
                        data: {
                            recipeId: recipe.id,
                            ingredientId: ingredient.id,
                            quantity: ing.quantity
                        }
                    })
                    ingredientsAdded++
                }

                console.log(`✅ ${productSku} - ${product.name} (${ingredientsAdded}/${ingredients.length} ingredientes)`)
                created++

            } catch (error: any) {
                console.error(`❌ Error con ${productSku}: ${error.message}`)
                errors++
            }
        }

        console.log(`\n✅ Creación de recetas completada:`)
        console.log(`   - Recetas creadas: ${created}`)
        console.log(`   - Errores: ${errors}`)
        console.log(`   - Total platos: ${Object.keys(recipes).length}`)

    } catch (error) {
        console.error('❌ Error:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

main()
