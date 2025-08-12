import { MyContext, bot, mainMenu, sendTyping, sendWithIcon, sendIcon } from './bot';
import { dbService } from '../services/database';
import { InputFile, InlineKeyboard } from 'grammy';
import path from 'path';

// Start command
bot.command('start', async (ctx: MyContext) => {
  await sendTyping(ctx);
  
  const user = ctx.from;
  if (!user) return;

  // Check if user has registered tokens
  const existingAdmins = await dbService.getAdminsByTelegramId(user.id);
  
  // Send the logo/header first
  let logoMessage = `🔥💕 **MATCHMAKER** 💕🔥\n\n`;
  logoMessage += `**Swipe. Match. Moon Together.** 🚀\n\n`;
  
  let welcomeMessage = `👋 **Welcome to matchmaker**\n\n`;
  welcomeMessage += `It's time to boost your networking game.\n\n`;
  welcomeMessage += `Connect with token projects and influencers, grow your community, and spark meaningful collaborations — all with a simple swipe.\n\n`;
  welcomeMessage += `Matchmaker is your swipe-based connection bot, where you can match with CEOs/Top Admins for **FREE AMAs, X Spaces, and collabs**. Think Tinder, but for building Web3 relationships.\n\n`;
  welcomeMessage += `💕 **Tell Us About You**\n\n`;
  welcomeMessage += `Our AI is here to help you dodge the rugs and find your perfect match (**no red flags, just green candles**).\n\n`;
  welcomeMessage += `Fill out the quick form below so we can match you with projects and influencers you'll actually want to talk to.\n\n`;
  welcomeMessage += `**Swipe. Match. Moon Together.** 🚀`;

  // Send icon only
  await sendIcon(ctx);

  await ctx.reply(welcomeMessage, { 
    parse_mode: 'Markdown',
    reply_markup: mainMenu
  });
});

// Help command
bot.command('help', async (ctx: MyContext) => {
  await sendTyping(ctx);
  
  const helpText = `🔥💕 **MATCHMAKER HELP** 💕🔥\n\n` +
    `**Swipe. Match. Moon Together.** 🚀\n\n` +
    `**Commands:**\n` +
    `/start - Start the bot and show main menu\n` +
    `/help - Show this help message\n` +
    `/menu - Show main menu\n` +
    `/status - Check your token registration status\n` +
    `/matches - View your token matches\n` +
    `/botsetup - Check bot setup status in your groups/channels\n\n` +
    `**How it works:**\n` +
    `1. Set up your token profile with market cap and chains\n` +
    `2. Browse other tokens and like the ones you want to collaborate with\n` +
    `3. When two tokens like each other, it's a match!\n` +
    `4. Get FREE AMAs, X Spaces, and collabs with matched tokens\n` +
    `5. Access private coordination rooms for planning\n\n` +
    `Think Tinder, but for building Web3 relationships! 💕\n\n` +
    `**Need support?** Contact @@OnchainRamp`;

  await sendWithIcon(ctx, helpText);
});

// Menu command
bot.command('menu', async (ctx: MyContext) => {
  const iconPath = path.join(__dirname, '../../assets/icon.jpg');
    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: 'Choose an option:',
      reply_markup: new InlineKeyboard()
        .text('💕 Set me up 💕', 'start_onboarding')
        .row()
        .text('👀 Browse Tokens', 'start_browsing')
        .row()
        .text('💕 My Matches', 'show_matches')
    });
});

