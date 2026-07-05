const fs = require('fs');
const path = require('path');

const dirToCheck = path.join(__dirname, '../.next/static');

const secrets = [
  "NOMBA_CLIENT_SECRET",
  "FIREBASE_PRIVATE_KEY",
  "CLOUDINARY_API_SECRET",
  "NombaHackathon2026"
];

function checkDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory ${dir} does not exist. Run npm run build first.`);
    return;
  }

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      checkDirectory(filePath);
    } else if (stat.isFile()) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const secret of secrets) {
        if (content.includes(secret)) {
          console.log(`❌ LEAK DETECTED in ${filePath}: Found secret reference "${secret}"`);
          process.exitCode = 1;
        }
      }
    }
  }
}

console.log(`Checking ${dirToCheck} for client-side secret leaks...`);
checkDirectory(dirToCheck);

if (!process.exitCode) {
  console.log('✅ clean');
}
