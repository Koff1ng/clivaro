/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimizaciones de rendimiento
  compress: true, // Habilitar compresión gzip
  poweredByHeader: false, // Ocultar header X-Powered-By
  reactStrictMode: true, // Habilitar modo estricto de React
  
  // Optimización de imágenes
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Optimización de bundle
  swcMinify: true, // Usar SWC para minificación (más rápido que Terser)
  
  // Excluir paquetes del procesamiento de webpack (solo servidor)
  serverComponentsExternalPackages: [
    'puppeteer-core',
    '@sparticuz/chromium',
  ],
  
  // Configuración de webpack para excluir puppeteer-core del procesamiento
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Excluir puppeteer-core y sus dependencias del procesamiento de webpack
      config.externals = config.externals || []
      config.externals.push({
        'puppeteer-core': 'commonjs puppeteer-core',
        '@sparticuz/chromium': 'commonjs @sparticuz/chromium',
      })
      
      // Ignorar módulos problemáticos
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    
    return config
  },
  
  // Headers de seguridad y rendimiento
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig

