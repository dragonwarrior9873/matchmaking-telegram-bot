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

// Find all ** pairs
const asteriskPairs = [];
let i = 0;
while (i < message.length - 1) {
  if (message[i] === '*' && message[i + 1] === '*') {
    asteriskPairs.push(i);
    i += 2; // Skip the next asterisk
  } else {
    i++;
  }
}

console.log('Found ** at positions:', asteriskPairs);
console.log('Number of ** pairs:', asteriskPairs.length);

// Check if pairs are even (should be even for proper matching)
if (asteriskPairs.length % 2 !== 0) {
  console.log('ERROR: Odd number of ** pairs - unmatched bold tags!');
} else {
  console.log('** pairs seem to be matched');
}

// Show context for each ** pair
console.log('\nContext for each ** pair:');
asteriskPairs.forEach((pos, index) => {
  const start = Math.max(0, pos - 10);
  const end = Math.min(message.length, pos + 15);
  const context = message.substring(start, end).replace(/\n/g, '\\n');
  console.log(`${index + 1}. Position ${pos}: "${context}"`);
});
