const fs = require('fs');
const path = require('path');

function replaceImports(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory() && file.name !== 'node_modules') {
            replaceImports(fullPath);
        } else if (file.isFile() && fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            const replacements = [
                { regex: /require\(['"`](\.\.\/|\.\/)*config\/db['"`]\)/g, repl: 'require("@rollup/shared").db' },
                { regex: /require\(['"`](\.\.\/|\.\/)*config\/redis['"`]\)/g, repl: 'require("@rollup/shared").redis' },
                { regex: /require\(['"`](\.\.\/|\.\/)*models\/txModel['"`]\)/g, repl: 'require("@rollup/shared").TxModel' },
                { regex: /require\(['"`](\.\.\/|\.\/)*models\/blockModel['"`]\)/g, repl: 'require("@rollup/shared").BlockModel' },
                { regex: /require\(['"`](\.\.\/|\.\/)*utils\/metrics['"`]\)/g, repl: 'require("@rollup/shared").metrics' },
                { regex: /require\(['"`](\.\.\/|\.\/)*utils\/merkle['"`]\)/g, repl: 'require("@rollup/shared").merkle' },
                { regex: /require\(['"`](\.\.\/|\.\/)*queue\/txQueue['"`]\)/g, repl: 'require("@rollup/shared").txQueue' }
            ];

            for (const r of replacements) {
                if (r.regex.test(content)) {
                    content = content.replace(r.regex, r.repl);
                    modified = true;
                }
            }

            // Fix metric destructurings that we just broke
            // e.g. const { activeStake } = require("@rollup/shared").metrics;
            // which is fine, but if it was `const { ... } = require(...)` it's fine too because require returns an object.
            
            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed imports in ' + fullPath);
            }
        }
    }
}

replaceImports('./backend/src');
replaceImports('./sequencer/src');
replaceImports('./da-service/src');
