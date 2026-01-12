const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const GLOBAL_EXTENSIONS_DIR = path.join(os.homedir(), '.gemini/extensions');
const MANIFEST_PATH = path.join(process.cwd(), '.gemini-extensions.json');

console.log('🌍 Gemini Global Extension Manager');
console.log('==================================');

// 1. Ensure "Must-Have" Extensions (from manifest) are installed
if (fs.existsSync(MANIFEST_PATH)) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const extensions = manifest.extensions || {};
    
    console.log('\n📦 Verifying Manifest Extensions...');
    Object.entries(extensions).forEach(([name, config]) => {
        const repoUrl = config.source;
        try {
            // We blindly try to install. The CLI handles "already installed" or "exists" logic mostly.
            // We use stdio: 'pipe' to suppress the noisy output unless it fails.
            execSync(`gemini extensions install ${repoUrl} --consent`, { stdio: 'pipe' });
            console.log(`  ✅ ${name}: Installed.`);
        } catch (installErr) {
            const output = installErr.stdout?.toString() || installErr.stderr?.toString() || "";
            if (output.includes("already installed")) {
                console.log(`  ✓ ${name}: Present.`);
            } else {
                console.log(`  ⚠️  ${name}: Install issue (might be local dev or invalid URL).`);
            }
        }
    });
}

// 2. Scan and Hydrate ALL Extensions
if (fs.existsSync(GLOBAL_EXTENSIONS_DIR)) {
    console.log(`\n💧 Hydrating All Extensions in ${GLOBAL_EXTENSIONS_DIR}...`);
    const entries = fs.readdirSync(GLOBAL_EXTENSIONS_DIR, { withFileTypes: true });

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    entries.forEach(entry => {
        if (entry.isDirectory()) {
            const extName = entry.name;
            const extPath = path.join(GLOBAL_EXTENSIONS_DIR, extName);
            const packageJsonPath = path.join(extPath, 'package.json');

            // Skip hidden folders or node_modules if they somehow got here
            if (extName.startsWith('.') || extName === 'node_modules') return;

            process.stdout.write(`  Processing ${extName.padEnd(30)} `);

            if (fs.existsSync(packageJsonPath)) {
                try {
                    // Check if node_modules exists to skip if possible, but for robustness we might want to ensure.
                    // For speed, let's trust package-lock if node_modules exists, but 'npm install' is usually smart.
                    // Using --production to skip devDeps (saves time/space) and --no-audit for speed.
                    execSync('npm install --production --no-audit --no-fund', { cwd: extPath, stdio: 'pipe' });
                    console.log(`✅ Ready`);
                    successCount++;
                } catch (e) {
                    console.log(`❌ Failed: ${e.message.split('\n')[0]}`);
                    failCount++;
                }
            } else {
                console.log(`⚪ No deps (static/python?)`);
                skipCount++;
            }
        }
    });

    console.log(`\n🎉 Summary: ${successCount} hydrated, ${skipCount} skipped (no package.json), ${failCount} failed.`);

} else {
    console.error(`❌ Global extension directory not found: ${GLOBAL_EXTENSIONS_DIR}`);
}
