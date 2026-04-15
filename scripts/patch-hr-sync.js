const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'lib', 'initialize-tenant.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Remove the broken partial insertion between restClient.end() block and Step 2.8
const restClientEnd = '    await restClient.end()\r\n  }\r\n';
const step28Marker = '  // Step 2.8: Sync PaymentMethod.dianCode column (added after initial schema)';

const restIdx = content.indexOf(restClientEnd);
const step28Idx = content.indexOf(step28Marker);

if (restIdx === -1 || step28Idx === -1) {
  console.error('Markers not found!', { restIdx, step28Idx });
  process.exit(1);
}

const beforeHR = content.substring(0, restIdx + restClientEnd.length);
const afterHR = content.substring(step28Idx);

const hrSyncBlock = `
  // Step 2.75: Sync HR/Payroll tables (for tenants created before HR module was added)
  logger.info(\`[STEP 2.75/4] Sincronizando tablas de Nomina/RRHH en "\${schemaName}"...\`)
  const hrClient = new Client({ connectionString: tenantSchemaUrl })
  try {
    await hrClient.connect()
    await hrClient.query(\`SET search_path TO "\${schemaName}"\`)

    await hrClient.query(\`
      CREATE TABLE IF NOT EXISTS "Employee" (
        "id" TEXT NOT NULL DEFAULT (gen_random_uuid()),
        "tenantId" TEXT NOT NULL,
        "documentType" TEXT NOT NULL,
        "documentNumber" TEXT NOT NULL,
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
        "email" TEXT,
        "phone" TEXT,
        "address" TEXT,
        "jobTitle" TEXT,
        "department" TEXT,
        "hireDate" TIMESTAMP(3) NOT NULL,
        "baseSalary" DOUBLE PRECISION NOT NULL,
        "salaryType" TEXT NOT NULL DEFAULT 'FIJO',
        "bankName" TEXT,
        "bankAccountType" TEXT,
        "bankAccountNumber" TEXT,
        "healthEntity" TEXT,
        "pensionEntity" TEXT,
        "arlEntity" TEXT,
        "compensationBox" TEXT,
        "paymentMethod" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "riskLevel" INTEGER NOT NULL DEFAULT 1,
        "contractType" TEXT NOT NULL DEFAULT 'INDEFINIDO',
        "workerType" TEXT NOT NULL DEFAULT '01',
        "workerSubType" TEXT NOT NULL DEFAULT '00',
        "municipality" TEXT,
        "integralSalary" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
      );
    \`)

    await hrClient.query(\`
      CREATE TABLE IF NOT EXISTS "PayrollPeriod" (
        "id" TEXT NOT NULL DEFAULT (gen_random_uuid()),
        "tenantId" TEXT NOT NULL,
        "periodName" TEXT NOT NULL,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3) NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "paidAt" TIMESTAMP(3),
        "transmittedAt" TIMESTAMP(3),
        "journalEntryId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
      );
    \`)

    await hrClient.query(\`
      CREATE TABLE IF NOT EXISTS "Payslip" (
        "id" TEXT NOT NULL DEFAULT (gen_random_uuid()),
        "tenantId" TEXT NOT NULL,
        "payrollPeriodId" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "documentNumber" TEXT,
        "cune" TEXT,
        "statusDIAN" TEXT NOT NULL DEFAULT 'PENDING',
        "dianResponse" JSONB,
        "signedAt" TIMESTAMP(3),
        "notes" TEXT,
        "baseSalary" DOUBLE PRECISION NOT NULL,
        "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
      );
    \`)

    await hrClient.query(\`
      CREATE TABLE IF NOT EXISTS "PayslipItem" (
        "id" TEXT NOT NULL DEFAULT (gen_random_uuid()),
        "payslipId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "concept" TEXT NOT NULL,
        "code" TEXT,
        "units" DOUBLE PRECISION,
        "unitType" TEXT,
        "amount" DOUBLE PRECISION NOT NULL,
        "percentage" DOUBLE PRECISION,
        "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PayslipItem_pkey" PRIMARY KEY ("id")
      );
    \`)

    // Indexes
    await hrClient.query(\`CREATE INDEX IF NOT EXISTS "Employee_tenantId_idx" ON "Employee"("tenantId")\`)
    await hrClient.query(\`CREATE UNIQUE INDEX IF NOT EXISTS "Employee_tenantId_documentNumber_key" ON "Employee"("tenantId", "documentNumber")\`)
    await hrClient.query(\`CREATE INDEX IF NOT EXISTS "PayrollPeriod_tenantId_idx" ON "PayrollPeriod"("tenantId")\`)
    await hrClient.query(\`CREATE UNIQUE INDEX IF NOT EXISTS "PayrollPeriod_journalEntryId_key" ON "PayrollPeriod"("journalEntryId")\`)
    await hrClient.query(\`CREATE INDEX IF NOT EXISTS "Payslip_tenantId_idx" ON "Payslip"("tenantId")\`)
    await hrClient.query(\`CREATE UNIQUE INDEX IF NOT EXISTS "Payslip_payrollPeriodId_employeeId_key" ON "Payslip"("payrollPeriodId", "employeeId")\`)
    await hrClient.query(\`CREATE INDEX IF NOT EXISTS "PayslipItem_payslipId_idx" ON "PayslipItem"("payslipId")\`)

    // Foreign Keys (idempotent)
    const hrFKs = [
      'ALTER TABLE "Employee" ADD CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE',
      'ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
      'ALTER TABLE "PayslipItem" ADD CONSTRAINT "PayslipItem_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    ]
    for (const fk of hrFKs) {
      await hrClient.query(\`DO $$ BEGIN \${fk}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;\`)
    }

    logger.info('[STEP 2.75/4] ✓ Tablas de Nómina/RRHH sincronizadas')
  } catch (hrErr: any) {
    logger.warn(\`[TENANT INIT] Warning during HR sync: \${hrErr.message}\`)
  } finally {
    await hrClient.end()
  }

`;

const newContent = beforeHR + '\r\n' + hrSyncBlock + '  ' + afterHR;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('✓ HR sync block inserted successfully');
console.log(`  File size: ${newContent.length} bytes`);
