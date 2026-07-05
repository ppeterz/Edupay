const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const splitIdx = trimmed.indexOf('=');
    if (splitIdx === -1) continue;
    const key = trimmed.slice(0, splitIdx).trim();
    let val = trimmed.slice(splitIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const sa = {
  type: "service_account",
  project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
};

const saPath = path.join(__dirname, 'service-account.json');
fs.writeFileSync(saPath, JSON.stringify(sa, null, 2));
console.log('Temporary service account JSON written.');

try {
  console.log('Deploying firestore.rules to project:', sa.project_id);
  // Set the environment variable for Google Application Credentials and run firebase deploy
  const cmd = `npx firebase-tools deploy --only firestore:rules --project ${sa.project_id}`;
  
  // Set env in child process
  const output = execSync(cmd, {
    env: {
      ...process.env,
      GOOGLE_APPLICATION_CREDENTIALS: saPath
    },
    stdio: 'inherit'
  });
  console.log('Rules deploy command output completed.');
} catch (err) {
  console.error('Error deploying rules:', err);
} finally {
  if (fs.existsSync(saPath)) {
    fs.unlinkSync(saPath);
    console.log('Temporary service account JSON deleted.');
  }
}
