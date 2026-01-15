# API Documentation

## Overview

This document describes the REST API endpoints available in the application.

## Authentication

All API endpoints require authentication via NextAuth.js session cookies.

## Base URL

- Development: `http://localhost:3000`
- Production: Configure via `NEXT_PUBLIC_BASE_URL`

## Common Response Formats

### Success Response
```json
{
  "data": {...}
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

## Endpoints

### Customers

#### GET /api/customers
Get list of customers with pagination and search.

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 20): Items per page
- `search` (string, optional): Search term (name, email, phone)

**Response:**
```json
{
  "customers": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### POST /api/customers
Create a new customer.

**Request Body:**
```json
{
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "+1234567890",
  "address": "Address",
  "taxId": "TAX123",
  "tags": ["tag1", "tag2"],
  "notes": "Notes"
}
```

#### GET /api/customers/[id]
Get customer details by ID.

#### PUT /api/customers/[id]
Update customer.

#### DELETE /api/customers/[id]
Deactivate customer (soft delete).

---

### Products

#### GET /api/products
Get list of products with pagination and search.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `search` (string, optional): Search by name, SKU, or barcode

**Response:**
```json
{
  "products": [...],
  "pagination": {...}
}
```

#### POST /api/products
Create a new product.

**Request Body:**
```json
{
  "name": "Product Name",
  "sku": "SKU123",
  "barcode": "123456789",
  "price": 100.00,
  "cost": 50.00,
  "taxRate": 19,
  "trackStock": true,
  "categoryId": "category-id",
  "variants": [...]
}
```

---

### Sales

#### GET /api/quotations
Get list of quotations.

#### POST /api/quotations
Create a new quotation.

#### GET /api/quotations/[id]
Get quotation details.

#### POST /api/quotations/[id]/send
Send quotation via email.

#### POST /api/quotations/[id]/convert
Convert quotation to invoice.

---

### Invoices

#### GET /api/invoices
Get list of invoices.

#### GET /api/invoices/[id]
Get invoice details.

#### POST /api/invoices/[id]/send-electronic
Send invoice to electronic billing system.

---

### Inventory

#### GET /api/inventory/stock-levels
Get stock levels for all products.

#### POST /api/inventory/adjustment
Create stock adjustment.

#### POST /api/inventory/transfer
Transfer stock between warehouses.

#### GET /api/inventory/movements
Get inventory movements with filters.

**Query Parameters:**
- `startDate` (string, ISO date)
- `endDate` (string, ISO date)
- `warehouseId` (string, optional)
- `productId` (string, optional)

---

### POS

#### POST /api/pos/sale
Create a POS sale.

**Request Body:**
```json
{
  "items": [
    {
      "productId": "product-id",
      "variantId": "variant-id (optional)",
      "quantity": 2,
      "unitPrice": 100.00,
      "discount": 0,
      "taxRate": 19
    }
  ],
  "customerId": "customer-id (optional)",
  "warehouseId": "warehouse-id",
  "paymentMethod": "CASH" | "CARD" | "TRANSFER",
  "cashReceived": 200.00,
  "discount": 0
}
```

**Response:**
```json
{
  "invoiceNumber": "FV-000001",
  "total": 238.00,
  "change": 0
}
```

---

### Cash Management

#### GET /api/cash/shifts
Get cash shifts.

#### POST /api/cash/shifts
Open a new cash shift.

**Request Body:**
```json
{
  "startingCash": 1000.00
}
```

#### POST /api/cash/shifts/[id]/close
Close a cash shift.

**Request Body:**
```json
{
  "endingCash": 1500.00,
  "notes": "Shift notes"
}
```

#### POST /api/cash/movements
Create a cash movement.

---

### Dashboard

#### GET /api/dashboard/stats
Get dashboard statistics.

**Response:**
```json
{
  "salesToday": 5000.00,
  "salesMonth": 150000.00,
  "totalProducts": 500,
  "lowStockCount": 10
}
```

#### GET /api/dashboard/top-products
Get top selling products.

#### GET /api/dashboard/monthly-report
Get monthly sales report.

---

### Marketing

#### GET /api/marketing/campaigns
Get list of marketing campaigns.

#### POST /api/marketing/campaigns
Create a new campaign.

#### GET /api/marketing/campaigns/[id]
Get campaign details.

#### POST /api/marketing/campaigns/[id]/send
Send campaign to recipients.

#### POST /api/marketing/campaigns/[id]/recipients
Add recipients to campaign.

---

## Error Codes

- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

The API includes rate limiting:

- **Authenticated endpoints**: enforced via `requirePermission` / `requireAnyPermission` in `lib/api-middleware.ts`
  - Defaults: `GET/HEAD → read`, `POST/PUT/PATCH/DELETE → write`
  - Keyed by **tenantId + userId + IP + path**
- **Public endpoints**: enforced explicitly (keyed by IP)
  - `GET /api/tenants/verify`
  - `POST /api/contact`

### Production (Vercel/serverless)
For distributed rate limiting, configure Upstash Redis REST:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Without Upstash, the system falls back to in-memory limiting (OK for local dev, not reliable on serverless).

## Pagination

Most list endpoints support pagination with `page` and `limit` query parameters.

## Search

Search is case-insensitive and supports partial matching on relevant fields.

