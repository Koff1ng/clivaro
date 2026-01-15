# Costos de Deploy Diario en Firebase

## 📊 Planes de Firebase

### Plan Spark (Gratuito)
**Ideal para proyectos pequeños o desarrollo**

#### Firebase Hosting:
- ✅ **1 GB** de almacenamiento gratis
- ✅ **10 GB** de transferencia de datos al mes gratis
- ✅ **Deploy ilimitado** (no hay límite de deploys)
- ✅ **SSL/HTTPS** incluido
- ✅ **CDN global** incluido

#### Límites del Plan Gratuito:
- Si superas 1 GB de almacenamiento → Plan Blaze
- Si superas 10 GB de transferencia al mes → Plan Blaze

---

### Plan Blaze (Pago por Uso)
**Para aplicaciones en producción con mayor tráfico**

#### Firebase Hosting:
- **Almacenamiento**: $0.026 por GB/mes (después del 1 GB gratis)
- **Transferencia de datos**: $0.15 por GB (después de los 10 GB gratis)
- **Deploy**: **GRATIS** (no se cobra por deploy)

#### Ejemplo de Costos:

**Escenario 1: Proyecto Pequeño (dentro del plan gratuito)**
- Almacenamiento: 500 MB
- Transferencia: 5 GB/mes
- **Costo: $0/mes** ✅

**Escenario 2: Proyecto Mediano**
- Almacenamiento: 2 GB (1 GB gratis + 1 GB adicional)
- Transferencia: 20 GB/mes (10 GB gratis + 10 GB adicionales)
- Cálculo:
  - Almacenamiento: 1 GB × $0.026 = **$0.026/mes**
  - Transferencia: 10 GB × $0.15 = **$1.50/mes**
  - **Total: $1.53/mes** ≈ **$0.05/día**

**Escenario 3: Proyecto Grande**
- Almacenamiento: 5 GB (1 GB gratis + 4 GB adicionales)
- Transferencia: 100 GB/mes (10 GB gratis + 90 GB adicionales)
- Cálculo:
  - Almacenamiento: 4 GB × $0.026 = **$0.104/mes**
  - Transferencia: 90 GB × $0.15 = **$13.50/mes**
  - **Total: $13.60/mes** ≈ **$0.45/día**

---

## 💰 Costo de Deploy Diario

### **IMPORTANTE: El deploy en sí es GRATIS**

Firebase **NO cobra por hacer deploys**. Los costos son solo por:
1. **Almacenamiento** (archivos estáticos)
2. **Transferencia de datos** (ancho de banda)

### Despliegues Diarios:
- ✅ Puedes hacer **deploys ilimitados** sin costo adicional
- ✅ Cada deploy reemplaza el anterior (no acumula almacenamiento)
- ✅ Solo pagas por el almacenamiento final y el tráfico

---

## 📦 Para Aplicación Next.js

### Consideraciones Especiales:

#### Next.js con Firebase Hosting:
Next.js genera archivos estáticos y dinámicos. Para Next.js, necesitarías:

1. **Next.js Export (Static)**: 
   - Solo archivos estáticos
   - Se despliega en Firebase Hosting
   - **Costo**: Solo hosting (muy bajo)

2. **Next.js con Server-Side Rendering (SSR)**:
   - Necesitas **Firebase Functions** para el servidor
   - **Costo adicional**: Firebase Functions

#### Firebase Functions (si necesitas SSR):
- **Invocaciones**: 
  - Primeras 2 millones/mes: **GRATIS**
  - Después: $0.40 por millón de invocaciones
- **Tiempo de ejecución**:
  - Primeros 400,000 GB-segundo/mes: **GRATIS**
  - Después: $0.0000025 por GB-segundo

**Ejemplo con SSR:**
- 100,000 requests/mes con SSR
- Tiempo promedio: 200ms por request
- **Costo: $0** (dentro del tier gratuito) ✅

---

## 🆚 Alternativa: Vercel (Recomendado para Next.js)

