const fs = require('fs');

const path = 'c:/Users/Prince/OneDrive/Documents/Hackathon/ODOO/frontend/src/pages/EmployeeDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /<MapDisplay[\s\S]*?\/>/g;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log(`Match at index ${match.index}:\n${match[0]}\n---`);
}
