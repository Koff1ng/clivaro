const { TENANT_SQL_STATEMENTS } = require('../lib/tenant-sql-statements.js');

const tenantTable = TENANT_SQL_STATEMENTS.find(s => s.includes('CREATE TABLE "Tenant"'));
console.log('Tenant Table SQL:');
console.log(tenantTable);

const userTable = TENANT_SQL_STATEMENTS.find(s => s.includes('CREATE TABLE "User"'));
console.log('\nUser Table SQL:');
console.log(userTable);
