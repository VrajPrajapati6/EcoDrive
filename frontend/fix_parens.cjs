const fs = require('fs');

const path = 'c:/Users/Prince/OneDrive/Documents/Hackathon/ODOO/frontend/src/pages/EmployeeDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

// find ) : ( \s* )\}
const regex = /\)\s*:\s*\(\s*\)/g;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log(`Match at index ${match.index}: ${match[0]}`);
}
// replace with ) : null
content = content.replace(/\)\s*:\s*\(\s*\)/g, ') : null');

// find ( \s* )
content = content.replace(/\(\s*\)/g, 'null');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed empty parens');
