function escapeMarkdown(text) {
  return text.replace(/[*_`[\]()~>#+=|{}.!-]/g, '\\$&');
}

// Simulate the exact code from onboarding.ts
const project = {
  x_account: '@sdf'
};

const result = `• [X (Twitter)](https://x.com/${escapeMarkdown(project.x_account.replace('@', ''))})\n`;

console.log('X account:', project.x_account);
console.log('After replace:', project.x_account.replace('@', ''));
console.log('After escape:', escapeMarkdown(project.x_account.replace('@', '')));
console.log('Final result:', result);
console.log('Result as bytes:', Buffer.from(result, 'utf8'));

// Check what happens if we escape the whole thing
const wholeStringEscaped = escapeMarkdown(`• [X (Twitter)](https://x.com/${project.x_account.replace('@', '')})\n`);
console.log('\nIf whole string escaped:', wholeStringEscaped);
