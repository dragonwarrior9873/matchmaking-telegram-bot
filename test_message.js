// Test the exact message content from the user's output
const message = `🎉 **Token registered successfully!**

🚀 Token Name : **sdfsdf**
🔗 **Contract:** \`dfsdfwefsdfw\`
⛓️ **Chains:** Arbitrum
🏷️ **Categories:** Play-to-Earn, Launchpad
📝 **Description:** sdfwesdfwefsdfwefsdfwef

📱 **Community:**
• [X (Twitter)](https://x.com/sdf)
📅 **Registered:** 8/13/2025

**Admins:** @aidappdev

You can now start browsing and matching with other tokens!`;

console.log('Message:');
console.log(message);
console.log('\nMessage length:', message.length);
console.log('Byte at offset 203:', message.charCodeAt(203));
console.log('Character at offset 203:', message[203]);

// Check around byte offset 203
console.log('\nAround offset 203:');
for (let i = 200; i < 210; i++) {
  console.log(`${i}: "${message[i]}" (${message.charCodeAt(i)})`);
}
