import {
  MyContext,
  sendTyping,
  sendWithIcon,
  sendIcon,
  sendSimpleMessage,
  mainMenu,
  getIconPath,
} from "../bot";
import { Conversation } from "@grammyjs/conversations";
import { dbService } from "../../services/database";
import { notificationService } from "../../services/notifications";
import { Project } from "../../types";
import { InputFile, InlineKeyboard } from 'grammy';

export async function browsingConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext
) {
  const user = ctx.from;
  if (!user) return;

  // Check if user has registered tokens
  const admins = await dbService.getAdminsByTelegramId(user.id);
  if (admins.length === 0) {
    await sendWithIcon(
      ctx,
      "❌ You need to register a token first. Use /start to get started."
    );
    return;
  }

  let userProject: Project | null = null;

  // If user has multiple tokens, let them choose which one to browse with
  if (admins.length > 1) {
    let tokenSelection = `🎯 **Choose which token to browse with:**\n\n`;

    const keyboard = new InlineKeyboard();
    for (let i = 0; i < admins.length; i++) {
      const admin = admins[i];
      const project = await dbService.getProjectById(admin.project_id);
      if (project && project.is_active) {
        tokenSelection += `${i + 1}. **${project.name}**\n`;
        keyboard
          .text(`${i + 1}. ${project.name}`, `select_token_${project.id}`)
          .row();
      }
    }

    await sendWithIcon(ctx, tokenSelection, "Markdown");

    // Send keyboard separately
    await ctx.reply("Choose your token:", {
      reply_markup: keyboard,
    });

    const tokenResponse = await conversation.waitFor("callback_query:data");
    try {
      await tokenResponse.answerCallbackQuery();
    } catch (error) {
      // Ignore callback query timeout errors
    }

    const selectedTokenId = tokenResponse.callbackQuery.data.replace(
      "select_token_",
      ""
    );
    userProject = await dbService.getProjectById(selectedTokenId);

    if (!userProject) {
      await ctx.reply("❌ Selected token not found.");
      return;
    }
  } else {
    // Single token, use it directly
    userProject = await dbService.getProjectById(admins[0].project_id);
    if (!userProject) {
      await ctx.reply("❌ Token not found. Please contact support.");
      return;
    }
  }

  if (!userProject.is_active) {
    await ctx.reply("❌ Your token is not active. Please contact support.");
    return;
  }

  await sendTyping(ctx);
  await sendSimpleMessage(ctx, "🔍 Loading tokens for you to browse...");

  // Get projects that haven't been liked by this user
  const availableProjects = await dbService.getProjectsNotLikedBy(
    userProject.id || ""
  );

  if (availableProjects.length === 0) {
    await sendSimpleMessage(
      ctx,
      `🎯 **No more tokens to browse!**\n\nYou've already seen all available tokens. Check back later for new tokens, or use /matches to see your current matches.`
    );
    return;
  }

  await sendSimpleMessage(
    ctx,
    `🎯 **Found ${availableProjects.length} tokens to browse!**\n\nI'll show you each token card. Choose 👍 **Like** or 👎 **Pass** for each one.\n\n*If you both like each other, it's a match! 💕*`
  );

  let currentIndex = 0;
  let browsingStopped = false;

  while (currentIndex < availableProjects.length && !browsingStopped) {
    const project = availableProjects[currentIndex];

    await sendTyping(ctx);

    // Create project card
    const projectCard = await createProjectCard(
      project,
      currentIndex + 1,
      availableProjects.length
    );
    const keyboard = createBrowsingKeyboard(project.id || "");

    let messageId: number;
    let isPhotoMessage = false;

    // First send matchmaker icon
    await sendIcon(ctx);

    // Then send project card with logo if available
    if (project.logo_file_id) {
      try {
        const sentMessage = await ctx.replyWithPhoto(project.logo_file_id, {
          caption: projectCard,
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
        messageId = sentMessage.message_id;
        isPhotoMessage = true;
      } catch (error) {
        // Fallback to text if photo fails
        const sentMessage = await ctx.reply(projectCard, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
        messageId = sentMessage.message_id;
        isPhotoMessage = false;
      }
    } else {
      const sentMessage = await ctx.reply(projectCard, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      messageId = sentMessage.message_id;
      isPhotoMessage = false;
    }

    // Wait for user action
    const response = await conversation.waitFor("callback_query:data");
    const action = response.callbackQuery.data;
    const projectId = action.split("_")[1];

    if (action.startsWith("like_")) {
      try {
        await response.answerCallbackQuery("👍 Liked!");
      } catch (error) {
        // Ignore callback query timeout errors
        console.log("Callback query timeout - continuing...");
      }

      // Create like record
      await dbService.createLike(userProject.id || "", projectId);

      // Check for mutual like (match)
      const isMutualLike = await dbService.checkMutualLike(
        userProject.id || "",
        projectId
      );

        if (isMutualLike) {
        // It's a match!
        const match = await dbService.createMatch(
          userProject.id || "",
          projectId
        );

        // Process match (announcement and private group creation)
        await notificationService.processMatch(
          match.id || "",
          userProject.name,
          project.name,
          userProject.id || "",
          project.id || "",
          userProject.logo_file_id,
          project.logo_file_id
        );

        // Show match notification
        if (isPhotoMessage) {
          await response.editMessageCaption({
            caption: `🎉 **IT'S A MATCH!** 💕\n\n**${userProject.name}** ❤️ **${project.name}**\n\nYou both liked each other! A match announcement will be posted and you'll receive an invite to a private coordination room soon.\n\nUse /matches to see all your matches.`,
            parse_mode: "Markdown",
          });
        } else {
          await response.editMessageText(
            `🎉 **IT'S A MATCH!** 💕\n\n**${userProject.name}** ❤️ **${project.name}**\n\nYou both liked each other! A match announcement will be posted and you'll receive an invite to a private coordination room soon.\n\nUse /matches to see all your matches.`,
            {
              parse_mode: "Markdown",
            }
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 3000)); // Show match for 3 seconds
      } else {
        if (isPhotoMessage) {
          await response.editMessageCaption({
            caption: `👍 **Liked ${project.name}**\n\nIf they like you back, it's a match! 💕`,
            parse_mode: "Markdown",
          });
        } else {
          await response.editMessageText(
            `👍 **Liked ${project.name}**\n\nIf they like you back, it's a match! 💕`,
            {
              parse_mode: "Markdown",
            }
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 1500)); // Brief pause
      }
    } else if (action.startsWith("pass_")) {
      try {
        await response.answerCallbackQuery("👎 Passed");
      } catch (error) {
        // Ignore callback query timeout errors
        console.log("Callback query timeout - continuing...");
      }
      if (isPhotoMessage) {
        await response.editMessageCaption({
          caption: `👎 **Passed on ${project.name}**`,
          parse_mode: "Markdown",
        });
      } else {
        await response.editMessageText(`👎 **Passed on ${project.name}**`, {
          parse_mode: "Markdown",
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Brief pause
    } else if (action === "stop_browsing") {
      try {
        await response.answerCallbackQuery("🛑 Browsing stopped");
      } catch (error) {
        // Ignore callback query timeout errors
        console.log("Callback query timeout - continuing...");
      }
      browsingStopped = true;
      
      // Simply return to the first interface - just the menu
      const iconPath = getIconPath();
      await ctx.replyWithPhoto(new InputFile(iconPath), {
        caption: 'Choose an option:',
        reply_markup: new InlineKeyboard()
          .text('💕 Set me up 💕', 'start_onboarding')
          .row()
          .text('👀 Browse Tokens', 'start_browsing')
          .row()
          .text('💕 My Matches', 'show_matches')
      });
      break;
    }

    currentIndex++;
  }

  if (!browsingStopped) {
    await sendSimpleMessage(
      ctx,
      `🎯 **Browsing complete!**\n\nYou've seen all ${availableProjects.length} available tokens. Check back later for new tokens or use /matches to see your matches!`
    );
  }
}

async function createProjectCard(
  project: Project,
  currentIndex: number,
  totalProjects: number
): Promise<string> {
  let card = `🚀 **${project.name}**\n`;
  card += `📊 Token ${currentIndex} of ${totalProjects}\n\n`;

  card += `🔗 **Contract:** \`${project.contract_address}\`\n`;
  card += `⛓️ **Chains:** ${project.chains.join(", ")}\n`;
  card += `💰 **Market Cap:** ${project.market_cap}\n`;

  // Add real-time market data if available
  if (project.token_price || project.token_market_cap_api || project.token_volume_24h) {
    card += `\n📊 **Live Market Data:**\n`;
    if (project.token_price) {
      const priceChange = project.token_price_change_24h;
      const changeEmoji = priceChange && priceChange >= 0 ? '📈' : '📉';
      const changeText = priceChange ? ` (${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%)` : '';
      card += `• **Price:** $${project.token_price.toFixed(6)}${changeText} ${changeEmoji}\n`;
    }
    if (project.token_market_cap_api) {
      const marketCap = project.token_market_cap_api;
      let formattedMarketCap = '';
      if (marketCap >= 1e12) {
        formattedMarketCap = `$${(marketCap / 1e12).toFixed(2)}T`;
      } else if (marketCap >= 1e9) {
        formattedMarketCap = `$${(marketCap / 1e9).toFixed(2)}B`;
      } else if (marketCap >= 1e6) {
        formattedMarketCap = `$${(marketCap / 1e6).toFixed(2)}M`;
      } else if (marketCap >= 1e3) {
        formattedMarketCap = `$${(marketCap / 1e3).toFixed(2)}K`;
      } else {
        formattedMarketCap = `$${marketCap.toFixed(2)}`;
      }
      card += `• **Market Cap:** ${formattedMarketCap}\n`;
    }
    if (project.token_volume_24h) {
      const volume = project.token_volume_24h;
      let formattedVolume = '';
      if (volume >= 1e12) {
        formattedVolume = `$${(volume / 1e12).toFixed(2)}T`;
      } else if (volume >= 1e9) {
        formattedVolume = `$${(volume / 1e9).toFixed(2)}B`;
      } else if (volume >= 1e6) {
        formattedVolume = `$${(volume / 1e6).toFixed(2)}M`;
      } else if (volume >= 1e3) {
        formattedVolume = `$${(volume / 1e3).toFixed(2)}K`;
      } else {
        formattedVolume = `$${volume.toFixed(2)}`;
      }
      card += `• **24h Volume:** ${formattedVolume}\n`;
    }
  }

  // Add social links if available
  const socialLinks = [];
  if (project.telegram_group) {
    socialLinks.push(`[Telegram Group](${project.telegram_group})`);
  }
  if (project.telegram_channel) {
    socialLinks.push(`[Announcement Channel](${project.telegram_channel})`);
  }
  if (project.token_telegram_group_api) {
    socialLinks.push(`[Official Telegram](${project.token_telegram_group_api})`);
  }
  if (project.token_twitter_handle) {
    socialLinks.push(`[Twitter](${project.token_twitter_handle})`);
  }
  if (project.token_website) {
    socialLinks.push(`[Website](${project.token_website})`);
  }

  if (socialLinks.length > 0) {
    card += `\n📱 **Community:**\n`;
    card += socialLinks.map(link => `• ${link}`).join('\n') + '\n';
  }

  card += `📅 **Registered:** ${
    project.created_at?.toLocaleDateString() || "Unknown"
  }\n`;

  card += `\n**Admins:** ${project.admin_handles
    .map((handle) => `@${handle}`)
    .join(", ")}\n`;

  return card;
}

function createBrowsingKeyboard(projectId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("👍 Like", `like_${projectId}`)
    .text("👎 Pass", `pass_${projectId}`)
    .row()
    .text("🛑 Stop Browsing", "stop_browsing");
}
