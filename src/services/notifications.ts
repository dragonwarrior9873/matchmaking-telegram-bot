import { bot } from "../bot/bot";
import { dbService } from "./database";
import dotenv from "dotenv";

dotenv.config();

export interface MatchAnnouncementData {
  matchId: string;
  projectAName: string;
  projectBName: string;
  projectALogo?: string;
  projectBLogo?: string;
}

export interface PrivateGroupCreationData {
  matchId: string;
  projectAId: string;
  projectBId: string;
  projectAAdmins: number[];
  projectBAdmins: number[];
}

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Handle match announcements
  async handleMatchAnnouncement(data: MatchAnnouncementData): Promise<void> {
    const { matchId, projectAName, projectBName, projectALogo, projectBLogo } =
      data;

    console.log(`Processing match announcement for match ${matchId}`);

    try {
      // Send to both projects' Telegram groups
      await this.sendMatchNotificationToGroups(
        matchId,
        projectAName,
        projectBName,
        projectALogo,
        projectBLogo
      );

      // Mark match as announced
      await dbService.updateMatchAnnounced(matchId, true);

      console.log(`Match announcement sent for match ${matchId}`);
    } catch (error) {
      console.error(`Error sending match announcement for ${matchId}:`, error);
    }
  }

  // Send simple match notification with admin handles
  async handleMatchNotificationWithAdmins(
    data: PrivateGroupCreationData
  ): Promise<void> {
    const { matchId, projectAId, projectBId, projectAAdmins, projectBAdmins } =
      data;

    console.log(
      `Processing match notification with admin handles for match ${matchId}`
    );

    try {
      // Get project details
      const [projectA, projectB] = await Promise.all([
        dbService.getProjectById(projectAId),
        dbService.getProjectById(projectBId),
      ]);

      if (!projectA || !projectB) {
        throw new Error("Projects not found");
      }

      // Get admin details for both projects
      const [projectAAdminDetails, projectBAdminDetails] = await Promise.all([
        Promise.all(
          projectAAdmins.map((adminId) =>
            dbService.getAdminsByTelegramId(adminId)
          )
        ),
        Promise.all(
          projectBAdmins.map((adminId) =>
            dbService.getAdminsByTelegramId(adminId)
          )
        ),
      ]);

      // Flatten admin arrays and get usernames/handles
      const projectAHandles = projectAAdminDetails
        .flat()
        .map((admin) => admin.username || `user_${admin.telegram_id}`);
      const projectBHandles = projectBAdminDetails
        .flat()
        .map((admin) => admin.username || `user_${admin.telegram_id}`);

             // Send notification to Project A admins
       for (const adminId of projectAAdmins) {
         try {
           const matchMessage =
             `⚡ **IT'S A MATCH!** — and they're ready to collaborate!\n\n` +
             `💕 **Token:** ${projectB.name}\n\n` +
             `💕 **Project Info:**\n` +
             `• **Chains:** ${projectB.chains?.join(', ') || 'Not specified'}\n` +
             `• **Categories:** ${projectB.categories?.join(', ') || 'Not specified'}\n` +
             `• **Description:** ${projectB.description || 'No description available'}\n\n` +
             `💞 **Live Market Data:**\n` +
             `${projectB.token_price ? `• **Price:** $${projectB.token_price.toFixed(6)}${projectB.token_price_change_24h ? ` (${projectB.token_price_change_24h >= 0 ? '+' : ''}${projectB.token_price_change_24h.toFixed(2)}%)` : ''}\n` : ''}` +
             `${projectB.token_market_cap_api ? `• **Market Cap:** ${(() => {
               const marketCap = projectB.token_market_cap_api;
               if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
               if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
               if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
               if (marketCap >= 1e3) return `$${(marketCap / 1e3).toFixed(2)}K`;
               return `$${marketCap.toFixed(2)}`;
             })()}\n` : ''}` +
             `${projectB.token_volume_24h ? `• **24h Volume:** ${(() => {
               const volume = projectB.token_volume_24h;
               if (volume >= 1e12) return `$${(volume / 1e12).toFixed(2)}T`;
               if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
               if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
               if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`;
               return `$${volume.toFixed(2)}`;
             })()}\n` : ''}` +
             `\n` +
             `💕 **Community:**\n` +
             `• **Telegram Group**\n` +
             `• **X (Twitter)**\n\n` +
             `**Registered:** ${projectB.created_at?.toLocaleDateString() || 'Recently'}\n\n` +
             `**Contract:** ${projectB.contract_address || 'Not provided'}\n\n` +
             `🗨️ **Ready to collab?** ${projectB.name} team are waiting for your DM.\n\n` +
             `🐺 **${projectB.name} Team:** ${projectBHandles.map((handle) => `@${handle}`).join(', ')}\n\n` +
             `💕 **More Matches are Waiting!**`;

                     await bot.api.sendMessage(adminId, matchMessage, {
             parse_mode: "Markdown",
             reply_markup: {
               inline_keyboard: [
                 [{ text: "💕 Carry On Matching 💞", callback_data: "start_browsing" }],
                 [{ text: "💘 My Matches 💘", callback_data: "show_matches" }],
                 [{ text: "Main Menu", callback_data: "return_to_menu" }]
               ],
             },
           });
          console.log(`Sent match notification to Project A admin ${adminId}`);
        } catch (error) {
          console.error(
            `Failed to send match notification to Project A admin ${adminId}:`,
            error
          );
        }
      }

             // Send notification to Project B admins
       for (const adminId of projectBAdmins) {
         try {
           const matchMessage =
             `⚡ **IT'S A MATCH!** — and they're ready to collaborate!\n\n` +
             `💕 **Token:** ${projectA.name}\n\n` +
             `💕 **Project Info:**\n` +
             `• **Chains:** ${projectA.chains?.join(', ') || 'Not specified'}\n` +
             `• **Categories:** ${projectA.categories?.join(', ') || 'Not specified'}\n` +
             `• **Description:** ${projectA.description || 'No description available'}\n\n` +
             `💞 **Live Market Data:**\n` +
             `${projectA.token_price ? `• **Price:** $${projectA.token_price.toFixed(6)}${projectA.token_price_change_24h ? ` (${projectA.token_price_change_24h >= 0 ? '+' : ''}${projectA.token_price_change_24h.toFixed(2)}%)` : ''}\n` : ''}` +
             `${projectA.token_market_cap_api ? `• **Market Cap:** ${(() => {
               const marketCap = projectA.token_market_cap_api;
               if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
               if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
               if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
               if (marketCap >= 1e3) return `$${(marketCap / 1e3).toFixed(2)}K`;
               return `$${marketCap.toFixed(2)}`;
             })()}\n` : ''}` +
             `${projectA.token_volume_24h ? `• **24h Volume:** ${(() => {
               const volume = projectA.token_volume_24h;
               if (volume >= 1e12) return `$${(volume / 1e12).toFixed(2)}T`;
               if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
               if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
               if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`;
               return `$${volume.toFixed(2)}`;
             })()}\n` : ''}` +
             `\n` +
             `💕 **Community:**\n` +
             `• **Telegram Group**\n` +
             `• **X (Twitter)**\n\n` +
             `**Registered:** ${projectA.created_at?.toLocaleDateString() || 'Recently'}\n\n` +
             `**Contract:** ${projectA.contract_address || 'Not provided'}\n\n` +
             `🗨️ **Ready to collab?** ${projectA.name} team are waiting for your DM.\n\n` +
             `🐺 **${projectA.name} Team:** ${projectAHandles.map((handle) => `@${handle}`).join(', ')}\n\n` +
             `💕 **More Matches are Waiting!**`;

                     await bot.api.sendMessage(adminId, matchMessage, {
             parse_mode: "Markdown",
             reply_markup: {
               inline_keyboard: [
                 [{ text: "💕 Start Matching 💞", callback_data: "start_browsing" }],
                 [{ text: "💘 My Matches 💘", callback_data: "show_matches" }],
                 [{ text: "Main Menu", callback_data: "return_to_menu" }]
               ],
             },
           });
          console.log(`Sent match notification to Project B admin ${adminId}`);
        } catch (error) {
          console.error(
            `Failed to send match notification to Project B admin ${adminId}:`,
            error
          );
        }
      }

      console.log(
        `Match notification with admin handles completed for match ${matchId}`
      );
    } catch (error) {
      console.error(`Error in match notification for match ${matchId}:`, error);
    }
  }

  // Send match notification to both projects' Telegram groups
  async sendMatchNotificationToGroups(
    matchId: string,
    projectAName: string,
    projectBName: string,
    projectALogo?: string,
    projectBLogo?: string
  ): Promise<void> {
    try {
      console.log(
        `Starting to send match notifications to groups for match ${matchId}`
      );

      // Get match details to find both projects
      const match = await dbService.getMatchById(matchId);
      if (!match) {
        console.error(`Match ${matchId} not found`);
        return;
      }

      // Get both projects
      const [projectA, projectB] = await Promise.all([
        dbService.getProjectById(match.project_a_id),
        dbService.getProjectById(match.project_b_id),
      ]);

      if (!projectA || !projectB) {
        console.error("One or both projects not found for match notification");
        return;
      }

      console.log(
        `Project A: ${projectA.name}, Group: ${projectA.telegram_group}, Channel: ${projectA.telegram_channel}`
      );
      console.log(
        `Project B: ${projectB.name}, Group: ${projectB.telegram_group}, Channel: ${projectB.telegram_channel}`
      );

      // Create match notification message in the same format as matches interface
      let matchInfo = `💕 **NEW MATCH!** \n\n`;
      matchInfo += ` **${projectA.name}** ↔️ **${projectB.name}**\n`;
      matchInfo += ` Matched: ${
        match.created_at?.toLocaleDateString() || "Today"
      }\n`;
      matchInfo += ` Contract: \`${
        projectA.id === match.project_a_id
          ? projectB.contract_address
          : projectA.contract_address
      }\`\n`;

      if (match.private_group_invite_link) {
        matchInfo += ` [Private Room](${match.private_group_invite_link})\n`;
      }

      matchInfo += `\n **What's Next?**\n`;
      matchInfo += `• You'll receive an invite to a private coordination room\n`;
      matchInfo += `• Plan your AMA collaboration details\n`;
      matchInfo += `• Schedule and promote your joint session\n\n`;
      matchInfo += ` 💕 **Congratulations on your match!**`;

      // Send to Project A's group if configured
      if (projectA.telegram_group) {
        console.log(
          `Sending notification to Project A group: ${projectA.telegram_group}`
        );
        await this.sendMatchNotificationToGroup(
          projectA.telegram_group,
          matchInfo,
          projectA.logo_file_id,
          projectB.logo_file_id,
          projectA.name,
          projectB.name
        );
      } else {
        console.log("Project A has no telegram_group configured");
      }

      // Send to Project A's channel if configured
      if (projectA.telegram_channel) {
        await this.sendMatchNotificationToChannel(
          projectA.telegram_channel,
          matchInfo,
          projectA.logo_file_id,
          projectB.logo_file_id,
          projectA.name,
          projectB.name
        );
      }

      // Send to Project B's group if configured
      if (projectB.telegram_group) {
        console.log(
          `Sending notification to Project B group: ${projectB.telegram_group}`
        );
        await this.sendMatchNotificationToGroup(
          projectB.telegram_group,
          matchInfo,
          projectB.logo_file_id,
          projectA.logo_file_id,
          projectB.name,
          projectA.name
        );
      } else {
        console.log("Project B has no telegram_group configured");
      }

      // Send to Project B's channel if configured
      if (projectB.telegram_channel) {
        await this.sendMatchNotificationToChannel(
          projectB.telegram_channel,
          matchInfo,
          projectB.logo_file_id,
          projectA.logo_file_id,
          projectB.name,
          projectA.name
        );
      }

      console.log(
        `Match notifications sent to groups and channels for match ${matchId}`
      );
    } catch (error) {
      console.error(
        `Error sending match notifications to groups and channels for ${matchId}:`,
        error
      );
    }
  }

  // Send match notification to all members of groups and channels
  async sendMatchNotificationToMembers(
    matchId: string,
    projectAName: string,
    projectBName: string,
    projectALogo?: string,
    projectBLogo?: string
  ): Promise<void> {
    try {
      // Get match details to find both projects
      const match = await dbService.getMatchById(matchId);
      if (!match) {
        console.error(`Match ${matchId} not found`);
        return;
      }

      // Get both projects
      const [projectA, projectB] = await Promise.all([
        dbService.getProjectById(match.project_a_id),
        dbService.getProjectById(match.project_b_id),
      ]);

      if (!projectA || !projectB) {
        console.error(
          "One or both projects not found for member notifications"
        );
        return;
      }

      // Create match notification message for members
      let matchInfo = ` **NEW MATCH ANNOUNCEMENT!** \n\n`;
      matchInfo += ` **${projectA.name}** **${projectB.name}**\n\n`;
      matchInfo += `Two amazing projects have matched and will be coordinating an AMA collaboration!\n\n`;
      matchInfo += ` Matched: ${
        match.created_at?.toLocaleDateString() || "Today"
      }\n`;
      matchInfo += ` Contract: \`${
        projectA.id === match.project_a_id
          ? projectB.contract_address
          : projectA.contract_address
      }\`\n`;

      if (match.private_group_invite_link) {
        matchInfo += ` [Private Coordination Room](${match.private_group_invite_link})\n`;
      }

      matchInfo += `\n **What's Next?**\n`;
      matchInfo += `• Admins will coordinate AMA details\n`;
      matchInfo += `• Joint announcement will be made\n`;
      matchInfo += `• Stay tuned for the collaboration!\n\n`;
      matchInfo += ` **Congratulations to both projects!**`;

      // Send to members of Project A's group
      if (projectA.telegram_group) {
        await this.sendNotificationToGroupMembers(
          projectA.telegram_group,
          matchInfo,
          projectA.logo_file_id,
          projectB.logo_file_id,
          projectA.name,
          projectB.name
        );
      }

      // Send to members of Project A's channel
      if (projectA.telegram_channel) {
        await this.sendNotificationToChannelMembers(
          projectA.telegram_channel,
          matchInfo,
          projectA.logo_file_id,
          projectB.logo_file_id,
          projectA.name,
          projectB.name
        );
      }

      // Send to members of Project B's group
      if (projectB.telegram_group) {
        await this.sendNotificationToGroupMembers(
          projectB.telegram_group,
          matchInfo,
          projectB.logo_file_id,
          projectA.logo_file_id,
          projectB.name,
          projectA.name
        );
      }

      // Send to members of Project B's channel
      if (projectB.telegram_channel) {
        await this.sendNotificationToChannelMembers(
          projectB.telegram_channel,
          matchInfo,
          projectB.logo_file_id,
          projectA.logo_file_id,
          projectB.name,
          projectA.name
        );
      }

      console.log(
        `Match notifications sent to members of groups and channels for match ${matchId}`
      );
    } catch (error) {
      console.error(
        `Error sending match notifications to members for ${matchId}:`,
        error
      );
    }
  }

  // Send match notification to a specific group
  async sendMatchNotificationToGroup(
    groupUrl: string,
    matchInfo: string,
    userProjectLogo?: string,
    otherProjectLogo?: string,
    userProjectName?: string,
    otherProjectName?: string
  ): Promise<void> {
    try {
      // Extract chat ID from group URL
      const chatId = this.extractChatIdFromUrl(groupUrl);
      console.log("chatId______________++++++++++++++", chatId);
      if (!chatId) {
        console.error(`Could not extract chat ID from URL: ${groupUrl}`);
        return;
      }

      // Check if bot is in the group and has permissions
      try {
        const botId = bot.botInfo?.id;
        if (!botId) {
          console.warn("Bot info not available, skipping permission check");
          return;
        }

        const chatMember = await bot.api.getChatMember(chatId, botId);
        if (
          chatMember.status !== "administrator" &&
          chatMember.status !== "creator"
        ) {
          console.warn(
            `Bot is not admin in group ${chatId}, skipping notification`
          );
          return;
        }
      } catch (error) {
        console.warn(
          `Bot is not in group ${chatId} or error checking permissions:`,
          error
        );
        return;
      }

      // Send notification with logos if available
      if (userProjectLogo && otherProjectLogo) {
        try {
          // Send media group with both token images horizontally
          await bot.api.sendMediaGroup(chatId, [
            {
              type: "photo",
              media: userProjectLogo,
              caption: matchInfo,
              parse_mode: "Markdown",
            },
            {
              type: "photo",
              media: otherProjectLogo,
            },
          ]);
        } catch (error) {
          console.error(
            "Error sending media group to group, falling back to text:",
            error
          );
          // Fallback to text-only message
          await bot.api.sendMessage(chatId, matchInfo, {
            parse_mode: "Markdown",
          });
        }
      } else if (userProjectLogo) {
        // Show only user's token image
        try {
          await bot.api.sendPhoto(chatId, userProjectLogo, {
            caption: matchInfo,
            parse_mode: "Markdown",
          });
        } catch (error) {
          await bot.api.sendMessage(chatId, matchInfo, {
            parse_mode: "Markdown",
          });
        }
      } else if (otherProjectLogo) {
        // Show only other project's image
        try {
          await bot.api.sendPhoto(chatId, otherProjectLogo, {
            caption: matchInfo,
            parse_mode: "Markdown",
          });
        } catch (error) {
          await bot.api.sendMessage(chatId, matchInfo, {
            parse_mode: "Markdown",
          });
        }
      } else {
        // No images available, send text only
        await bot.api.sendMessage(chatId, matchInfo, {
          parse_mode: "Markdown",
        });
      }

      console.log(`Match notification sent to group ${chatId}`);
    } catch (error) {
      console.error(
        `Error sending match notification to group ${groupUrl}:`,
        error
      );
    }
  }

  // Send match notification to a specific channel
  async sendMatchNotificationToChannel(
    channelUrl: string,
    matchInfo: string,
    userProjectLogo?: string,
    otherProjectLogo?: string,
    userProjectName?: string,
    otherProjectName?: string
  ): Promise<void> {
    try {
      // Extract chat ID from channel URL
      const chatId = this.extractChatIdFromUrl(channelUrl);
      if (!chatId) {
        console.error(`Could not extract chat ID from URL: ${channelUrl}`);
        return;
      }

      // Check if bot is in the channel and has permissions
      try {
        const botId = bot.botInfo?.id;
        if (!botId) {
          console.warn("Bot info not available, skipping permission check");
          return;
        }

        const chatMember = await bot.api.getChatMember(chatId, botId);
        if (
          chatMember.status !== "administrator" &&
          chatMember.status !== "creator"
        ) {
          console.warn(
            `Bot is not admin in channel ${chatId}, skipping notification`
          );
          return;
        }
      } catch (error) {
        console.warn(
          `Bot is not in channel ${chatId} or error checking permissions:`,
          error
        );
        return;
      }

      // Send notification with logos if available
      if (userProjectLogo && otherProjectLogo) {
        try {
          // Send media group with both token images horizontally
          await bot.api.sendMediaGroup(chatId, [
            {
              type: "photo",
              media: userProjectLogo,
              caption: matchInfo,
              parse_mode: "Markdown",
            },
            {
              type: "photo",
              media: otherProjectLogo,
            },
          ]);
        } catch (error) {
          console.error(
            "Error sending media group to channel, falling back to text:",
            error
          );
          // Fallback to text-only message
          await bot.api.sendMessage(chatId, matchInfo, {
            parse_mode: "Markdown",
          });
        }
      } else if (userProjectLogo) {
        // Show only user's token image
        try {
          await bot.api.sendPhoto(chatId, userProjectLogo, {
            caption: matchInfo,
            parse_mode: "Markdown",
          });
        } catch (error) {
          await bot.api.sendMessage(chatId, matchInfo, {
            parse_mode: "Markdown",
          });
        }
      } else if (otherProjectLogo) {
        // Show only other project's image
        try {
          await bot.api.sendPhoto(chatId, otherProjectLogo, {
            caption: matchInfo,
            parse_mode: "Markdown",
          });
        } catch (error) {
          await bot.api.sendMessage(chatId, matchInfo, {
            parse_mode: "Markdown",
          });
        }
      } else {
        // No images available, send text only
        await bot.api.sendMessage(chatId, matchInfo, {
          parse_mode: "Markdown",
        });
      }

      console.log(`Match notification sent to channel ${chatId}`);
    } catch (error) {
      console.error(
        `Error sending match notification to channel ${channelUrl}:`,
        error
      );
    }
  }

  // Send notification to all members of a group
  async sendNotificationToGroupMembers(
    groupUrl: string,
    matchInfo: string,
    userProjectLogo?: string,
    otherProjectLogo?: string,
    userProjectName?: string,
    otherProjectName?: string
  ): Promise<void> {
    try {
      // Extract chat ID from group URL
      const chatId = this.extractChatIdFromUrl(groupUrl);
      if (!chatId) {
        console.error(`Could not extract chat ID from URL: ${groupUrl}`);
        return;
      }

      // Check if bot is in the group and has permissions
      try {
        const botId = bot.botInfo?.id;
        if (!botId) {
          console.warn("Bot info not available, skipping member notifications");
          return;
        }

        const chatMember = await bot.api.getChatMember(chatId, botId);
        if (
          chatMember.status !== "administrator" &&
          chatMember.status !== "creator"
        ) {
          console.warn(
            `Bot is not admin in group ${chatId}, skipping member notifications`
          );
          return;
        }
      } catch (error) {
        console.warn(
          `Bot is not in group ${chatId} or error checking permissions:`,
          error
        );
        return;
      }

      // Get all members of the group
      try {
        const members = await this.getGroupMembers(chatId);
        console.log(`Found ${members.length} members in group ${chatId}`);

        // Send notification to each member
        for (const member of members) {
          try {
            await this.sendMatchNotificationToUser(
              member,
              matchInfo,
              userProjectLogo,
              otherProjectLogo,
              userProjectName,
              otherProjectName
            );

            // Add small delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error) {
            console.error(
              `Failed to send notification to member ${member}:`,
              error
            );
            // Continue with other members even if one fails
          }
        }
      } catch (error) {
        console.error(`Error getting members from group ${chatId}:`, error);
      }
    } catch (error) {
      console.error(
        `Error sending notifications to group members ${groupUrl}:`,
        error
      );
    }
  }

  // Send notification to all subscribers of a channel
  async sendNotificationToChannelMembers(
    channelUrl: string,
    matchInfo: string,
    userProjectLogo?: string,
    otherProjectLogo?: string,
    userProjectName?: string,
    otherProjectName?: string
  ): Promise<void> {
    try {
      // Extract chat ID from channel URL
      const chatId = this.extractChatIdFromUrl(channelUrl);
      if (!chatId) {
        console.error(`Could not extract chat ID from URL: ${channelUrl}`);
        return;
      }

      // Check if bot is in the channel and has permissions
      try {
        const botId = bot.botInfo?.id;
        if (!botId) {
          console.warn("Bot info not available, skipping member notifications");
          return;
        }

        const chatMember = await bot.api.getChatMember(chatId, botId);
        if (
          chatMember.status !== "administrator" &&
          chatMember.status !== "creator"
        ) {
          console.warn(
            `Bot is not admin in channel ${chatId}, skipping member notifications`
          );
          return;
        }
      } catch (error) {
        console.warn(
          `Bot is not in channel ${chatId} or error checking permissions:`,
          error
        );
        return;
      }

      // Note: Telegram Bot API doesn't provide direct access to channel subscribers
      // We can only send to users who have interacted with the bot
      // For now, we'll post the announcement in the channel itself
      await this.sendMatchNotificationToGroup(
        channelUrl,
        matchInfo,
        userProjectLogo,
        otherProjectLogo,
        userProjectName,
        otherProjectName
      );
    } catch (error) {
      console.error(
        `Error sending notifications to channel members ${channelUrl}:`,
        error
      );
    }
  }

  // Send match notification to a specific user
  async sendMatchNotificationToUser(
    userId: number,
    matchInfo: string,
    userProjectLogo?: string,
    otherProjectLogo?: string,
    userProjectName?: string,
    otherProjectName?: string
  ): Promise<void> {
    try {
      // Send notification with logos if available
      if (userProjectLogo && otherProjectLogo) {
        try {
          // Send media group with both token images horizontally
          await bot.api.sendMediaGroup(userId, [
            {
              type: "photo",
              media: userProjectLogo,
              caption: matchInfo,
              parse_mode: "Markdown",
            },
            {
              type: "photo",
              media: otherProjectLogo,
            },
          ]);
        } catch (error) {
          console.error(
            "Error sending media group to user, falling back to text:",
            error
          );
          // Fallback to text-only message
          await bot.api.sendMessage(userId, matchInfo, {
            parse_mode: "Markdown",
          });
        }
      } else if (userProjectLogo) {
        // Show only user's token image
        try {
          await bot.api.sendPhoto(userId, userProjectLogo, {
            caption: matchInfo,
            parse_mode: "Markdown",
          });
        } catch (error) {
          await bot.api.sendMessage(userId, matchInfo, {
            parse_mode: "Markdown",
          });
        }
      } else if (otherProjectLogo) {
        // Show only other project's image
        try {
          await bot.api.sendPhoto(userId, otherProjectLogo, {
            caption: matchInfo,
            parse_mode: "Markdown",
          });
        } catch (error) {
          await bot.api.sendMessage(userId, matchInfo, {
            parse_mode: "Markdown",
          });
        }
      } else {
        // No images available, send text only
        await bot.api.sendMessage(userId, matchInfo, {
          parse_mode: "Markdown",
        });
      }
    } catch (error) {
      console.error(
        `Error sending match notification to user ${userId}:`,
        error
      );
    }
  }

  // Get all members of a group (limited by Telegram API restrictions)
  async getGroupMembers(chatId: string): Promise<number[]> {
    const members: number[] = [];

    try {
      // Note: Telegram Bot API has limitations on getting group members
      // We can only get members who have interacted with the bot
      // For now, we'll implement a basic approach

      // Get chat administrators (these are usually the most active members)
      const administrators = await bot.api.getChatAdministrators(chatId);
      for (const admin of administrators) {
        if (admin.user.id) {
          members.push(admin.user.id);
        }
      }

      // In a full implementation, you might want to:
      // 1. Store user IDs when they interact with the bot
      // 2. Use a database to track group members
      // 3. Implement webhook-based member tracking
    } catch (error) {
      console.error(`Error getting group members for ${chatId}:`, error);
    }

    return members;
  }

  // Extract chat ID from Telegram group URL
  private extractChatIdFromUrl(url: string): string | null {
    try {
      console.log("Extracting chat ID from URL:", url);

      // Clean up URL - remove @ prefix if present
      let cleanUrl = url.trim();
      if (cleanUrl.startsWith("@")) {
        cleanUrl = cleanUrl.substring(1);
      }

      // Handle different URL formats
      if (cleanUrl.includes("t.me/")) {
        const path = cleanUrl.split("t.me/")[1];

        // Remove any query parameters
        const cleanPath = path.split("?")[0];
        console.log("Clean path:", cleanPath);

        if (cleanPath.startsWith("-")) {
          // Public group with negative ID (e.g., -1001234567890)
          console.log("Extracted negative chat ID:", cleanPath);
          return cleanPath;
        } else if (cleanPath.startsWith("+")) {
          // Public group with invite link (e.g., +abcdefghij)
          console.log("Extracted invite link:", cleanPath);
          return cleanPath;
        } else if (cleanPath.startsWith("joinchat/")) {
          // Private group with join link (e.g., joinchat/abcdefghij)
          console.log("Extracted joinchat link:", cleanPath);
          return cleanPath;
        } else if (cleanPath.startsWith("c/")) {
          // Channel or group with c/ format (e.g., c/-4629301903)
          // Extract the actual chat ID from the c/ path
          const chatId = cleanPath.substring(2); // Remove 'c/' prefix
          console.log("Extracted chat ID from c/ format:", chatId);
          return chatId;
        } else {
          // Direct group/channel name (e.g., groupname)
          console.log("Extracted direct name:", cleanPath);
          return cleanPath;
        }
      } else if (cleanUrl.includes("telegram.me/")) {
        // Alternative domain format
        const path = cleanUrl.split("telegram.me/")[1];
        const cleanPath = path.split("?")[0];
        console.log("Extracted from telegram.me:", cleanPath);
        return cleanPath;
      }

      console.log("No valid URL format found");
      return null;
    } catch (error) {
      console.error("Error extracting chat ID from URL:", error);
      return null;
    }
  }

  // Process a match (combines announcement and private group creation)
  async processMatch(
    matchId: string,
    projectAName: string,
    projectBName: string,
    projectAId: string,
    projectBId: string,
    projectALogo?: string,
    projectBLogo?: string
  ): Promise<void> {
    try {
      // Handle match announcement
      await this.handleMatchAnnouncement({
        matchId,
        projectAName,
        projectBName,
        projectALogo,
        projectBLogo,
      });

      // // Send notifications to members of groups and channels
      // await this.sendMatchNotificationToMembers(
      // matchId,
      // projectAName,
      // projectBName,
      // projectALogo,
      // projectBLogo
      // );

      // Get admin IDs for both projects
      const [projectAAdmins, projectBAdmins] = await Promise.all([
        dbService.getAdminsByProjectId(projectAId),
        dbService.getAdminsByProjectId(projectBId),
      ]);

      // Send match notifications with admin handles
      await this.handleMatchNotificationWithAdmins({
        matchId,
        projectAId,
        projectBId,
        projectAAdmins: projectAAdmins.map((admin) => admin.telegram_id),
        projectBAdmins: projectBAdmins.map((admin) => admin.telegram_id),
      });

      console.log(`Match processing completed for ${matchId}`);
    } catch (error) {
      console.error(`Error processing match ${matchId}:`, error);
    }
  }
}

export const notificationService = NotificationService.getInstance();
