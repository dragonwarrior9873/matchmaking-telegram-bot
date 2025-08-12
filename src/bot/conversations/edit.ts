import { Conversation } from '@grammyjs/conversations';
import { MyContext, sendTyping } from '../bot';
import { dbService } from '../../services/database';
import { Project } from '../../types';

const MARKET_CAP_OPTIONS = [
  'Under $100k',
  '$100k - $1M',
  '$1M - $10M',
  '$10M - $100M',
  '$100M+'
];

const CHAIN_OPTIONS = [
  'Ethereum',
  'Binance Smart Chain',
  'Polygon',
  'Solana',
  'Avalanche',
  'Arbitrum',
  'Optimism',
  'Base',
  'Sui',
  'Aptos'
];

export async function editConversation(conversation: Conversation<MyContext>, ctx: MyContext) {
  const user = ctx.from;
  if (!user) {
    await ctx.reply('❌ Unable to identify user. Please try again.');
    return;
  }

  // Get user's current project
  const admin = await dbService.getAdminByTelegramId(user.id);
  if (!admin) {
    await ctx.reply('❌ You don\'t have any registered tokens yet. Use "💕 Set me up 💕" to get started!');
    return;
  }

  const currentProject = await dbService.getProjectById(admin.project_id);
  if (!currentProject) {
    await ctx.reply('❌ Your token data could not be found. Please contact support.');
    return;
  }

  await sendTyping(ctx);
  await ctx.reply(
    `📝 **Edit Your Token Information**\n\n` +
    `Current token: **${currentProject.name}**\n\n` +
    `What would you like to edit? You'll go through the same setup process but with your current information pre-filled.`,
    { parse_mode: 'Markdown' }
  );

  // Step 1: Token Name
  await sendTyping(ctx);
  await ctx.reply(`**Step 1/7:** What's the name of your token?\n\nCurrent: **${currentProject.name}**`, {
    parse_mode: 'Markdown'
  });
  
  const projectName = await conversation.form.text();

  // Step 2: Logo Upload
  await sendTyping(ctx);
  await ctx.reply(
    `**Step 2/7:** Please upload your token's logo.\n\n` +
    `Send an image file, or type "skip" to keep your current logo.`,
    { parse_mode: 'Markdown' }
  );

  let logoFileId = currentProject.logo_file_id;
  const logoMessage = await conversation.waitFor([':photo', ':document', ':text']);
  
  if (logoMessage.message?.photo) {
    const photos = logoMessage.message.photo;
    const largestPhoto = photos[photos.length - 1];
    logoFileId = largestPhoto.file_id;
  } else if (logoMessage.message?.document) {
    logoFileId = logoMessage.message.document.file_id;
  } else if (logoMessage.message?.text && logoMessage.message.text.toLowerCase() !== 'skip') {
    await ctx.reply('❌ Please upload an image file or type "skip".');
    return;
  }

  // Step 3: Contract Address
  await sendTyping(ctx);
  await ctx.reply(`**Step 3/7:** What's your token's contract address?\n\nCurrent: \`${currentProject.contract_address}\``, {
    parse_mode: 'Markdown'
  });
  
  const contractAddress = await conversation.form.text();

  // Step 4: Chains
  await sendTyping(ctx);
  let chainsMessage = `**Step 4/7:** Which blockchain(s) is your token on?\n\n`;
  chainsMessage += `Current: ${currentProject.chains.join(', ')}\n\n`;
  chainsMessage += `Please type the chains separated by commas. Available options:\n`;
  chainsMessage += CHAIN_OPTIONS.map((chain, index) => `${index + 1}. ${chain}`).join('\n');
  chainsMessage += `\n\nExample: Ethereum, Polygon, Arbitrum`;

  await ctx.reply(chainsMessage, { parse_mode: 'Markdown' });
  
  const chainsText = await conversation.form.text();
  const selectedChains = chainsText
    .split(',')
    .map(chain => chain.trim())
    .filter(chain => CHAIN_OPTIONS.includes(chain));

  if (selectedChains.length === 0) {
    await ctx.reply('❌ Please select at least one valid blockchain from the list.');
    return;
  }

  // Step 5: Market Cap
  await sendTyping(ctx);
  let marketCapMessage = `**Step 5/7:** What's your token's current market cap range?\n\n`;
  marketCapMessage += `Current: ${currentProject.market_cap}\n\n`;
  marketCapMessage += `Please choose one:\n`;
  marketCapMessage += MARKET_CAP_OPTIONS.map((option, index) => `${index + 1}. ${option}`).join('\n');

  await ctx.reply(marketCapMessage, { parse_mode: 'Markdown' });
  
  const marketCapText = await conversation.form.text();
  const marketCapIndex = parseInt(marketCapText) - 1;
  
  if (marketCapIndex < 0 || marketCapIndex >= MARKET_CAP_OPTIONS.length) {
    await ctx.reply('❌ Please select a valid option (1-5).');
    return;
  }
  
  const selectedMarketCap = MARKET_CAP_OPTIONS[marketCapIndex];

  // Step 6: Telegram Links
  await sendTyping(ctx);
  let linksMessage = `**Step 6/7:** Please provide your Telegram links (optional).\n\n`;
  linksMessage += `Current Group: ${currentProject.telegram_group || 'Not set'}\n`;
  linksMessage += `Current Channel: ${currentProject.telegram_channel || 'Not set'}\n\n`;
  linksMessage += `Format: https://t.me/yourgroup, https://t.me/yourchannel\n`;
  linksMessage += `Or type "skip" to keep current links.`;
  
  await ctx.reply(linksMessage, { parse_mode: 'Markdown' });
  
  const linksText = await conversation.form.text();
  let telegramGroup = currentProject.telegram_group;
  let telegramChannel = currentProject.telegram_channel;
  
  if (linksText.toLowerCase() !== 'skip') {
    const links = linksText.split(',').map(link => link.trim());
    telegramGroup = links[0] || undefined;
    telegramChannel = links[1] || undefined;
  }

  // Step 7: Admin Handles
  await sendTyping(ctx);
  let adminMessage = `**Step 7/7:** Please provide the Telegram handles of project admins.\n\n`;
  adminMessage += `Current: ${currentProject.admin_handles.map(handle => `@${handle}`).join(', ')}\n\n`;
  adminMessage += `Format: @username1, @username2, @username3\n\n`;
  adminMessage += `*These admins will be invited to private coordination rooms when matches occur.*`;
  
  await ctx.reply(adminMessage, { parse_mode: 'Markdown' });

  const adminHandlesText = await conversation.form.text();
  const adminHandles = adminHandlesText
    .split(',')
    .map(handle => handle.trim().replace('@', ''))
    .filter(handle => handle.length > 0);

  if (adminHandles.length === 0) {
    await ctx.reply('❌ Please provide at least one admin handle.');
    return;
  }

  // Update project
  await sendTyping(ctx);
  await ctx.reply('🔄 Updating your token information...');

  try {
    const projectData: Partial<Project> = {
      name: projectName.trim(),
      logo_file_id: logoFileId,
      contract_address: contractAddress.trim(),
      chains: selectedChains,
      market_cap: selectedMarketCap,
      telegram_group: telegramGroup,
      telegram_channel: telegramChannel,
      admin_handles: adminHandles
    };

    const projectId = currentProject.id || (currentProject as any)._id;
    if (!projectId) {
      throw new Error('Project ID not found');
    }
    
    const updatedProject = await dbService.updateProject(projectId, projectData);

    if (!updatedProject) {
      throw new Error('Failed to update project');
    }

    let successMessage = `✅ **Token information updated successfully!**\n\n`;
    successMessage += `**Token:** ${updatedProject.name}\n`;
    successMessage += `**Contract:** \`${updatedProject.contract_address}\`\n`;
    successMessage += `**Chains:** ${updatedProject.chains.join(', ')}\n`;
    successMessage += `**Market Cap:** ${updatedProject.market_cap}\n`;
    successMessage += `\nYour updated information is now live in the matching system!`;

    await ctx.reply(successMessage, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Error updating project:', error);
    await ctx.reply('❌ An error occurred while updating your token information. Please try again or contact support.');
  }
}
