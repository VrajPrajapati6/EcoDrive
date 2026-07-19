const fs = require('fs');
const path = 'c:/Users/Prince/OneDrive/Documents/Hackathon/ODOO/frontend/src/pages/EmployeeDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

const icons = [
  'History', 'PlusCircle', 'AlertCircle', 'ShieldCheck', 'PlayCircle', 'Zap', 
  'CheckCircle', 'XCircle', 'ArrowUpCircle', 'TrendingUp', 'ReceiptText'
];

icons.forEach(icon => {
  const regex = new RegExp(`<${icon}\\b[^>]*\\/>`, 'g');
  content = content.replace(regex, '<></>');
  const regexOpenClose = new RegExp(`<${icon}\\b[^>]*>.*?<\\/${icon}>`, 'g');
  content = content.replace(regexOpenClose, '<></>');
});

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed remaining icons in EmployeeDashboard');