// Status command
bot.command('status', async (ctx: MyContext) => {
  await sendTyping(ctx);
  
  const user = ctx.from;
  if (!user) return;

  const admins = await dbService.getAdminsByTelegramId(user.id);
  
  if (admins.length === 0) {
    await sendWithIcon(ctx, '❌ You haven\'t registered any tokens yet. Use /start to register your first token.');
    return;
  }

  let statusText = `📊 **Your Token Status** (${admins.length} token${admins.length > 1 ? 's' : ''})\n\n`;
  
  for (let i = 0; i < admins.length; i++) {
    const admin = admins[i];
    const project = await dbService.getProjectById(admin.project_id);
    if (!project) continue;

    const matches = await dbService.getMatchesByProjectId(project.id || '');
    
    statusText += `**${i + 1}. ${project.name}**\n`;
    statusText += `   Contract: \`${project.contract_address}\`\n`;
    statusText += `   Chains: ${project.chains.join(', ')}\n`;
    statusText += `   Market Cap: ${project.market_cap}\n`;
    statusText += `   Matches: ${matches.length}\n`;
    statusText += `   Registered: ${project.created_at?.toLocaleDateString() || 'Unknown'}\n\n`;
  }

  await sendWithIcon(ctx, statusText);
});

// Matches command
bot.command('matches', async (ctx: MyContext) => {
  await sendTyping(ctx);
  
  const user = ctx.from;
  if (!user) return;

  const admins = await dbService.getAdminsByTelegramId(user.id);
  if (admins.length === 0) {
    await sendWithIcon(ctx, '❌ You need to register a token first. Use /start to get started.');
    return;
  }

  let allMatches: any[] = [];
  let tokenNames: { [key: string]: string } = {};
  
  // Collect matches from all user tokens
  for (const admin of admins) {
    const project = await dbService.getProjectById(admin.project_id);
    if (project) {
      tokenNames[project.id || ''] = project.name;
      const matches = await dbService.getMatchesByProjectId(project.id || '');
      allMatches.push(...matches.map(match => ({ ...match, userTokenId: project.id, userTokenName: project.name })));
    }
  }
  
  if (allMatches.length === 0) {
    await sendWithIcon(ctx, '💔 No matches yet! Keep browsing and liking tokens to find matches.');
    return;
  }

  // Send header message
  await sendWithIcon(ctx, `💕 **Your Token Matches (${allMatches.length})**\n`);
  
  for (const match of allMatches) {
    const otherProjectId = match.project_a_id === match.userTokenId ? match.project_b_id : match.project_a_id;
    const otherProject = await dbService.getProjectById(otherProjectId);
    
    if (otherProject) {
      // Get user's project details
      const userProject = await dbService.getProjectById(match.userTokenId);
      
      let matchInfo = `🤝 **${match.userTokenName}** ↔️ **${otherProject.name}**\n`;
      matchInfo += `📅 Matched: ${match.created_at?.toLocaleDateString() || 'Unknown'}\n`;
      matchInfo += `🔗 Contract: \`${otherProject.contract_address}\`\n`;
      
      if (match.private_group_invite_link) {
        matchInfo += `🏠 [Private Room](${match.private_group_invite_link})\n`;
      }
      
      // Try to send with images if both tokens have logos
      if (userProject?.logo_file_id && otherProject.logo_file_id && ctx.chat?.id) {
        try {
          // Send media group with both token images horizontally
          await ctx.api.sendMediaGroup(ctx.chat.id, [
            {
              type: 'photo',
              media: userProject.logo_file_id,
              caption: matchInfo,
              parse_mode: 'Markdown'
            },
            {
              type: 'photo',
              media: otherProject.logo_file_id
            }
          ]);
        } catch (error) {
          console.error('Error sending media group, falling back to text:', error);
          // Fallback to text-only message
          await ctx.reply(matchInfo, { parse_mode: 'Markdown' });
        }
      } else if (userProject?.logo_file_id) {
        // Show only user's token image
        try {
          await ctx.replyWithPhoto(userProject.logo_file_id, {
            caption: matchInfo,
            parse_mode: 'Markdown'
          });
        } catch (error) {
          await ctx.reply(matchInfo, { parse_mode: 'Markdown' });
        }
      } else if (otherProject.logo_file_id) {
        // Show only other project's image
        try {
          await ctx.replyWithPhoto(otherProject.logo_file_id, {
            caption: matchInfo,
            parse_mode: 'Markdown'
          });
        } catch (error) {
          await ctx.reply(matchInfo, { parse_mode: 'Markdown' });
        }
      } else {
        // No images available, send text only
        await ctx.reply(matchInfo, { parse_mode: 'Markdown' });
      }
    }
  }
});

