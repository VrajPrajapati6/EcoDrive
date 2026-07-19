const fs = require('fs');
const path = 'c:/Users/Prince/OneDrive/Documents/Hackathon/ODOO/frontend/src/pages/EmployeeDashboard.jsx';
const content = fs.readFileSync(path, 'utf8');

const regex = /<([A-Z][a-zA-Z0-9]*)\b/g;
let match;
const tags = new Set();
while ((match = regex.exec(content)) !== null) {
  tags.add(match[1]);
}
console.log(Array.from(tags).join(', '));
