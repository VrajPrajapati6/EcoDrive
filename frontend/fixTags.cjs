const fs = require('fs');
const path = 'c:/Users/Prince/OneDrive/Documents/Hackathon/ODOO/frontend/src/pages/EmployeeDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

const findEnding = `                    ))}
                  </div>
                )}
              </div>`;

if (content.includes(findEnding)) {
    content = content.replace(findEnding, findEnding + '\n            </div>');
}

const offerEnding = `                      </div>
                    ))}
                  </div>
                </div>
              )}`;

if (content.includes(offerEnding)) {
    content = content.replace(offerEnding, offerEnding + '\n            </div>');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed missing div tags!');