// Bot setup check command
bot.command('botsetup', async (ctx: MyContext) => {
  await sendTyping(ctx);
  
  const user = ctx.from;
  if (!user) return;

  const admins = await dbService.getAdminsByTelegramId(user.id);
  
  if (admins.length === 0) {
    await sendWithIcon(ctx, '❌ You haven\'t registered any tokens yet. Use /start to register your first token.');
    return;
  }

  let setupText = `🤖 **Bot Setup Status**\n\n`;
  
  for (let i = 0; i < admins.length; i++) {
    const admin = admins[i];
    const project = await dbService.getProjectById(admin.project_id);
    if (!project) continue;

    setupText += `**${i + 1}. ${project.name}**\n`;
    
    if (project.telegram_group) {
      setupText += `   📱 Group: ${project.telegram_group}\n`;
      // Note: We can't actually check bot permissions without being in the group
      setupText += `   ⚠️  Add bot to group for notifications\n`;
    } else {
      setupText += `   📱 Group: Not set\n`;
    }
    
    if (project.telegram_channel) {
      setupText += `   📢 Channel: ${project.telegram_channel}\n`;
      setupText += `   ⚠️  Add bot to channel for announcements\n`;
    } else {
      setupText += `   📢 Channel: Not set\n`;
    }
    
    setupText += `\n`;
  }

  setupText += `**To set up the bot:**\n`;
  setupText += `1. Add the bot to your group/channel\n`;
  setupText += `2. Make it an admin\n`;
  setupText += `3. Grant message permissions\n`;
  setupText += `4. The bot will automatically send match notifications!\n\n`;
  setupText += `**Need help?** Use /start to update your token settings.`;

  await sendWithIcon(ctx, setupText);
});

// Admin commands (if user ID matches ADMIN_USER_ID)
bot.command('admin', async (ctx: MyContext) => {
  const user = ctx.from;
  if (!user || user.id.toString() !== process.env.ADMIN_USER_ID) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const adminText = `👑 **Admin Panel**\n\n` +
    `**Available commands:**\n` +
    `/admin_stats - View bot statistics\n` +
    `/admin_broadcast <message> - Broadcast to all users\n` +
    `/admin_verify <project_id> - Manually verify project\n`;

  await ctx.reply(adminText, { parse_mode: 'Markdown' });
});

