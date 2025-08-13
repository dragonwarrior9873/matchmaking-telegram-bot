const fs = require('fs');
const path = require('path');

// Define emoji patterns to remove (keep ✅)
const emojiPatterns = [
  '📱', '⛓️', '🚀', '🔗', '💰', '🏷️', '📝', '📅', '🎉', '🤖', '🔄', '💔', '👀', 
  '📊', '💡', '📢', '🏠', '⏭️', '✏️', '📈', '📉', '🎯', '👍', '👎', '💕', '❤️', 
  '🔥', '💖', '🤝', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'
];

function removeEmojisFromFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Remove each emoji pattern
    emojiPatterns.forEach(emoji => {
      const regex = new RegExp(emoji, 'g');
      if (content.includes(emoji)) {
        content = content.replace(regex, '');
        modified = true;
      }
    });
    
    // Clean up extra spaces and formatting
    if (modified) {
      // Remove double spaces
      content = content.replace(/  +/g, ' ');
      // Remove space at beginning of lines
      content = content.replace(/^\s+/gm, (match) => match.replace(/ /g, ''));
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Process TypeScript files in src directory
const srcDir = './src';
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (file.endsWith('.ts')) {
      removeEmojisFromFile(fullPath);
    }
  });
}

processDirectory(srcDir);
console.log('Emoji removal complete!');
