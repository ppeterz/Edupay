import fs from 'fs';
import path from 'path';

const envLocalPath = path.resolve('.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const matched = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (matched) {
      const key = matched[1];
      let value = matched[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\n/g, '\n');
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      process.env[key] = value.trim();
    }
  });
}

const accountId = process.env.NOMBA_ACCOUNT_ID;
const clientId = process.env.NOMBA_CLIENT_ID;
const clientSecret = process.env.NOMBA_CLIENT_SECRET;
const subAccountId = process.env.NOMBA_SUB_ACCOUNT_ID;

const nombaTransferId = "API-TRANSFER-AE431-976a85a2-8664-4542-be95-59b9dcdc0931";
const sessionId = "090645260706091417397388249288";

async function testEndpoint(name, url, method = 'GET') {
  console.log(`\n--- Test: ${name} ---`);
  console.log('URL:', url);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${process.env.BEARER_TOKEN}`,
        'accountId': accountId,
      },
    });
    console.log('HTTP Status:', res.status);
    console.log('Response Body:', await res.text());
  } catch (err) {
    console.error('Failed:', err);
  }
}

async function run() {
  // 1. Authenticate
  const authRes = await fetch('https://api.nomba.com/v1/auth/token/issue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accountId': accountId,
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const authData = await authRes.json();
  process.env.BEARER_TOKEN = authData.data.access_token;

  // Endpoint 1: GET /v1/transactions/requery/{sessionId}
  await testEndpoint(
    'GET /v1/transactions/requery/{sessionId}',
    `https://api.nomba.com/v1/transactions/requery/${sessionId}`
  );

  // Endpoint 2: GET /v1/transactions/requery/{nombaTransferId}
  await testEndpoint(
    'GET /v1/transactions/requery/{nombaTransferId}',
    `https://api.nomba.com/v1/transactions/requery/${nombaTransferId}`
  );

  // Endpoint 3: GET /v1/transactions/accounts/{subAccountId}/single?transactionRef={nombaTransferId}
  await testEndpoint(
    'GET /v1/transactions/accounts/{subAccountId}/single?transactionRef={nombaTransferId}',
    `https://api.nomba.com/v1/transactions/accounts/${subAccountId}/single?transactionRef=${nombaTransferId}`
  );

  // Endpoint 4: GET /v1/transactions/accounts/single?transactionRef={nombaTransferId}
  await testEndpoint(
    'GET /v1/transactions/accounts/single?transactionRef={nombaTransferId}',
    `https://api.nomba.com/v1/transactions/accounts/single?transactionRef=${nombaTransferId}`
  );
  
  // Endpoint 5: GET /v1/transactions/transaction-requery/{sessionId} (Retry)
  await testEndpoint(
    'GET /v1/transactions/transaction-requery/{sessionId}',
    `https://api.nomba.com/v1/transactions/transaction-requery/${sessionId}`
  );
}

run().catch(console.error);
