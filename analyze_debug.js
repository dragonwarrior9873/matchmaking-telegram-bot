// Exact message from debug output
const message = `✏️ **Edit Your Token**

You already have a registered token. Here's your current information:

🚀 **sdfsdf**
🔗 **Contract:** \`dfsdfwefsdfw\`
⛓️ **Chains:** Arbitrum
💰 **Market Cap:** MATCH_ANYTHING
🏷️ **Categories:** Play-to-Earn, Launchpad
📝 **Description:** sdfwesdfwefsdfwefsdfwef

📱 **Community:**
• [X (Twitter)](https://x.com/sdf)

**Admins:** @aidappdev

Would you like to edit this information?`;

console.log('Message length:', message.length);
console.log('Byte at offset 203:', message.charCodeAt(203));
console.log('Character at offset 203: "' + message[203] + '"');

// Check around byte offset 203
console.log('\nContext around offset 203:');
for (let i = 195; i < 210; i++) {
  const char = message[i];
  const code = message.charCodeAt(i);
  console.log(`${i}: "${char}" (${code}) ${char === '\n' ? '<newline>' : ''}`);
}

// Look for potential markdown issues
console.log('\nLooking for unmatched markdown entities:');
const markdownChars = ['*', '_', '`', '[', ']', '(', ')'];
for (let char of markdownChars) {
  const count = (message.match(new RegExp('\\' + char, 'g')) || []).length;
  console.log(`${char}: ${count} occurrences`);
}
