# Component Documentation

## Overview

This document describes the main React components in the application.

## UI Components

### Toast (`components/ui/toast.tsx`)

Notification system for user feedback.

**Usage:**
```tsx
import { useToast } from '@/components/ui/toast'

function MyComponent() {
  const { toast } = useToast()
  
  toast('Success message', 'success')
  toast('Error message', 'error')
  toast('Warning message', 'warning')
  toast('Info message', 'info')
}
```

**Types:**
- `success` - Green notification
- `error` - Red notification
- `warning` - Yellow notification
- `info` - Blue notification

### Error Boundary (`components/ui/error-boundary.tsx`)

Catches React errors and displays fallback UI.

**Usage:**
```tsx
import { ErrorBoundary } from '@/components/ui/error-boundary'

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

### DatePicker (`components/ui/date-picker.tsx`)

Visual date picker component.

**Usage:**
```tsx
import { DatePicker } from '@/components/ui/date-picker'

<DatePicker
  value={date}
  onChange={setDate}
/>
```

## Feature Components

### POS Screen (`components/pos/pos-screen.tsx`)

Main point of sale interface.

**Features:**
- Product search with debouncing
- Shopping cart management
- Multiple payment methods
- Customer selection
- Real-time stock validation

### Customer List (`components/crm/customer-list.tsx`)

Displays paginated list of customers.

**Features:**
- Search with debouncing
- Pagination
- Create/Edit/View/Delete actions
- Lazy loading of forms

### Product List (`components/products/list.tsx`)

Displays paginated list of products.

**Features:**
- Search with debouncing
- Pagination
- Category filtering
- Stock level indicators

### Canva Editor (`components/marketing/canva-editor.tsx`)

Visual drag-and-drop email campaign editor.

**Features:**
- Drag and drop elements
- Text editing (double-click)
- Image upload
- Background images
- Z-index management
- Link insertion
- Templates

## Performance Optimizations

### Lazy Loading

Heavy components are loaded dynamically:

```tsx
const CustomerForm = dynamic(() => import('./customer-form'), {
  loading: () => <div>Cargando...</div>,
})
```

### Memoization

Components use `useMemo` and `useCallback` to prevent unnecessary re-renders.

### Debouncing

Search inputs use debouncing to reduce API calls:

```tsx
const debouncedSearch = useDebounce(search, 300)
```

## Best Practices

1. **Always use toast instead of alert()** for user notifications
2. **Wrap components in ErrorBoundary** for error handling
3. **Use lazy loading** for heavy components
4. **Implement debouncing** for search inputs
5. **Use React Query** for data fetching and caching
6. **Memoize expensive calculations** with `useMemo`
7. **Stabilize callbacks** with `useCallback`

