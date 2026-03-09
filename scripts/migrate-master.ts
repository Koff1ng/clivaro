import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function migrateMaster() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('Error: DATABASE_URL o DIRECT_URL no configurados en .env');
        process.exit(1);
    }

    console.log('--- Iniciando migración de base de datos maestra (public) ---');
    console.log(`Usando conexión: ${connectionString.substring(0, 20)}...`);

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Conectado a la base de datos.');

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
        console.log('✓ Migración exitosa.');

    } catch (error) {
        console.error('Error durante la migración:', error);
    } finally {
        await client.end();
        console.log('Conexión cerrada.');
    }
}

migrateMaster();
