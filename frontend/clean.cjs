const fs = require('fs');

const path = 'c:/Users/Prince/OneDrive/Documents/Hackathon/ODOO/frontend/src/pages/EmployeeDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

const icons = [
  'MapPin', 'Clock', 'Users', 'Car', 'Phone', 'Search', 'CreditCard', 'Wallet', 
  'ArrowRight', 'CheckCircle2', 'ShieldAlert', 'Star', 'MessageSquare', 'MoreVertical',
  'ChevronDown', 'ChevronUp', 'X', 'Plus', 'Minus', 'Download', 'Upload', 'Settings',
  'LogOut', 'Bell', 'Video', 'Mic', 'MicOff', 'PhoneOff', 'Calendar', 'Briefcase',
  'Navigation', 'Compass', 'AlertTriangle', 'Send', 'Info', 'Check'
];

content = content.replace(/import\s+\{([^}]+)\}\s+from\s+["']lucide-react["'];/g, '');

icons.forEach(icon => {
  const regex = new RegExp(`<${icon}\\b[^>]*\\/>`, 'g');
  content = content.replace(regex, '');
  const regexOpenClose = new RegExp(`<${icon}\\b[^>]*>.*?<\\/${icon}>`, 'g');
  content = content.replace(regexOpenClose, '');
});

const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
content = content.replace(emojiRegex, '');

fs.writeFileSync(path, content, 'utf8');
console.log('EmployeeDashboard cleaned');
