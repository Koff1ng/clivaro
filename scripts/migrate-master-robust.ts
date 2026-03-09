import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function migrateMaster() {
    // Manually read .env to avoid dependency on dotenv
    let databaseUrl = '';
    let directUrl = '';

    try {
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const lines = envContent.split('\n');
            for (const line of lines) {
                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
                if (key.trim() === 'DATABASE_URL') databaseUrl = value;
                if (key.trim() === 'DIRECT_URL') directUrl = value;
            }
        }
    } catch (e) {
        console.warn('Error leyendo .env:', e);
    }

    const connectionString = directUrl || databaseUrl;
    if (!connectionString) {
        console.error('Error: DATABASE_URL o DIRECT_URL no encontrados.');
        process.exit(1);
    }

    console.log('--- Iniciando migración de base de datos maestra (public) ---');
    console.log(`Usando conexión: ${connectionString.substring(0, 30)}...`);

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Conectado a la base de datos maestra.');

        const sql = `
      ALTER TABLE public."User" 
      ADD COLUMN IF NOT EXISTS "legalAccepted" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "legalAcceptedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "legalVersion" TEXT,
      ADD COLUMN IF NOT EXISTS "marketingAccepted" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "acceptanceIp" TEXT;
    `;

        console.log('Ejecutando ALTER TABLE en public."User"...');
        await client.query(sql);
        console.log('✓ Migración de esquema maestra exitosa.');

    } catch (error) {
        console.error('Error durante la migración:', error);
    } finally {
        await client.end();
        console.log('Conexión cerrada.');
    }
}

migrateMaster();