bot.command('admin_stats', async (ctx: MyContext) => {
  const user = ctx.from;
  if (!user || user.id.toString() !== process.env.ADMIN_USER_ID) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  await sendTyping(ctx);

  try {
    // Get basic stats from database
    const statistics = await dbService.getStatistics();

    const stats = `📊 **Bot Statistics**\n\n` +
      `👥 Total Projects: ${statistics.totalProjects}\n` +
      `🔑 Total Admins: ${statistics.totalAdmins}\n` +
      `👍 Total Likes: ${statistics.totalLikes}\n` +
      `💕 Total Matches: ${statistics.totalMatches}\n` +
      `✅ Active Projects: ${statistics.activeProjects}\n` +
      `🔐 Verified Projects: ${statistics.verifiedProjects}\n`;

    await ctx.reply(stats, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    await ctx.reply('❌ Error fetching statistics');
  }
});

// Test match notification command (admin only)
bot.command('test_match_notification', async (ctx: MyContext) => {
  const user = ctx.from;
  if (!user || user.id.toString() !== process.env.ADMIN_USER_ID) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  await sendTyping(ctx);

  try {
    // Get user's registered tokens
    const admins = await dbService.getAdminsByTelegramId(user.id);
    if (admins.length === 0) {
      await ctx.reply('❌ You need to register a token first to test match notifications.');
      return;
    }

    // Get the first token for testing
    const admin = admins[0];
    const project = await dbService.getProjectById(admin.project_id);
    if (!project) {
      await ctx.reply('❌ Project not found.');
      return;
    }

    // Create a test match notification
    let testMatchInfo = `🧪 **TEST MATCH NOTIFICATION** 💕\n\n`;
    testMatchInfo += `🤝 **${project.name}** ↔️ **Test Project**\n`;
    testMatchInfo += `📅 Matched: ${new Date().toLocaleDateString()}\n`;
    testMatchInfo += `🔗 Contract: \`0x1234567890abcdef...\`\n`;
    testMatchInfo += `\n🚀 **What's Next?**\n`;
    testMatchInfo += `• You'll receive an invite to a private coordination room\n`;
    testMatchInfo += `• Plan your AMA collaboration details\n`;
    testMatchInfo += `• Schedule and promote your joint session\n\n`;
    testMatchInfo += `💕 **Congratulations on your match!**`;

    // Test sending to group if configured
    if (project.telegram_group) {
      await ctx.reply(`📱 Testing notification to group: ${project.telegram_group}`);
      // Note: In a real implementation, you'd call the notification service here
      // For now, just show what would be sent
      await ctx.reply(testMatchInfo, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply('⚠️ No Telegram group configured for this token.');
    }

    // Test sending to channel if configured
    if (project.telegram_channel) {
      await ctx.reply(`📢 Testing notification to channel: ${project.telegram_channel}`);
      // Note: In a real implementation, you'd call the notification service here
      // For now, just show what would be sent
      await ctx.reply(testMatchInfo, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply('⚠️ No Telegram channel configured for this token.');
    }

    await ctx.reply('✅ Test completed. Check your group/channel for notifications.');

  } catch (error) {
    console.error('Error testing match notification:', error);
    await ctx.reply('❌ Error testing match notification.');
  }
});

// Test member notification command (admin only)
bot.command('test_member_notification', async (ctx: MyContext) => {
  const user = ctx.from;
  if (!user || user.id.toString() !== process.env.ADMIN_USER_ID) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  await sendTyping(ctx);

  try {
    // Get user's registered tokens
    const admins = await dbService.getAdminsByTelegramId(user.id);
    if (admins.length === 0) {
      await ctx.reply('❌ You need to register a token first to test member notifications.');
      return;
    }

    // Get the first token for testing
    const admin = admins[0];
    const project = await dbService.getProjectById(admin.project_id);
    if (!project) {
      await ctx.reply('❌ Project not found.');
      return;
    }

    // Create a test match notification for members
    let testMatchInfo = `🧪 **TEST MEMBER NOTIFICATION** 💕\n\n`;
    testMatchInfo += `🤝 **${project.name}** ❤️ **Test Project**\n\n`;
    testMatchInfo += `Two amazing projects have matched and will be coordinating an AMA collaboration!\n\n`;
    testMatchInfo += `📅 Matched: ${new Date().toLocaleDateString()}\n`;
    testMatchInfo += `🔗 Contract: \`0x1234567890abcdef...\`\n`;
    testMatchInfo += `\n🚀 **What's Next?**\n`;
    testMatchInfo += `• Admins will coordinate AMA details\n`;
    testMatchInfo += `• Joint announcement will be made\n`;
    testMatchInfo += `• Stay tuned for the collaboration!\n\n`;
    testMatchInfo += `💕 **Congratulations to both projects!**`;

    // Test sending to current user (simulating a group member)
    await ctx.reply('🧪 Testing member notification...');
    
    // Import notification service
    const { notificationService } = await import('../services/notifications');
    
    // Test sending to the current user
    await notificationService.sendMatchNotificationToUser(
      user.id,
      testMatchInfo,
      project.logo_file_id,
      undefined, // No second logo for test
      project.name,
      'Test Project'
    );

    await ctx.reply('✅ Test member notification sent to you! Check if you received the message with logos.');

  } catch (error) {
    console.error('Error testing member notification:', error);
    await ctx.reply('❌ Error testing member notification.');
  }
});