### Vercel es **GRATIS** para proyectos personales:

#### Plan Hobby (Gratuito):
- ✅ **Deploy ilimitado**
- ✅ **100 GB** de transferencia al mes
- ✅ **100 GB** de almacenamiento
- ✅ **SSL/HTTPS** automático
- ✅ **CDN global**
- ✅ **Serverless Functions** incluidas
- ✅ **Optimizado para Next.js**

#### Plan Pro ($20/mes):
- ✅ Todo del plan Hobby
- ✅ **1 TB** de transferencia al mes
- ✅ **Analytics** avanzado
- ✅ **Soporte prioritario**

### Comparación:

| Característica | Firebase Hosting | Vercel |
|----------------|------------------|--------|
| Deploy diario | ✅ Gratis | ✅ Gratis |
| Almacenamiento gratis | 1 GB | 100 GB |
| Transferencia gratis | 10 GB/mes | 100 GB/mes |
| Optimizado para Next.js | ⚠️ Requiere config | ✅ Nativo |
| SSR/API Routes | ⚠️ Requiere Functions | ✅ Incluido |
| **Costo típico/mes** | $0-15 | **$0-20** |

---

## 💡 Recomendación para tu Proyecto

### Para una aplicación Next.js como la tuya:

#### Opción 1: Vercel (Recomendado) ⭐
- **Costo**: $0/mes (plan Hobby)
- **Ventajas**:
  - Optimizado para Next.js
  - Deploy automático desde Git
  - Serverless Functions incluidas
  - Mejor rendimiento para Next.js
  - Más fácil de configurar

#### Opción 2: Firebase Hosting + Functions
- **Costo**: $0-15/mes (depende del tráfico)
- **Ventajas**:
  - Integración con otros servicios Firebase
  - Buena para proyectos que ya usan Firebase
- **Desventajas**:
  - Requiere más configuración para Next.js
  - Functions tienen límites en plan gratuito

#### Opción 3: Firebase Hosting (Solo Static)
- **Costo**: $0-5/mes (muy bajo)
- **Limitación**: Solo páginas estáticas (sin SSR/API Routes)

---

## 📈 Estimación de Costos Mensuales

### Escenario Realista para tu Aplicación:

**Suposiciones:**
- Aplicación Next.js con SSR
- 1,000 usuarios activos/mes
- 50,000 page views/mes
- Deploy diario (30 deploys/mes)

#### Con Vercel (Plan Hobby):
- **Costo: $0/mes** ✅
- Dentro de todos los límites gratuitos

#### Con Firebase Hosting + Functions:
- Hosting: $0 (dentro de 1 GB y 10 GB)
- Functions: $0 (dentro de 2M invocaciones)
- **Costo: $0/mes** ✅

#### Con Firebase Hosting (Solo Static):
- Hosting: $0 (dentro de límites)
- **Costo: $0/mes** ✅

---

## 🎯 Conclusión

### Para Deploy Diario:

1. **El deploy en sí es GRATIS** en Firebase y Vercel
2. **Costo mensual típico**: $0-5 para proyectos pequeños/medianos
3. **Recomendación**: Usa **Vercel** para Next.js (más fácil y optimizado)

### Costo Real:
- **Deploy diario**: $0 (gratis)
- **Hosting mensual**: $0-15 (depende del tráfico)
- **Total estimado**: **$0-15/mes** para la mayoría de proyectos

---

## 📝 Notas Importantes

1. **Firebase no cobra por deploy**: Solo por almacenamiento y transferencia
2. **Vercel es gratis** para proyectos personales y pequeños
3. **Para Next.js**, Vercel es la opción más simple y económica
4. **Los costos escalan** solo si tienes mucho tráfico (>100 GB/mes)

---

## 🔗 Enlaces Útiles

- [Firebase Pricing](https://firebase.google.com/pricing)
- [Vercel Pricing](https://vercel.com/pricing)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Última actualización**: 2024  
**Nota**: Los precios pueden cambiar. Verifica en los sitios oficiales.

