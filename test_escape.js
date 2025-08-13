function escapeMarkdown(text) {
  return text.replace(/[*_`[\]()~>#+=|{}.!-]/g, '\\$&');
}

const xAccount = '@sdf';
const cleanHandle = xAccount.replace('@', '');
const escaped = escapeMarkdown(cleanHandle);
const result = `• [X (Twitter)](https://x.com/${escaped})`;

console.log('Clean handle:', cleanHandle);
console.log('Escaped:', escaped);
console.log('Final result:', result);
console.log('Result length:', result.length);

// Test with special characters
const xAccountSpecial = '@test_user-123';
const cleanHandleSpecial = xAccountSpecial.replace('@', '');
const escapedSpecial = escapeMarkdown(cleanHandleSpecial);
const resultSpecial = `• [X (Twitter)](https://x.com/${escapedSpecial})`;

console.log('\nWith special characters:');
console.log('Clean handle special:', cleanHandleSpecial);
console.log('Escaped special:', escapedSpecial);
console.log('Final result special:', resultSpecial);
