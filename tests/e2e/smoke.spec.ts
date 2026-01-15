import { test, expect } from '@playwright/test'

test.describe('Smoke Tests', () => {
  test('should login and navigate to dashboard', async ({ page }) => {
    await page.goto('/login')
    
    // Login
    await page.fill('input[type="email"]', 'admin@local')
    await page.fill('input[type="password"]', 'Admin123!')
    await page.click('button[type="submit"]')
    
    // Wait for navigation
    await page.waitForURL('/dashboard')
    
    // Check dashboard is visible
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('should create a product', async ({ page }) => {
    await page.goto('/login')
    
    // Login
    await page.fill('input[type="email"]', 'admin@local')
    await page.fill('input[type="password"]', 'Admin123!')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('/dashboard')
    
    // Navigate to products
    await page.click('text=Productos')
    await page.waitForURL('/products')
    
    // Click new product button
    await page.click('text=Nuevo Producto')
    
    // Fill form
    await page.fill('input[id="sku"]', 'TEST-001')
    await page.fill('input[id="name"]', 'Producto de Prueba')
    await page.fill('input[id="cost"]', '10')
    await page.fill('input[id="price"]', '20')
    
    // Submit
    await page.click('button[type="submit"]')
    
    // Wait for dialog to close and product to appear
    await page.waitForTimeout(1000)
    
    // Verify product appears in list
    await expect(page.locator('text=Producto de Prueba')).toBeVisible()
  })

  test('should access POS and search products', async ({ page }) => {
    await page.goto('/login')
    
    // Login
    await page.fill('input[type="email"]', 'cashier@local')
    await page.fill('input[type="password"]', 'Cashier123!')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('/dashboard')
    
    // Navigate to POS
    await page.click('text=Punto de Venta')
    await page.waitForURL('/pos')
    
    // Search for product
    await page.fill('input[placeholder*="Buscar"]', 'Martillo')
    await page.waitForTimeout(500)
    
    // Verify search results appear
    await expect(page.locator('text=Martillo')).toBeVisible({ timeout: 5000 })
  })
})

