import { MyContext, sendTyping, sendWithIcon, sendIcon, sendSimpleMessage, mainMenu } from '../bot';
import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard, InputFile } from 'grammy';
import { dbService } from '../../services/database';
import { Chain, MarketCap, Project } from '../../types';
import path from 'path';

export async function onboardingConversation(conversation: Conversation<MyContext>, ctx: MyContext) {
  const user = ctx.from;
  if (!user) return;

  // Check if user already has a registered token
  const existingAdmins = await dbService.getAdminsByTelegramId(user.id);
  
  if (existingAdmins.length > 0) {
    // User has an existing token, offer to edit it
    const existingAdmin = existingAdmins[0];
    const existingProject = await dbService.getProjectById(existingAdmin.project_id);
    
    if (existingProject) {
      await sendTyping(ctx);
      
      // Show current token information
      let currentInfo = `✏️ **Edit Your Token**\n\n`;
      currentInfo += `You already have a registered token. Here's your current information:\n\n`;
      currentInfo += `🚀 **${existingProject.name}**\n`;
      currentInfo += `🔗 **Contract:** \`${existingProject.contract_address}\`\n`;
      currentInfo += `⛓️ **Chains:** ${existingProject.chains.join(', ')}\n`;
      currentInfo += `💰 **Market Cap:** ${existingProject.market_cap}\n`;
      
      if (existingProject.telegram_group || existingProject.telegram_channel) {
        currentInfo += `\n📱 **Community:**\n`;
        if (existingProject.telegram_group) {
          currentInfo += `• [Telegram Group](${existingProject.telegram_group})\n`;
        }
        if (existingProject.telegram_channel) {
          currentInfo += `• [Announcement Channel](${existingProject.telegram_channel})\n`;
        }
      }
      
      currentInfo += `\n**Admins:** ${existingProject.admin_handles.map(handle => `@${handle}`).join(', ')}\n`;
      currentInfo += `\nWould you like to edit this information?`;
      
      // Show with logo if available
      const editKeyboard = new InlineKeyboard()
        .text('✏️ Edit Token Info', 'edit_token_confirm')
        .row()
        .text('🏠 Back to Menu', 'return_to_menu');
      
      if (existingProject.logo_file_id) {
        try {
          await ctx.replyWithPhoto(existingProject.logo_file_id, {
            caption: currentInfo,
            parse_mode: 'Markdown',
            reply_markup: editKeyboard
          });
        } catch (error) {
          // Fallback to text if photo fails
          await ctx.reply(currentInfo, {
            parse_mode: 'Markdown',
            reply_markup: editKeyboard
          });
        }
      } else {
        await ctx.reply(currentInfo, {
          parse_mode: 'Markdown',
          reply_markup: editKeyboard
        });
      }
      
      // Wait for user decision
      const response = await conversation.waitFor('callback_query:data');
      try {
        await response.answerCallbackQuery();
      } catch (error) {
        // Ignore callback query timeout errors
      }
      
      if (response.callbackQuery.data === 'return_to_menu') {
        return;
      }
      
      if (response.callbackQuery.data === 'edit_token_confirm') {
        // Proceed with editing flow using existing project data
        await editExistingToken(conversation, ctx, existingProject);
        return;
      }
    }
  }

  // New user or no existing token - proceed with normal onboarding
  await sendTyping(ctx);
  await sendWithIcon(ctx, `🚀 **Let's register your token!**\n\nI'll guide you through the process step by step. You can type /cancel at any time to stop.\n\n**Step 1/7:** What's your token name?`);

  // Step 1: Token Name
  const projectName = await conversation.form.text();
  if (projectName.trim().length < 2 || projectName.trim().length > 100) {
    await ctx.reply('❌ Token name must be between 2 and 100 characters.');
    const iconPath = path.join(__dirname, '../../../assets/icon.jpg');
    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: 'Choose an option:',
      reply_markup: new InlineKeyboard()
        .text('💕 Set me up 💕', 'start_onboarding')
        .row()
        .text('👀 Browse Tokens', 'start_browsing')
        .row()
        .text('💕 My Matches', 'show_matches')
    });
    return;
  }

  await sendTyping(ctx);
  await ctx.reply(`✅ Token name: **${projectName.trim()}**\n\n**Step 2/7:** Please send your token logo or GIF. You can also skip this step by typing "skip".`, {
    parse_mode: 'Markdown'
  });

  // Step 2: Logo/GIF
  let logoFileId: string | undefined;
  const logoResponse = await conversation.waitFor(['message:photo', 'message:animation', 'message:text']);
  
  if (logoResponse.message?.photo) {
    logoFileId = logoResponse.message.photo[logoResponse.message.photo.length - 1].file_id;
    await sendSimpleMessage(ctx, '✅ Logo received!');
  } else if (logoResponse.message?.animation) {
    logoFileId = logoResponse.message.animation.file_id;
    await sendSimpleMessage(ctx, '✅ GIF received!');
  } else if (logoResponse.message?.text?.toLowerCase() === 'skip') {
    await ctx.reply('⏭️ Logo skipped.');
  } else {
    await ctx.reply('❌ Please send a photo/GIF or type "skip".');
    const iconPath = path.join(__dirname, '../../../assets/icon.jpg');
    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: 'Choose an option:',
      reply_markup: new InlineKeyboard()
        .text('💕 Set me up 💕', 'start_onboarding')
        .row()
        .text('👀 Browse Tokens', 'start_browsing')
        .row()
        .text('💕 My Matches', 'show_matches')
    });
    return;
  }

  await sendTyping(ctx);
  await ctx.reply(`**Step 3/7:** What's your contract address?\n\n*Please provide the main token contract address.*`, {
    parse_mode: 'Markdown'
  });

  // Step 3: Contract Address
  const contractAddress = await conversation.form.text();
  if (contractAddress.trim().length < 10) {
    await ctx.reply('❌ Please provide a valid contract address.');
    const iconPath = path.join(__dirname, '../../../assets/icon.jpg');
    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: 'Choose an option:',
      reply_markup: new InlineKeyboard()
        .text('💕 Set me up 💕', 'start_onboarding')
        .row()
        .text('👀 Browse Tokens', 'start_browsing')
        .row()
        .text('💕 My Matches', 'show_matches')
    });
    return;
  }

  // Check if contract already exists
  const existingProject = await dbService.getProjectByContractAddress(contractAddress.trim());
  if (existingProject) {
    await ctx.reply(`❌ This contract address is already registered for project: **${existingProject.name}**`, {
      parse_mode: 'Markdown'
    });
    const iconPath = path.join(__dirname, '../../../assets/icon.jpg');
    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: 'Choose an option:',
      reply_markup: new InlineKeyboard()
        .text('💕 Set me up 💕', 'start_onboarding')
        .row()
        .text('👀 Browse Tokens', 'start_browsing')
        .row()
        .text('💕 My Matches', 'show_matches')
    });
    return;
  }

  await sendTyping(ctx);
  await ctx.reply(`**Step 4/7:** Which blockchain networks is your token on?\n\nSelect all that apply:`, {
    parse_mode: 'Markdown',
    reply_markup: createChainKeyboard()
  });

  // Step 4: Chains
  const selectedChains: Chain[] = [];
  let chainSelectionDone = false;

  while (!chainSelectionDone) {
    const chainResponse = await conversation.waitFor('callback_query:data');
    const chainData = chainResponse.callbackQuery.data;

    if (chainData === 'chains_done') {
      if (selectedChains.length === 0) {
        try {
          await chainResponse.answerCallbackQuery('❌ Please select at least one chain.');
        } catch (error) {
          // Ignore callback query timeout errors
          console.log('Callback query timeout - continuing...');
        }
        continue;
      }
      chainSelectionDone = true;
      try {
        await chainResponse.answerCallbackQuery('✅ Chains selected!');
      } catch (error) {
        // Ignore callback query timeout errors
        console.log('Callback query timeout - continuing...');
      }
    } else if (chainData === 'chain_not_picky') {
      // Select all chains when "I'm not picky" is selected
      selectedChains.length = 0; // Clear current selection
      selectedChains.push(...Object.values(Chain));
      chainSelectionDone = true;
      
      try {
        await chainResponse.answerCallbackQuery('✅ All chains selected!');
      } catch (error) {
        // Ignore callback query timeout errors
        console.log('Callback query timeout - continuing...');
      }
      
      await sendSimpleMessage(ctx, `✅ Selected: **I'm not picky** (All chains)`);
    } else if (chainData.startsWith('chain_')) {
      const chain = chainData.replace('chain_', '') as Chain;
      
      if (selectedChains.includes(chain)) {
        selectedChains.splice(selectedChains.indexOf(chain), 1);
      } else {
        selectedChains.push(chain);
      }
      
      try {
        await chainResponse.answerCallbackQuery(`${selectedChains.includes(chain) ? 'Added' : 'Removed'} ${chain}`);
      } catch (error) {
        // Ignore callback query timeout errors
        console.log('Callback query timeout - continuing...');
      }
      
      try {
        await ctx.editMessageReplyMarkup({
          reply_markup: createChainKeyboard(selectedChains)
        });
      } catch (error) {
        console.error('Error updating keyboard:', error);
      }
    }
  }

  await sendTyping(ctx);
  await ctx.reply(`✅ Selected chains: ${selectedChains.join(', ')}\n\n**Step 5/7:** What's your token's market cap range?\n\nThis helps with better matching:`, {
    parse_mode: 'Markdown',
    reply_markup: createMarketCapKeyboard()
  });

  // Step 5: Market Cap
  let selectedMarketCap: string = '';
  let marketCapSelectionDone = false;

  while (!marketCapSelectionDone) {
    const marketCapResponse = await conversation.waitFor('callback_query:data');
    try {
      await marketCapResponse.answerCallbackQuery();
    } catch (error) {
      // Ignore callback query timeout errors
    }

    const data = marketCapResponse.callbackQuery.data;
    
    if (data === 'market_cap_done') {
      if (selectedMarketCap) {
        marketCapSelectionDone = true;
      } else {
        await ctx.reply('❌ Please select at least one market cap range.');
      }
    } else if (data.startsWith('market_cap_')) {
      const marketCap = data.replace('market_cap_', '');
      selectedMarketCap = marketCap;
      marketCapSelectionDone = true;
      
      await sendSimpleMessage(ctx, `✅ Selected market cap: **${selectedMarketCap}**`);
    }
  }

  await sendTyping(ctx);
  await ctx.reply(`**Step 6/7:** Select your Telegram group and channel (optional)\n\nChoose your main group and announcement channel where you want to receive match notifications:`, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text('📱 Select Group', 'select_telegram_group')
      .row()
      .text('📢 Select Channel', 'select_telegram_channel')
      .row()
      .text('✏️ Enter Manually', 'manual_telegram_links')
      .row()
      .text('⏭️ Skip This Step', 'skip_telegram_links')
  });

  // Step 6: Telegram Links - Interactive Selection
  let telegramGroup: string | undefined;
  let telegramChannel: string | undefined;
  
  const telegramResponse = await conversation.waitFor('callback_query:data');
  try {
    await telegramResponse.answerCallbackQuery();
  } catch (error) {
    // Ignore callback query timeout errors
  }
  
  const telegramAction = telegramResponse.callbackQuery.data;
  
  if (telegramAction === 'select_telegram_group') {
    // Open Telegram's native group selection
    await ctx.reply('Please select your main group or type "cancel" to skip:', {
      reply_markup: {
        keyboard: [[{ text: '📱 Select Group', request_chat: { request_id: 1, chat_is_channel: false, bot_is_member: false } }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    
    try {
      // Wait for group selection or cancel text
      const groupResponse = await conversation.waitFor(['message:chat_shared', 'message:text']);
      
      if (groupResponse.message?.text?.toLowerCase() === 'cancel') {
        await ctx.reply('⏭️ Group selection cancelled.');
      } else if (groupResponse.message?.chat_shared) {
        telegramGroup = `https://t.me/${groupResponse.message.chat_shared.chat_id}`;
        await ctx.reply(`✅ Group selected: ${telegramGroup}`);
        
        // Provide instructions for adding bot to group
        await sendTyping(ctx);
        await ctx.reply(`🤖 **Bot Setup Instructions**\n\nTo receive match notifications in your group, please:\n\n1️⃣ **Add the bot to your group**\n2️⃣ **Make the bot an admin**\n3️⃣ **Grant these permissions:**\n   • Send Messages\n   • Pin Messages\n   • Invite Users\n\nWould you like me to generate an invite link for the bot?`, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('🔗 Get Bot Invite Link', 'get_bot_invite_link')
            .row()
            .text('⏭️ Skip for Now', 'skip_bot_setup')
        });
        
        // Wait for user response
        const botSetupResponse = await conversation.waitFor('callback_query:data');
        try {
          await botSetupResponse.answerCallbackQuery();
        } catch (error) {
          // Ignore callback query timeout errors
        }
        
        if (botSetupResponse.callbackQuery.data === 'get_bot_invite_link') {
          try {
            // Generate bot invite link
            const botInfo = await ctx.api.getMe();
            const inviteLink = `https://t.me/${botInfo.username}?startgroup=true`;
            
            await ctx.reply(`🔗 **Bot Invite Link**\n\nUse this link to add the bot to your group:\n\n\`${inviteLink}\`\n\nAfter adding the bot:\n1. Make it an admin\n2. Grant message permissions\n3. The bot will automatically start monitoring for matches!`, {
              parse_mode: 'Markdown'
            });
          } catch (error) {
            console.error('Error generating invite link:', error);
            await ctx.reply('❌ Could not generate invite link. Please add the bot manually using @' + (await ctx.api.getMe()).username);
          }
        } else {
          await ctx.reply('⏭️ Bot setup skipped. You can add the bot later when needed.');
        }
      }
    } catch (error) {
      // Handle any error during group selection
      console.log('Group selection error:', error);
      await ctx.reply('❌ Group selection failed. You can add your group later.');
      
      // Remove the keyboard and continue
      await ctx.reply('Please continue with the next step:', {
        reply_markup: { remove_keyboard: true }
      });
    }
    
  } else if (telegramAction === 'select_telegram_channel') {
    // Open Telegram's native channel selection
    await ctx.reply('Please select your announcement channel or type "cancel" to skip:', {
      reply_markup: {
        keyboard: [[{ text: '📢 Select Channel', request_chat: { request_id: 2, chat_is_channel: true, bot_is_member: false } }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    
    try {
      // Wait for channel selection or cancel text
      const channelResponse = await conversation.waitFor(['message:chat_shared', 'message:text']);
      
      if (channelResponse.message?.text?.toLowerCase() === 'cancel') {
        await ctx.reply('⏭️ Channel selection cancelled.');
      } else if (channelResponse.message?.chat_shared) {
        telegramChannel = `https://t.me/${channelResponse.message.chat_shared.chat_id}`;
        await ctx.reply(`✅ Channel selected: ${telegramChannel}`);
        
        // Provide instructions for adding bot to channel
        await sendTyping(ctx);
        await ctx.reply(`🤖 **Bot Setup Instructions**\n\nTo receive match notifications in your channel, please:\n\n1️⃣ **Add the bot to your channel**\n2️⃣ **Make the bot an admin**\n3️⃣ **Grant these permissions:**\n   • Post Messages\n   • Edit Messages\n   • Delete Messages\n\nWould you like me to generate an invite link for the bot?`, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('🔗 Get Bot Invite Link', 'get_bot_invite_link_channel')
            .row()
            .text('⏭️ Skip for Now', 'skip_bot_setup_channel')
        });
        
        // Wait for user response
        const botSetupResponse = await conversation.waitFor('callback_query:data');
        try {
          await botSetupResponse.answerCallbackQuery();
        } catch (error) {
          // Ignore callback query timeout errors
        }
        
        if (botSetupResponse.callbackQuery.data === 'get_bot_invite_link_channel') {
          try {
            // Generate bot invite link
            const botInfo = await ctx.api.getMe();
            const inviteLink = `https://t.me/${botInfo.username}?startchannel=true`;
            
            await ctx.reply(`🔗 **Bot Invite Link**\n\nUse this link to add the bot to your channel:\n\n\`${inviteLink}\`\n\nAfter adding the bot:\n1. Make it an admin\n2. Grant message permissions\n3. The bot will automatically start posting match announcements!`, {
              parse_mode: 'Markdown'
            });
          } catch (error) {
            console.error('Error generating invite link:', error);
            await ctx.reply('❌ Could not generate invite link. Please add the bot manually using @' + (await ctx.api.getMe()).username);
          }
        } else {
          await ctx.reply('⏭️ Bot setup skipped. You can add the bot later when needed.');
        }
      }
    } catch (error) {
      // Handle any error during channel selection
      console.log('Channel selection error:', error);
      await ctx.reply('❌ Channel selection failed. You can add your channel later.');
      
      // Remove the keyboard and continue
      await ctx.reply('Please continue with the next step:', {
        reply_markup: { remove_keyboard: true }
      });
    }
    
  } else if (telegramAction === 'manual_telegram_links') {
    await ctx.reply('Please provide the full URL for your Telegram group (e.g., https://t.me/your_group_name) or skip.', {
      reply_markup: new InlineKeyboard()
        .text('⏭️ Skip Group', 'skip_manual_group')
    });
    
    const manualGroupResponse = await conversation.waitFor(['message:text', 'callback_query:data']);
    if (manualGroupResponse.callbackQuery?.data === 'skip_manual_group') {
      try {
        await manualGroupResponse.answerCallbackQuery('✅ Skipped group');
      } catch (error) {
        // Ignore callback query timeout errors
      }
      await ctx.reply('⏭️ Telegram group skipped.');
    } else if (manualGroupResponse.message?.text) {
      const manualGroupInput = manualGroupResponse.message.text;
      try {
        const url = new URL(manualGroupInput);
        if (url.hostname.includes('t.me')) {
          telegramGroup = manualGroupInput;
          await ctx.reply(`✅ Group URL: ${telegramGroup}`);
        } else {
          await ctx.reply('❌ Please provide a valid Telegram group URL (e.g., https://t.me/your_group_name).');
        }
      } catch (e) {
        await ctx.reply('❌ Invalid URL format. Please provide a valid Telegram group URL (e.g., https://t.me/your_group_name).');
      }
    }
    
    await ctx.reply('Please provide the full URL for your Telegram channel (e.g., https://t.me/your_channel_name) or skip.', {
      reply_markup: new InlineKeyboard()
        .text('⏭️ Skip Channel', 'skip_manual_channel')
    });
    
    const manualChannelResponse = await conversation.waitFor(['message:text', 'callback_query:data']);
    if (manualChannelResponse.callbackQuery?.data === 'skip_manual_channel') {
      try {
        await manualChannelResponse.answerCallbackQuery('✅ Skipped channel');
      } catch (error) {
        // Ignore callback query timeout errors
      }
      await ctx.reply('⏭️ Telegram channel skipped.');
    } else if (manualChannelResponse.message?.text) {
      const manualChannelInput = manualChannelResponse.message.text;
      try {
        const url = new URL(manualChannelInput);
        if (url.hostname.includes('t.me')) {
          telegramChannel = manualChannelInput;
          await ctx.reply(`✅ Channel URL: ${telegramChannel}`);
        } else {
          await ctx.reply('❌ Please provide a valid Telegram channel URL (e.g., https://t.me/your_channel_name).');
        }
      } catch (e) {
        await ctx.reply('❌ Invalid URL format. Please provide a valid Telegram channel URL (e.g., https://t.me/your_channel_name).');
      }
    }
  } else if (telegramAction === 'skip_telegram_links') {
    await ctx.reply('⏭️ Telegram links skipped.');
  }

  await sendTyping(ctx);
  await ctx.reply(`**Step 7/7:** Please provide the Telegram handles of project admins who should have access to matches.\n\nFormat: @username1, @username2, @username3\n\n*These admins will be invited to private coordination rooms when matches occur.*`, {
    parse_mode: 'Markdown'
  });

  // Step 6: Admin Handles
  const adminHandlesText = await conversation.form.text();
  const adminHandles = adminHandlesText
    .split(',')
    .map(handle => handle.trim().replace('@', ''))
    .filter(handle => handle.length > 0);

  if (adminHandles.length === 0) {
    await ctx.reply('❌ Please provide at least one admin handle.');
    const iconPath = path.join(__dirname, '../../../assets/icon.jpg');
    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: 'Choose an option:',
      reply_markup: new InlineKeyboard()
        .text('💕 Set me up 💕', 'start_onboarding')
        .row()
        .text('👀 Browse Tokens', 'start_browsing')
        .row()
        .text('💕 My Matches', 'show_matches')
    });
    return;
  }

  // Create project
  await sendTyping(ctx);
  await ctx.reply('🔄 Creating your project registration...');

  try {
    const projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'> = {
      name: projectName.trim(),
      logo_file_id: logoFileId,
      contract_address: contractAddress.trim(),
      chains: selectedChains,
      market_cap: selectedMarketCap,
      telegram_group: telegramGroup,
      telegram_channel: telegramChannel,
      admin_handles: adminHandles,
      is_active: true,
      verified: true // Auto-verify since we're removing verification
    };

    const project = await dbService.createProject(projectData);

    // Create or update admin record (handles existing users)
    await dbService.createOrUpdateAdmin({
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      project_id: project.id || ''
    });

    // Create token card in the same format as browsing
    let card = `🎉 **Token registered successfully!**\n\n`;
    card += `🚀 Token Name : **${project.name}**\n`;
    
    card += `🔗 **Contract:** \`${project.contract_address}\`\n`;
    card += `⛓️ **Chains:** ${project.chains.join(', ')}\n`;
    card += `💰 **Market Cap:** ${project.market_cap}\n`;
    
    if (project.telegram_group || project.telegram_channel) {
      card += `\n📱 **Community:**\n`;
      if (project.telegram_group) {
        card += `• [Telegram Group](${project.telegram_group})\n`;
      }
      if (project.telegram_channel) {
        card += `• [Announcement Channel](${project.telegram_channel})\n`;
      }
    }

    card += `📅 **Registered:** ${project.created_at?.toLocaleDateString() || 'Today'}\n`;
    card += `\n**Admins:** ${project.admin_handles.map(handle => `@${handle}`).join(', ')}\n`;
    card += `\nYou can now start browsing and matching with other tokens!`;
    
    // Create menu button
    const menuButton = new InlineKeyboard()
      .text('🏠 Menu', 'return_to_menu');
    
    // Send with logo if available
    if (project.logo_file_id) {
      try {
        await ctx.replyWithPhoto(project.logo_file_id, {
          caption: card,
          parse_mode: 'Markdown',
          reply_markup: menuButton
        });
      } catch (error) {
        // Fallback to text if logo fails
        await ctx.reply(card, {
          parse_mode: 'Markdown',
          reply_markup: menuButton
        });
      }
    } else {
      await ctx.reply(card, {
        parse_mode: 'Markdown',
        reply_markup: menuButton
      });
    }

  } catch (error) {
    console.error('Error creating project:', error);
    await ctx.reply('❌ An error occurred while registering your project. Please try again or contact support.');
  }
}

function createChainKeyboard(selected: Chain[] = []): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const chains = Object.values(Chain);
  
  for (let i = 0; i < chains.length; i += 2) {
    const chain1 = chains[i];
    const chain2 = chains[i + 1];
    
    const button1Text = selected.includes(chain1) ? `✅ ${chain1}` : chain1;
    keyboard.text(button1Text, `chain_${chain1}`);
    
    if (chain2) {
      const button2Text = selected.includes(chain2) ? `✅ ${chain2}` : chain2;
      keyboard.text(button2Text, `chain_${chain2}`);
    }
    
    keyboard.row();
  }
  
  // Add "I'm not picky" option
  keyboard.text('💕 IM NOT PICKY 💕', 'chain_not_picky').row();
  keyboard.text('✅ Done', 'chains_done');
  return keyboard;
}

function createMarketCapKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const marketCaps = Object.values(MarketCap);
  
  for (const marketCap of marketCaps) {
    keyboard.text(marketCap, `market_cap_${marketCap}`).row();
  }
  
  return keyboard;
}

function createMarketCapKeyboardWithSkip(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const marketCaps = Object.values(MarketCap);
  
  for (const marketCap of marketCaps) {
    keyboard.text(marketCap, `market_cap_${marketCap}`).row();
  }
  keyboard.text('⏭️ Skip This Step', 'edit_skip_market_cap');
  return keyboard;
}

async function editExistingToken(conversation: Conversation<MyContext>, ctx: MyContext, existingProject: Project) {
  const user = ctx.from;
  if (!user) return;

  await sendTyping(ctx);
  await ctx.reply(`✏️ **Editing your token: ${existingProject.name}**\n\nI'll guide you through updating each field. You can skip any field to keep the current value.\n\n**Step 1/7:** Token name\n\nCurrent: **${existingProject.name}**\n\nEnter new name or skip:`, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text('⏭️ Skip This Step', 'edit_skip_name')
  });

  // Step 1: Token Name
  let projectName = existingProject.name;
  const nameResponse = await conversation.waitFor(['message:text', 'callback_query:data']);
  
  if (nameResponse.callbackQuery?.data === 'edit_skip_name') {
    try {
      await nameResponse.answerCallbackQuery('✅ Skipped name update');
    } catch (error) {
      // Ignore callback query timeout errors
    }
    await sendSimpleMessage(ctx, `✅ Keeping current name: **${projectName}**`);
  } else if (nameResponse.message?.text) {
    const projectNameInput = nameResponse.message.text;
    
    if (projectNameInput.trim().length < 2 || projectNameInput.trim().length > 100) {
      await ctx.reply('❌ Token name must be between 2 and 100 characters. Keeping current name.');
    } else {
      projectName = projectNameInput.trim();
      await sendSimpleMessage(ctx, `✅ Updated token name: **${projectName}**`);
    }
  }

  await sendTyping(ctx);
  await ctx.reply(`**Step 2/7:** Token logo or GIF\n\nCurrent: ${existingProject.logo_file_id ? 'Logo uploaded' : 'No logo'}\n\nSend new logo/GIF or skip to keep current:`, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text('⏭️ Skip This Step', 'edit_skip_logo')
  });

  // Step 2: Logo/GIF
  let logoFileId = existingProject.logo_file_id;
  const logoResponse = await conversation.waitFor(['message:photo', 'message:animation', 'callback_query:data']);
  
  if (logoResponse.callbackQuery?.data === 'edit_skip_logo') {
    try {
      await logoResponse.answerCallbackQuery('✅ Skipped logo update');
    } catch (error) {
      // Ignore callback query timeout errors
    }
    await ctx.reply('✅ Keeping current logo.');
  } else if (logoResponse.message?.photo) {
    logoFileId = logoResponse.message.photo[logoResponse.message.photo.length - 1].file_id;
    await sendSimpleMessage(ctx, '✅ New logo received!');
  } else if (logoResponse.message?.animation) {
    logoFileId = logoResponse.message.animation.file_id;
    await sendSimpleMessage(ctx, '✅ New GIF received!');
  }

  await sendTyping(ctx);
  await ctx.reply(`**Step 3/7:** Contract address\n\nCurrent: \`${existingProject.contract_address}\`\n\nEnter new contract address or skip:`, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text('⏭️ Skip This Step', 'edit_skip_contract')
  });

  // Step 3: Contract Address  
  let contractAddress = existingProject.contract_address;
  const contractResponse = await conversation.waitFor(['message:text', 'callback_query:data']);
  
  if (contractResponse.callbackQuery?.data === 'edit_skip_contract') {
    try {
      await contractResponse.answerCallbackQuery('✅ Skipped contract update');
    } catch (error) {
      // Ignore callback query timeout errors
    }
    await sendSimpleMessage(ctx, `✅ Keeping current contract: \`${contractAddress}\``);
  } else if (contractResponse.message?.text) {
    const contractInput = contractResponse.message.text;
    
    if (contractInput.trim().length < 10) {
      await ctx.reply('❌ Please provide a valid contract address. Keeping current address.');
    } else {
      // Check if new contract already exists (but not for current project)
      const existingProjectWithContract = await dbService.getProjectByContractAddress(contractInput.trim());
      if (existingProjectWithContract && existingProjectWithContract.id !== existingProject.id) {
        await ctx.reply(`❌ This contract address is already registered for project: **${existingProjectWithContract.name}**. Keeping current address.`, {
          parse_mode: 'Markdown'
        });
      } else {
        contractAddress = contractInput.trim();
        await sendSimpleMessage(ctx, `✅ Updated contract address: \`${contractAddress}\``);
      }
    }
  }

  await sendTyping(ctx);
  await ctx.reply(`**Step 4/7:** Blockchain networks\n\nCurrent: ${existingProject.chains.join(', ')}\n\nSelect new chains:`, {
    parse_mode: 'Markdown',
    reply_markup: createChainKeyboard(existingProject.chains as Chain[])
  });

  // Step 4: Chains
  const selectedChains: Chain[] = [...(existingProject.chains as Chain[])];
  let chainSelectionDone = false;

  while (!chainSelectionDone) {
    const chainResponse = await conversation.waitFor('callback_query:data');
    const chainData = chainResponse.callbackQuery.data;

    if (chainData === 'chains_done') {
      if (selectedChains.length === 0) {
        try {
          await chainResponse.answerCallbackQuery('❌ Please select at least one chain.');
        } catch (error) {
          console.log('Callback query timeout - continuing...');
        }
        continue;
      }
      chainSelectionDone = true;
      try {
        await chainResponse.answerCallbackQuery('✅ Chains updated!');
      } catch (error) {
        console.log('Callback query timeout - continuing...');
      }
    } else if (chainData === 'chain_not_picky') {
      selectedChains.length = 0;
      selectedChains.push(...Object.values(Chain));
      chainSelectionDone = true;
      
      try {
        await chainResponse.answerCallbackQuery('✅ All chains selected!');
      } catch (error) {
        console.log('Callback query timeout - continuing...');
      }
      
      await sendSimpleMessage(ctx, `✅ Updated: **I'm not picky** (All chains)`);
    } else if (chainData.startsWith('chain_')) {
      const chain = chainData.replace('chain_', '') as Chain;
      
      if (selectedChains.includes(chain)) {
        selectedChains.splice(selectedChains.indexOf(chain), 1);
      } else {
        selectedChains.push(chain);
      }
      
      try {
        await chainResponse.answerCallbackQuery(`${selectedChains.includes(chain) ? 'Added' : 'Removed'} ${chain}`);
      } catch (error) {
        console.log('Callback query timeout - continuing...');
      }
      
      try {
        await ctx.editMessageReplyMarkup({
          reply_markup: createChainKeyboard(selectedChains)
        });
      } catch (error) {
        console.error('Error updating keyboard:', error);
      }
    }
  }

  await sendTyping(ctx);
  await ctx.reply(`✅ Updated chains: ${selectedChains.join(', ')}\n\n**Step 5/7:** Market cap range\n\nCurrent: ${existingProject.market_cap}\n\nSelect new market cap or skip:`, {
    parse_mode: 'Markdown',
    reply_markup: createMarketCapKeyboardWithSkip()
  });

  // Step 5: Market Cap
  let selectedMarketCap = existingProject.market_cap;
  let marketCapSelectionDone = false;

  while (!marketCapSelectionDone) {
    const marketCapResponse = await conversation.waitFor('callback_query:data');
    try {
      await marketCapResponse.answerCallbackQuery();
    } catch (error) {
      // Ignore callback query timeout errors
    }

    const data = marketCapResponse.callbackQuery.data;
    
    if (data === 'edit_skip_market_cap') {
      await sendSimpleMessage(ctx, `✅ Keeping current market cap: **${selectedMarketCap}**`);
      marketCapSelectionDone = true;
    } else if (data.startsWith('market_cap_')) {
      const marketCap = data.replace('market_cap_', '');
      selectedMarketCap = marketCap;
      marketCapSelectionDone = true;
      
      await sendSimpleMessage(ctx, `✅ Updated market cap: **${selectedMarketCap}**`);
    }
  }

  await sendTyping(ctx);
  await ctx.reply(`**Step 6/7:** Update Telegram group and channel (optional)\n\nCurrent:\n• Group: ${existingProject.telegram_group || 'None'}\n• Channel: ${existingProject.telegram_channel || 'None'}\n\nChoose what to update:`, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text('📱 Update Group', 'edit_select_telegram_group')
      .row()
      .text('📢 Update Channel', 'edit_select_telegram_channel')
      .row()
      .text('📱📢 Update Both', 'edit_select_both_telegram')
      .row()
      .text('✏️ Enter Manually', 'edit_manual_telegram_links')
      .row()
      .text('⏭️ Keep Current', 'edit_skip_telegram_links')
  });

  // Step 6: Telegram Links - Interactive Selection
  let telegramGroup = existingProject.telegram_group;
  let telegramChannel = existingProject.telegram_channel;
  
  const telegramResponse = await conversation.waitFor('callback_query:data');
  try {
    await telegramResponse.answerCallbackQuery();
  } catch (error) {
    // Ignore callback query timeout errors
  }
  
  const telegramAction = telegramResponse.callbackQuery.data;
  
  if (telegramAction === 'edit_select_telegram_group') {
    // Open Telegram's native group selection
    await ctx.reply('Please select your new main group or type "cancel" to skip:', {
      reply_markup: {
        keyboard: [[{ text: '📱 Select Group', request_chat: { request_id: 3, chat_is_channel: false, bot_is_member: false } }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    
    try {
      // Wait for group selection or cancel text
      const groupResponse = await conversation.waitFor(['message:chat_shared', 'message:text']);
      
      if (groupResponse.message?.text?.toLowerCase() === 'cancel') {
        await ctx.reply('⏭️ Group selection cancelled.');
      } else if (groupResponse.message?.chat_shared) {
        telegramGroup = `https://t.me/${groupResponse.message.chat_shared.chat_id}`;
        await ctx.reply(`✅ Group updated: ${telegramGroup}`);
        
        // Provide instructions for adding bot to group
        await sendTyping(ctx);
        await ctx.reply(`🤖 **Bot Setup Instructions**\n\nTo receive match notifications in your updated group, please:\n\n1️⃣ **Add the bot to your group**\n2️⃣ **Make the bot an admin**\n3️⃣ **Grant these permissions:**\n   • Send Messages\n   • Pin Messages\n   • Invite Users\n\nWould you like me to generate an invite link for the bot?`, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('🔗 Get Bot Invite Link', 'get_bot_invite_link_edit')
            .row()
            .text('⏭️ Skip for Now', 'skip_bot_setup_edit')
        });
        
        // Wait for user response
        const botSetupResponse = await conversation.waitFor('callback_query:data');
        try {
          await botSetupResponse.answerCallbackQuery();
        } catch (error) {
          // Ignore callback query timeout errors
        }
        
        if (botSetupResponse.callbackQuery.data === 'get_bot_invite_link_edit') {
          try {
            // Generate bot invite link
            const botInfo = await ctx.api.getMe();
            const inviteLink = `https://t.me/${botInfo.username}?startgroup=true`;
            
            await ctx.reply(`🔗 **Bot Invite Link**\n\nUse this link to add the bot to your group:\n\n\`${inviteLink}\`\n\nAfter adding the bot:\n1. Make it an admin\n2. Grant message permissions\n3. The bot will automatically start monitoring for matches!`, {
              parse_mode: 'Markdown'
            });
          } catch (error) {
            console.error('Error generating invite link:', error);
            await ctx.reply('❌ Could not generate invite link. Please add the bot manually using @' + (await ctx.api.getMe()).username);
          }
        } else {
          await ctx.reply('⏭️ Bot setup skipped. You can add the bot later when needed.');
        }
      }
    } catch (error) {
      console.log('Group selection error in edit:', error);
      await ctx.reply('❌ Group selection failed. You can add your group later.');
      
      // Remove the keyboard and continue
      await ctx.reply('Please continue with the next step:', {
        reply_markup: { remove_keyboard: true }
      });
    }
    
  } else if (telegramAction === 'edit_select_telegram_channel') {
    // Open Telegram's native channel selection
    await ctx.reply('Please select your new announcement channel or type "cancel" to skip:', {
      reply_markup: {
        keyboard: [[{ text: '📢 Select Channel', request_chat: { request_id: 4, chat_is_channel: true, bot_is_member: false } }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    
    try {
      // Wait for channel selection or cancel text
      const channelResponse = await conversation.waitFor(['message:chat_shared', 'message:text']);
      
      if (channelResponse.message?.text?.toLowerCase() === 'cancel') {
        await ctx.reply('⏭️ Channel selection cancelled.');
      } else if (channelResponse.message?.chat_shared) {
        telegramChannel = `https://t.me/${channelResponse.message.chat_shared.chat_id}`;
        await ctx.reply(`✅ Channel updated: ${telegramChannel}`);
        
        // Provide instructions for adding bot to channel
        await sendTyping(ctx);
        await ctx.reply(`🤖 **Bot Setup Instructions**\n\nTo receive match notifications in your updated channel, please:\n\n1️⃣ **Add the bot to your channel**\n2️⃣ **Make the bot an admin**\n3️⃣ **Grant these permissions:**\n   • Post Messages\n   • Edit Messages\n   • Delete Messages\n\nWould you like me to generate an invite link for the bot?`, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('🔗 Get Bot Invite Link', 'get_bot_invite_link_channel_edit')
            .row()
            .text('⏭️ Skip for Now', 'skip_bot_setup_channel_edit')
        });
        
        // Wait for user response
        const botSetupResponse = await conversation.waitFor('callback_query:data');
        try {
          await botSetupResponse.answerCallbackQuery();
        } catch (error) {
          // Ignore callback query timeout errors
        }
        
        if (botSetupResponse.callbackQuery.data === 'get_bot_invite_link_channel_edit') {
          try {
            // Generate bot invite link
            const botInfo = await ctx.api.getMe();
            const inviteLink = `https://t.me/${botInfo.username}?startchannel=true`;
            
            await ctx.reply(`🔗 **Bot Invite Link**\n\nUse this link to add the bot to your channel:\n\n\`${inviteLink}\`\n\nAfter adding the bot:\n1. Make it an admin\n2. Grant message permissions\n3. The bot will automatically start posting match announcements!`, {
              parse_mode: 'Markdown'
            });
          } catch (error) {
            console.error('Error generating invite link:', error);
            await ctx.reply('❌ Could not generate invite link. Please add the bot manually using @' + (await ctx.api.getMe()).username);
          }
        } else {
          await ctx.reply('⏭️ Bot setup skipped. You can add the bot later when needed.');
        }
      }
    } catch (error) {
      console.log('Channel selection error in edit:', error);
      await ctx.reply('❌ Channel selection failed. You can add your channel later.');
      
      // Remove the keyboard and continue
      await ctx.reply('Please continue with the next step:', {
        reply_markup: { remove_keyboard: true }
      });
    }
    
  } else if (telegramAction === 'edit_select_both_telegram') {
    // Handle both group and channel selection
    await handleBothTelegramSelection(conversation, ctx, existingProject, telegramGroup, telegramChannel);
  } else if (telegramAction === 'edit_manual_telegram_links') {
    await ctx.reply('Please provide the full URL for your Telegram group (e.g., https://t.me/your_group_name) or skip.', {
      reply_markup: new InlineKeyboard()
        .text('⏭️ Skip Group', 'edit_skip_manual_group')
    });
    
    const manualGroupResponse = await conversation.waitFor(['message:text', 'callback_query:data']);
    if (manualGroupResponse.callbackQuery?.data === 'edit_skip_manual_group') {
      try {
        await manualGroupResponse.answerCallbackQuery('✅ Skipped group update');
      } catch (error) {
        // Ignore callback query timeout errors
      }
      await ctx.reply('⏭️ Telegram group skipped.');
    } else if (manualGroupResponse.message?.text) {
      const manualGroupInput = manualGroupResponse.message.text;
      try {
        const url = new URL(manualGroupInput);
        if (url.hostname.includes('t.me')) {
          telegramGroup = manualGroupInput;
          await ctx.reply(`✅ Group URL: ${telegramGroup}`);
        } else {
          await ctx.reply('❌ Please provide a valid Telegram group URL (e.g., https://t.me/your_group_name).');
        }
      } catch (e) {
        await ctx.reply('❌ Invalid URL format. Please provide a valid Telegram group URL (e.g., https://t.me/your_group_name).');
      }
    }
    
    await ctx.reply('Please provide the full URL for your Telegram channel (e.g., https://t.me/your_channel_name) or skip.', {
      reply_markup: new InlineKeyboard()
        .text('⏭️ Skip Channel', 'edit_skip_manual_channel')
    });
    
    const manualChannelResponse = await conversation.waitFor(['message:text', 'callback_query:data']);
    if (manualChannelResponse.callbackQuery?.data === 'edit_skip_manual_channel') {
      try {
        await manualChannelResponse.answerCallbackQuery('✅ Skipped channel update');
      } catch (error) {
        // Ignore callback query timeout errors
      }
      await ctx.reply('⏭️ Telegram channel skipped.');
    } else if (manualChannelResponse.message?.text) {
      const manualChannelInput = manualChannelResponse.message.text;
      try {
        const url = new URL(manualChannelInput);
        if (url.hostname.includes('t.me')) {
          telegramChannel = manualChannelInput;
          await ctx.reply(`✅ Channel URL: ${telegramChannel}`);
        } else {
          await ctx.reply('❌ Please provide a valid Telegram channel URL (e.g., https://t.me/your_channel_name).');
        }
      } catch (e) {
        await ctx.reply('❌ Invalid URL format. Please provide a valid Telegram channel URL (e.g., https://t.me/your_channel_name).');
      }
    }
  } else if (telegramAction === 'edit_skip_telegram_links') {
    await ctx.reply('✅ Keeping current Telegram links');
  }

  await sendTyping(ctx);
  await ctx.reply(`**Step 7/7:** Admin handles\n\nCurrent: ${existingProject.admin_handles.map(handle => `@${handle}`).join(', ')}\n\nEnter new admin handles (comma-separated) or skip:`, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text('⏭️ Skip This Step', 'edit_skip_admin_handles')
  });

  // Step 7: Admin Handles
  let adminHandles = existingProject.admin_handles;
  const adminHandlesResponse = await conversation.waitFor(['message:text', 'callback_query:data']);
  
  if (adminHandlesResponse.callbackQuery?.data === 'edit_skip_admin_handles') {
    try {
      await adminHandlesResponse.answerCallbackQuery('✅ Skipped admin handles update');
    } catch (error) {
      // Ignore callback query timeout errors
    }
    await sendSimpleMessage(ctx, `✅ Keeping current admin handles: ${adminHandles.map(handle => `@${handle}`).join(', ')}`);
  } else if (adminHandlesResponse.message?.text) {
    const adminHandlesInput = adminHandlesResponse.message.text;
    
    const newAdminHandles = adminHandlesInput
      .split(',')
      .map(handle => handle.trim().replace('@', ''))
      .filter(handle => handle.length > 0);

    if (newAdminHandles.length === 0) {
      await ctx.reply('❌ Please provide at least one admin handle. Keeping current handles.');
    } else {
      adminHandles = newAdminHandles;
      await sendSimpleMessage(ctx, `✅ Updated admin handles: ${adminHandles.map(handle => `@${handle}`).join(', ')}`);
    }
  }

  // Update project
  await sendTyping(ctx);
  await ctx.reply('🔄 Updating your project...');

  try {
    const updatedProjectData: Omit<Project, 'id' | 'created_at' | 'updated_at'> = {
      name: projectName,
      logo_file_id: logoFileId,
      contract_address: contractAddress,
      chains: selectedChains,
      market_cap: selectedMarketCap,
      telegram_group: telegramGroup,
      telegram_channel: telegramChannel,
      admin_handles: adminHandles,
      is_active: true,
      verified: true
    };

    const updatedProject = await dbService.updateProject(existingProject.id || '', updatedProjectData);

    if (!updatedProject) {
      throw new Error('Failed to update project');
    }

    // Create updated token card
    let card = `✅ **Token updated successfully!**\n\n`;
    card += `🚀 Token Name : **${updatedProject.name}**\n`;
    
    card += `🔗 **Contract:** \`${updatedProject.contract_address}\`\n`;
    card += `⛓️ **Chains:** ${updatedProject.chains.join(', ')}\n`;
    card += `💰 **Market Cap:** ${updatedProject.market_cap}\n`;
    
    if (updatedProject.telegram_group || updatedProject.telegram_channel) {
      card += `\n📱 **Community:**\n`;
      if (updatedProject.telegram_group) {
        card += `• [Telegram Group](${updatedProject.telegram_group})\n`;
      }
      if (updatedProject.telegram_channel) {
        card += `• [Announcement Channel](${updatedProject.telegram_channel})\n`;
      }
    }

    card += `📅 **Last Updated:** ${updatedProject.updated_at?.toLocaleDateString() || 'Today'}\n`;
    card += `\n**Admins:** ${updatedProject.admin_handles.map(handle => `@${handle}`).join(', ')}\n`;
    card += `\nYour updated token is ready for matching!`;
    
    // Create menu button
    const menuButton = new InlineKeyboard()
      .text('🏠 Menu', 'return_to_menu');
    
    // Send with logo if available
    if (updatedProject.logo_file_id) {
      try {
        await ctx.replyWithPhoto(updatedProject.logo_file_id, {
          caption: card,
          parse_mode: 'Markdown',
          reply_markup: menuButton
        });
      } catch (error) {
        // Fallback to text if logo fails
        await ctx.reply(card, {
          parse_mode: 'Markdown',
          reply_markup: menuButton
        });
      }
    } else {
      await ctx.reply(card, {
        parse_mode: 'Markdown',
        reply_markup: menuButton
      });
    }

  } catch (error) {
    console.error('Error updating project:', error);
    await ctx.reply('❌ An error occurred while updating your project. Please try again or contact support.');
  }
}

// Helper function to check bot permissions in a chat
async function checkBotPermissions(ctx: MyContext, chatId: string): Promise<boolean> {
  try {
    const chatMember = await ctx.api.getChatMember(chatId, ctx.me.id);
    return chatMember.status === 'administrator' || chatMember.status === 'creator';
  } catch (error) {
    console.error('Error checking bot permissions:', error);
    return false;
  }
}

// Helper function to provide bot setup instructions
async function provideBotSetupInstructions(ctx: MyContext, isGroup: boolean = true) {
  const chatType = isGroup ? 'group' : 'channel';
  const permissions = isGroup 
    ? '• Send Messages\n   • Pin Messages\n   • Invite Users'
    : '• Post Messages\n   • Edit Messages\n   • Delete Messages';
  
  await sendTyping(ctx);
  await ctx.reply(`🤖 **Bot Setup Instructions**\n\nTo receive match notifications in your ${chatType}, please:\n\n1️⃣ **Add the bot to your ${chatType}**\n2️⃣ **Make the bot an admin**\n3️⃣ **Grant these permissions:**\n   ${permissions}\n\nWould you like me to generate an invite link for the bot?`, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text('🔗 Get Bot Invite Link', `get_bot_invite_link_${isGroup ? 'group' : 'channel'}`)
      .row()
      .text('⏭️ Skip for Now', `skip_bot_setup_${isGroup ? 'group' : 'channel'}`)
  });
}

// Helper function to generate bot invite link
async function generateBotInviteLink(ctx: MyContext, isGroup: boolean = true): Promise<string> {
  try {
    const botInfo = await ctx.api.getMe();
    const inviteType = isGroup ? 'startgroup=true' : 'startchannel=true';
    return `https://t.me/${botInfo.username}?${inviteType}`;
  } catch (error) {
    console.error('Error generating invite link:', error);
    throw error;
  }
}

async function handleBothTelegramSelection(conversation: Conversation<MyContext>, ctx: MyContext, existingProject: Project, telegramGroup: string | undefined, telegramChannel: string | undefined) {
  // First, handle group selection
  await ctx.reply('📱 **Step 1/2: Select your Telegram group**\n\nPlease select your main group or type "cancel" to skip:', {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [[{ text: '📱 Select Group', request_chat: { request_id: 5, chat_is_channel: false, bot_is_member: false } }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
  
  try {
    const groupResponse = await conversation.waitFor(['message:chat_shared', 'message:text']);
    
    if (groupResponse.message?.text?.toLowerCase() === 'cancel') {
      await ctx.reply('⏭️ Group selection cancelled.');
    } else if (groupResponse.message?.chat_shared) {
      telegramGroup = `https://t.me/${groupResponse.message.chat_shared.chat_id}`;
      await ctx.reply(`✅ Group selected: ${telegramGroup}`);
      
      // Provide bot setup instructions for group
      await sendTyping(ctx);
      await ctx.reply(`🤖 **Bot Setup Instructions for Group**\n\nTo receive match notifications in your group, please:\n\n1️⃣ **Add the bot to your group**\n2️⃣ **Make the bot an admin**\n3️⃣ **Grant these permissions:**\n   • Send Messages\n   • Pin Messages\n   • Invite Users\n\nWould you like me to generate an invite link for the bot?`, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🔗 Get Bot Invite Link', 'get_bot_invite_link_both_group')
          .row()
          .text('⏭️ Skip for Now', 'skip_bot_setup_both_group')
      });
      
      const botSetupResponse = await conversation.waitFor('callback_query:data');
      try {
        await botSetupResponse.answerCallbackQuery();
      } catch (error) {
        // Ignore callback query timeout errors
      }
      
      if (botSetupResponse.callbackQuery.data === 'get_bot_invite_link_both_group') {
        try {
          const botInfo = await ctx.api.getMe();
          const inviteLink = `https://t.me/${botInfo.username}?startgroup=true`;
          await ctx.reply(`🔗 **Bot Invite Link for Group**\n\nUse this link to add the bot to your group:\n\n\`${inviteLink}\`\n\nAfter adding the bot:\n1. Make it an admin\n2. Grant message permissions\n3. The bot will automatically start monitoring for matches!`, {
            parse_mode: 'Markdown'
          });
        } catch (error) {
          console.error('Error generating invite link:', error);
          await ctx.reply('❌ Could not generate invite link. Please add the bot manually using @' + (await ctx.api.getMe()).username);
        }
      } else {
        await ctx.reply('⏭️ Bot setup skipped for group. You can add the bot later when needed.');
      }
    }
  } catch (error) {
    console.log('Group selection error in both selection:', error);
    await ctx.reply('❌ Group selection failed. You can add your group later.');
  }
  
  // Remove the keyboard
  await ctx.reply('Please continue with channel selection:', {
    reply_markup: { remove_keyboard: true }
  });
  
  // Then, handle channel selection
  await ctx.reply('📢 **Step 2/2: Select your Telegram channel**\n\nPlease select your announcement channel or type "cancel" to skip:', {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [[{ text: '📢 Select Channel', request_chat: { request_id: 6, chat_is_channel: true, bot_is_member: false } }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
  
  try {
    const channelResponse = await conversation.waitFor(['message:chat_shared', 'message:text']);
    
    if (channelResponse.message?.text?.toLowerCase() === 'cancel') {
      await ctx.reply('⏭️ Channel selection cancelled.');
    } else if (channelResponse.message?.chat_shared) {
      telegramChannel = `https://t.me/${channelResponse.message.chat_shared.chat_id}`;
      await ctx.reply(`✅ Channel selected: ${telegramChannel}`);
      
      // Provide bot setup instructions for channel
      await sendTyping(ctx);
      await ctx.reply(`🤖 **Bot Setup Instructions for Channel**\n\nTo receive match notifications in your channel, please:\n\n1️⃣ **Add the bot to your channel**\n2️⃣ **Make the bot an admin**\n3️⃣ **Grant these permissions:**\n   • Post Messages\n   • Edit Messages\n   • Delete Messages\n\nWould you like me to generate an invite link for the bot?`, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🔗 Get Bot Invite Link', 'get_bot_invite_link_both_channel')
          .row()
          .text('⏭️ Skip for Now', 'skip_bot_setup_both_channel')
      });
      
      const botSetupResponse = await conversation.waitFor('callback_query:data');
      try {
        await botSetupResponse.answerCallbackQuery();
      } catch (error) {
        // Ignore callback query timeout errors
      }
      
      if (botSetupResponse.callbackQuery.data === 'get_bot_invite_link_both_channel') {
        try {
          const botInfo = await ctx.api.getMe();
          const inviteLink = `https://t.me/${botInfo.username}?startchannel=true`;
          await ctx.reply(`🔗 **Bot Invite Link for Channel**\n\nUse this link to add the bot to your channel:\n\n\`${inviteLink}\`\n\nAfter adding the bot:\n1. Make it an admin\n2. Grant message permissions\n3. The bot will automatically start posting match announcements!`, {
            parse_mode: 'Markdown'
          });
        } catch (error) {
          console.error('Error generating invite link:', error);
          await ctx.reply('❌ Could not generate invite link. Please add the bot manually using @' + (await ctx.api.getMe()).username);
        }
      } else {
        await ctx.reply('⏭️ Bot setup skipped for channel. You can add the bot later when needed.');
      }
    }
  } catch (error) {
    console.log('Channel selection error in both selection:', error);
    await ctx.reply('❌ Channel selection failed. You can add your channel later.');
  }
  
  // Remove the keyboard
  await ctx.reply('✅ Both group and channel selection completed!', {
    reply_markup: { remove_keyboard: true }
  });
}


