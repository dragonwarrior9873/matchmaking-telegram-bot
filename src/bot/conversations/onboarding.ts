import {
  MyContext,
  sendTyping,
  sendWithIcon,
  sendIcon,
  sendSimpleMessage,
  mainMenu,
  createMenuKeyboard,
} from "../bot";
import { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard, InputFile } from "grammy";
import { dbService } from "../../services/database";
import { tokenInfoService } from "../../services/tokenInfo";
import { Chain, MarketCap, Category, Project } from "../../types";
import path from "path";

// Helper function to safely escape Markdown characters
function escapeMarkdown(text: string): string {
  // Escape all Markdown special characters
  return text.replace(/[\\*_`[\]()~>#+=|{}.!-]/g, "\\$&");
}

// Helper function to escape HTML characters
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Safe message sender that falls back to plain text if parsing fails
async function safeReply(
  ctx: MyContext,
  message: string,
  options: { parse_mode?: "HTML" | "Markdown"; reply_markup?: any } = {}
) {
  try {
    await ctx.reply(message, options);
  } catch (error) {
    // If parsing fails, send as plain text without formatting
    console.warn("Parse error, sending as plain text:", error);
    const plainMessage = message
      .replace(/<[^>]*>/g, "")
      .replace(/\*\*([^*]*)\*\*/g, "$1")
      .replace(/`([^`]*)`/g, "$1");
    await ctx.reply(plainMessage, { reply_markup: options.reply_markup });
  }
}

// Helper function to safely delete a message
async function safeDeleteMessage(ctx: MyContext, messageId: number) {
  try {
    await ctx.api.deleteMessage(ctx.chat!.id, messageId);
  } catch (error: any) {
    // Silently ignore common expected errors
    if (
      error?.description?.includes("message to delete not found") ||
      error?.description?.includes("message can't be deleted") ||
      error?.error_code === 400
    ) {
      // These are expected errors - message already deleted, too old, etc.
      return;
    }
    // Log unexpected errors
    console.warn("Unexpected error deleting message:", error);
  }
}

// Helper function to convert markdown-style message to HTML
function convertToHtml(markdownText: string): string {
  return markdownText
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>") // **bold** -> <b>bold</b>
    .replace(/`(.*?)`/g, "<code>$1</code>") // `code` -> <code>code</code>
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>'); // [text](url) -> <a href="url">text</a>
}

// Enhanced Telegram setup with better UX - Group Only
export async function showTelegramSetupHub(
  ctx: MyContext,
  telegramGroup: string | undefined,
  telegramChannel: string | undefined
) {
  let hubMessage = "🚀 **Connect Your Telegram Group**\n\n";
  hubMessage +=
    "Connect your main Telegram group so your community can discover and engage with potential collaborations!\n\n";

  // Show current status with visual indicators
  hubMessage += "**Current Setup:**\n";
  hubMessage += `🏠 **Main Group:** ${
    telegramGroup ? "✅ Connected" : "⚪ Not connected"
  }\n`;
  if (telegramGroup) {
    hubMessage += `   └ ${getTelegramDisplayName(telegramGroup)}\n`;
  }

  hubMessage += "\n**Setup Options:**";

  const keyboard = new InlineKeyboard();

  // Simplified options - only group
  if (!telegramGroup) {
    keyboard
      .text("🏠 Add Telegram Group", "telegram_add_group")
      .row()
      .text("✍️ Enter Group URL Manually", "telegram_manual_entry");
  } else {
    keyboard.text("🔄 Change Group", "telegram_reset_setup");
  }

  keyboard
    .row()
    .text(
      telegramGroup ? "✅ Continue" : "⏭️ Skip This Step",
      "telegram_setup_complete"
    );

  await ctx.reply(hubMessage, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

// Helper function to extract display name from Telegram URL
function getTelegramDisplayName(telegramUrl: string): string {
  try {
    const url = new URL(telegramUrl);
    const pathParts = url.pathname.split("/");
    const handle = pathParts[pathParts.length - 1];
    return `@${handle}`;
  } catch {
    return "Connected";
  }
}

// Enhanced group selection with better UX
export async function handleEnhancedGroupSelection(
  conversation: Conversation<MyContext>,
  ctx: MyContext
): Promise<{ success: boolean; groupUrl?: string; chatInfo?: any }> {
  await ctx.reply(
    "🏠 **Select Your Main Telegram Group**\n\n" +
      "Choose the group where your community discusses and collaborates. This is where match notifications and partnership discussions will happen.\n\n" +
      "👆 **Tap the button below** to select from your groups:",
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [
            {
              text: "🏠 Choose My Group",
              request_chat: {
                request_id: 1001,
                chat_is_channel: false,
                bot_is_member: false,
              },
            },
          ],
          [{ text: "❌ Cancel" }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );

  try {
    const response = await conversation.waitFor([
      "message:chat_shared",
      "message:text",
    ]);

    // Remove keyboard
    await ctx.reply("Processing...", {
      reply_markup: { remove_keyboard: true },
    });

    if (response.message?.text?.toLowerCase().includes("cancel")) {
      await ctx.reply("❌ Group selection cancelled.");
      return { success: false };
    }

    if (response.message?.chat_shared) {
      const chatId = response.message.chat_shared.chat_id;
      const chatTitle = response.message.chat_shared.title || "Selected Group";

      // Create URL - handle both username and ID formats
      let groupUrl: string;
      if (response.message.chat_shared.username) {
        groupUrl = `https://t.me/${response.message.chat_shared.username}`;
      } else {
        groupUrl = `https://t.me/c/${chatId}`;
      }

      // Show confirmation with chat details
      await ctx.reply(
        `✅ **Group Selected Successfully!**\n\n` +
          `📱 **Group:** ${chatTitle}\n` +
          `🔗 **Link:** ${groupUrl}\n\n` +
          `This group will receive match notifications and collaboration opportunities.`,
        { parse_mode: "Markdown" }
      );

      return {
        success: true,
        groupUrl,
        chatInfo: {
          id: chatId,
          title: chatTitle,
          username: response.message.chat_shared.username,
        },
      };
    }

    return { success: false };
  } catch (error) {
    console.log("Enhanced group selection error:", error);
    await ctx.reply(
      "❌ Group selection failed. Please try again or skip this step."
    );
    return { success: false };
  }
}

// Enhanced channel selection with better UX
export async function handleEnhancedChannelSelection(
  conversation: Conversation<MyContext>,
  ctx: MyContext
): Promise<{ success: boolean; channelUrl?: string; chatInfo?: any }> {
  await ctx.reply(
    "📢 **Select Your Announcement Channel**\n\n" +
      "Choose your channel for broadcasting partnership announcements and major updates to your wider community.\n\n" +
      "👆 **Tap the button below** to select from your channels:",
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [
            {
              text: "📢 Choose My Channel",
              request_chat: {
                request_id: 1002,
                chat_is_channel: true,
                bot_is_member: false,
              },
            },
          ],
          [{ text: "❌ Cancel" }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );

  try {
    const response = await conversation.waitFor([
      "message:chat_shared",
      "message:text",
    ]);

    // Remove keyboard
    await ctx.reply("Processing...", {
      reply_markup: { remove_keyboard: true },
    });

    if (response.message?.text?.toLowerCase().includes("cancel")) {
      await ctx.reply("❌ Channel selection cancelled.");
      return { success: false };
    }

    if (response.message?.chat_shared) {
      const chatId = response.message.chat_shared.chat_id;
      const chatTitle =
        response.message.chat_shared.title || "Selected Channel";

      // Create URL - handle both username and ID formats
      let channelUrl: string;
      if (response.message.chat_shared.username) {
        channelUrl = `https://t.me/${response.message.chat_shared.username}`;
      } else {
        channelUrl = `https://t.me/c/${chatId}`;
      }

      // Show confirmation with chat details
      await ctx.reply(
        `✅ **Channel Selected Successfully!**\n\n` +
          `📢 **Channel:** ${chatTitle}\n` +
          `🔗 **Link:** ${channelUrl}\n\n` +
          `This channel will broadcast partnership announcements and collaboration opportunities.`,
        { parse_mode: "Markdown" }
      );

      return {
        success: true,
        channelUrl,
        chatInfo: {
          id: chatId,
          title: chatTitle,
          username: response.message.chat_shared.username,
        },
      };
    }

    return { success: false };
  } catch (error) {
    console.log("Enhanced channel selection error:", error);
    await ctx.reply(
      "❌ Channel selection failed. Please try again or skip this step."
    );
    return { success: false };
  }
}

// Simplified setup flow for group only
export async function handleQuickTelegramSetup(
  conversation: Conversation<MyContext>,
  ctx: MyContext
): Promise<{
  groupUrl?: string;
  channelUrl?: string;
  groupInfo?: any;
  channelInfo?: any;
}> {
  await ctx.reply(
    "🏠 **Connect Your Telegram Group**\n\n" +
      "Let's connect your main Telegram group where your community gathers!\n\n" +
      "Please select your group from the list below 👇",
    { parse_mode: "Markdown" }
  );

  // Group selection only
  const groupResult = await handleEnhancedGroupSelection(conversation, ctx);

  if (!groupResult.success) {
    return {};
  }

  // Show final summary
  await sendTyping(ctx);
  let summaryMessage = "🚀 **Group Setup Complete!**\n\n";

  if (groupResult.success) {
    summaryMessage += "✅ **Group Connected Successfully:**\n";
    summaryMessage += `🏠 **Group:** ${
      groupResult.chatInfo?.title || "Connected"
    }\n\n`;
    summaryMessage += "Your community group is now connected!";
  } else {
    summaryMessage += "⚠️ Setup was not completed. You can try again later.";
  }

  await ctx.reply(summaryMessage, { parse_mode: "Markdown" });

  return {
    groupUrl: groupResult.groupUrl,
    channelUrl: undefined, // No channel in simplified setup
    groupInfo: groupResult.chatInfo,
    channelInfo: undefined,
  };
}

// Enhanced manual entry with better validation and UX - Group Only
export async function handleEnhancedManualEntry(
  conversation: Conversation<MyContext>,
  ctx: MyContext
): Promise<{ groupUrl?: string; channelUrl?: string }> {
  await ctx.reply(
    "✍️ **Manual Group Entry**\n\n" +
      "Enter your Telegram group URL manually.\n\n" +
      "**Supported formats:**\n" +
      "• `https://t.me/your_group_name`\n" +
      "• `@your_group_name`\n" +
      "• `t.me/your_group_name`\n\n" +
      "**Enter your main group URL** (or type 'skip'):",
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().text(
        "⏭️ Skip Group",
        "manual_skip_group"
      ),
    }
  );

  let groupUrl: string | undefined;

  // Group URL input
  const groupResponse = await conversation.waitFor([
    "message:text",
    "callback_query:data",
  ]);

  if (groupResponse.callbackQuery?.data === "manual_skip_group") {
    try {
      await groupResponse.answerCallbackQuery("✅ Skipped group");
    } catch (error) {
      // Ignore callback query timeout errors
    }
    await ctx.reply("⏭️ Group skipped.");
  } else if (groupResponse.message?.text) {
    const input = groupResponse.message.text.trim();
    const validatedUrl = validateAndNormalizeTelegramUrl(input, false);

    if (validatedUrl) {
      groupUrl = validatedUrl;
      await ctx.reply(`✅ **Group URL saved:** ${groupUrl}`, {
        parse_mode: "Markdown",
      });
    } else {
      await ctx.reply(
        "❌ **Invalid group URL format.** Please use formats like:\n" +
          "• `https://t.me/your_group`\n" +
          "• `@your_group`\n" +
          "• `t.me/your_group`\n\n" +
          "Group skipped for now.",
        { parse_mode: "Markdown" }
      );
    }
  }

  // Show final summary
  let summaryMessage = "✍️ **Manual Entry Complete**\n\n";
  if (groupUrl) {
    summaryMessage += "✅ **Group URL saved successfully!**";
  } else {
    summaryMessage += "⚠️ **No group URL was added.** You can set it up later.";
  }

  await ctx.reply(summaryMessage, { parse_mode: "Markdown" });

  return { groupUrl, channelUrl: undefined };
}

// Validate and normalize Telegram URLs
function validateAndNormalizeTelegramUrl(
  input: string,
  isChannel: boolean = false
): string | null {
  if (!input || input.toLowerCase() === "skip") return null;

  let cleanInput = input.trim();

  // Handle different input formats
  if (cleanInput.startsWith("@")) {
    cleanInput = cleanInput.substring(1);
  } else if (cleanInput.startsWith("t.me/")) {
    cleanInput = cleanInput.substring(5);
  } else if (cleanInput.startsWith("https://t.me/")) {
    cleanInput = cleanInput.substring(13);
  } else if (cleanInput.startsWith("http://t.me/")) {
    cleanInput = cleanInput.substring(12);
  }

  // Remove any trailing slashes or parameters
  cleanInput = cleanInput.split("?")[0].split("/")[0];

  // Basic validation - must be alphanumeric with underscores, 5-32 chars
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(cleanInput)) {
    return null;
  }

  return `https://t.me/${cleanInput}`;
}

async function handleGroupSelection(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  currentGroup: string | undefined,
  currentChannel: string | undefined
): Promise<string | undefined> {
  await ctx.reply('Please select your main group or type "cancel" to skip:', {
    reply_markup: {
      keyboard: [
        [
          {
            text: "🏠 Select Group",
            request_chat: {
              request_id: 1,
              chat_is_channel: false,
              bot_is_member: false,
            },
          },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });

  try {
    const groupResponse = await conversation.waitFor([
      "message:chat_shared",
      "message:text",
    ]);

    if (groupResponse.message?.text?.toLowerCase() === "cancel") {
      await ctx.reply("❌ Group selection cancelled.");
      return currentGroup;
    } else if (groupResponse.message?.chat_shared) {
      const newGroup = `https://t.me/${groupResponse.message.chat_shared.chat_id}`;
      await ctx.reply(`✅ Group selected: ${newGroup}`);
      return newGroup;
    }
  } catch (error) {
    console.log("Group selection error:", error);
    await ctx.reply("❌ Group selection failed.");
  }

  await ctx.reply("Continuing...", { reply_markup: { remove_keyboard: true } });
  return currentGroup;
}

async function handleChannelSelection(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  currentGroup: string | undefined,
  currentChannel: string | undefined
): Promise<string | undefined> {
  await ctx.reply(
    'Please select your announcement channel or type "cancel" to skip:',
    {
      reply_markup: {
        keyboard: [
          [
            {
              text: "📢 Select Channel",
              request_chat: {
                request_id: 2,
                chat_is_channel: true,
                bot_is_member: false,
              },
            },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );

  try {
    const channelResponse = await conversation.waitFor([
      "message:chat_shared",
      "message:text",
    ]);

    if (channelResponse.message?.text?.toLowerCase() === "cancel") {
      await ctx.reply("❌ Channel selection cancelled.");
      return currentChannel;
    } else if (channelResponse.message?.chat_shared) {
      const newChannel = `https://t.me/${channelResponse.message.chat_shared.chat_id}`;
      await ctx.reply(`✅ Channel selected: ${newChannel}`);
      return newChannel;
    }
  } catch (error) {
    console.log("Channel selection error:", error);
    await ctx.reply("❌ Channel selection failed.");
  }

  await ctx.reply("Continuing...", { reply_markup: { remove_keyboard: true } });
  return currentChannel;
}

async function handleManualTelegramLinks(
  conversation: Conversation<MyContext>,
  ctx: MyContext
): Promise<{ group: string | undefined; channel: string | undefined }> {
  let telegramGroup: string | undefined;
  let telegramChannel: string | undefined;

  await ctx.reply(
    "Please provide the full URL for your Telegram group (e.g., https://t.me/your_group_name) or skip.",
    {
      reply_markup: new InlineKeyboard().text(
        "⏭️ Skip Group",
        "skip_manual_group"
      ),
    }
  );

  const manualGroupResponse = await conversation.waitFor([
    "message:text",
    "callback_query:data",
  ]);
  if (manualGroupResponse.callbackQuery?.data === "skip_manual_group") {
    try {
      await manualGroupResponse.answerCallbackQuery("✅ Skipped group");
    } catch (error) {
      // Ignore callback query timeout errors
    }
    await ctx.reply("❌ Telegram group skipped.");
  } else if (manualGroupResponse.message?.text) {
    const manualGroupInput = manualGroupResponse.message.text;
    try {
      const url = new URL(manualGroupInput);
      if (url.hostname.includes("t.me")) {
        telegramGroup = manualGroupInput;
        await ctx.reply(`✅ Group URL: ${telegramGroup}`);
      } else {
        await ctx.reply("❌ Please provide a valid Telegram group URL.");
      }
    } catch (e) {
      await ctx.reply("❌ Invalid URL format.");
    }
  }

  await ctx.reply(
    "Please provide the full URL for your Telegram channel (e.g., https://t.me/your_channel_name) or skip.",
    {
      reply_markup: new InlineKeyboard().text(
        "⏭️ Skip Channel",
        "skip_manual_channel"
      ),
    }
  );

  const manualChannelResponse = await conversation.waitFor([
    "message:text",
    "callback_query:data",
  ]);
  if (manualChannelResponse.callbackQuery?.data === "skip_manual_channel") {
    try {
      await manualChannelResponse.answerCallbackQuery("✅ Skipped channel");
    } catch (error) {
      // Ignore callback query timeout errors
    }
    await ctx.reply("❌ Telegram channel skipped.");
  } else if (manualChannelResponse.message?.text) {
    const manualChannelInput = manualChannelResponse.message.text;
    try {
      const url = new URL(manualChannelInput);
      if (url.hostname.includes("t.me")) {
        telegramChannel = manualChannelInput;
        await ctx.reply(`✅ Channel URL: ${telegramChannel}`);
      } else {
        await ctx.reply("❌ Please provide a valid Telegram channel URL.");
      }
    } catch (e) {
      await ctx.reply("❌ Invalid URL format.");
    }
  }

  return { group: telegramGroup, channel: telegramChannel };
}

export async function onboardingConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext
) {
  const user = ctx.from;
  if (!user) return;

  // Track message IDs for deletion
  let previousStepMessageId: number | undefined;

  // Check if user already has a registered token
  // Add a small delay to ensure database operations have completed
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const existingAdmins = await dbService.getAdminsByTelegramId(user.id);

  if (existingAdmins.length > 0) {
    // User has an existing token, offer to edit it
    const existingAdmin = existingAdmins[0];
    const existingProject = await dbService.getProjectById(
      existingAdmin.project_id
    );
    
    // If project doesn't exist (was deleted), clean up orphaned admin record and proceed with new registration
    if (!existingProject) {
      console.log(`Cleaning up orphaned admin record for user ${user.id}`);
      await dbService.deleteAdminByTelegramId(user.id);
      // Continue with normal registration flow below
    } else {
      // Project exists, show edit interface
      await sendTyping(ctx);

      // Show current token information
      let currentInfo = `<b>Edit Your Token</b>\n\n`;
      currentInfo += `Token: <b>${escapeHtml(existingProject.name)}</b>\n\n`;
      currentInfo += `💖 <b>Contract:</b> <code>${existingProject.contract_address}</code>\n`;
      currentInfo += `💖 <b>Chains:</b> ${existingProject.chains.join(", ")}\n`;
      currentInfo += `💖 <b>Market Cap:</b> ${existingProject.market_cap}\n`;

      // Add categories if available
      if (existingProject.categories && existingProject.categories.length > 0) {
        currentInfo += `💖 <b>Categories:</b> ${existingProject.categories.join(
          ", "
        )}\n`;
      }

      // Add description if available
      if (existingProject.description) {
        currentInfo += `💖 <b>Description:</b> ${escapeHtml(
          existingProject.description
        )}\n`;
      }

      if (
        existingProject.telegram_group ||
        existingProject.telegram_channel ||
        existingProject.x_account
      ) {
        currentInfo += `\n💖 <b>Community:</b>\n`;
        if (existingProject.telegram_group) {
          currentInfo += `• <a href="${existingProject.telegram_group}">Telegram Group</a>\n`;
        }
        if (existingProject.telegram_channel) {
          currentInfo += `• <a href="${existingProject.telegram_channel}">Announcement Channel</a>\n`;
        }
        if (existingProject.x_account) {
          currentInfo += `• <a href="https://x.com/${escapeHtml(
            existingProject.x_account.replace("@", "")
          )}">X (Twitter)</a>\n`;
        }
      }

      currentInfo += `\n💖 <b>Admins:</b> ${existingProject.admin_handles
        .map((handle) => `@${escapeHtml(handle)}`)
        .join(", ")}\n`;
      currentInfo += `\nWould you like to edit this information?`;

      // Show with logo if available
      const editKeyboard = new InlineKeyboard()
        .text("Edit Token Info", "edit_token_confirm")
        .row()
        .text("Back to Menu", "return_to_menu");

      if (existingProject.logo_file_id) {
        try {
          await ctx.replyWithPhoto(existingProject.logo_file_id, {
            caption: currentInfo,
            parse_mode: "HTML",
            reply_markup: editKeyboard,
          });
        } catch (error) {
          // Fallback to text if photo fails
          await ctx.reply(currentInfo, {
            parse_mode: "HTML",
            reply_markup: editKeyboard,
          });
        }
      } else {
        await ctx.reply(currentInfo, {
          parse_mode: "HTML",
          reply_markup: editKeyboard,
        });
      }

      // Wait for user decision
      const response = await conversation.waitFor("callback_query:data");
      try {
        await response.answerCallbackQuery();
      } catch (error) {
        // Ignore callback query timeout errors
      }

      if (response.callbackQuery.data === "return_to_menu") {
        return;
      }

      if (response.callbackQuery.data === "edit_token_confirm") {
        // Proceed with editing flow using existing project data
        await editExistingToken(conversation, ctx, existingProject);
        return;
      }
    }
  }

  // New user or no existing token - proceed with normal onboarding
  await sendTyping(ctx);

  // Send step 1 and track the message ID
  try {
    // Send icon image first
    const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
    const iconFile = new InputFile(iconPath);
    await ctx.replyWithPhoto(iconFile);

    // Then send message and store its ID
    const step1Message = await ctx.reply(
      ` **Let's register your token!**\n\nI'll guide you through the process step by step. You can type /cancel at any time to stop.\n\n**Step 1/8:** What's your token name?`,
      { parse_mode: "Markdown" }
    );
    previousStepMessageId = step1Message.message_id;
  } catch (error) {
    // If icon fails to send, just send text message and track it
    console.warn("Failed to send icon, using text only:", error);
    const step1Message = await ctx.reply(
      ` **Let's register your token!**\n\nI'll guide you through the process step by step. You can type /cancel at any time to stop.\n\n**Step 1/8:** What's your token name?`,
      { parse_mode: "Markdown" }
    );
    previousStepMessageId = step1Message.message_id;
  }

  // Step 1: Token Name
  const nameResponse = await conversation.waitFor("message:text");
  const projectName = nameResponse.message.text;

  // Check if user typed a command
  if (projectName.startsWith("/start")) {
    // Exit conversation and show main menu
    const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
    const keyboard = await createMenuKeyboard(user.id);

    let welcomeMessage = `💖 Congratulations — you've made it to Matchmaker!\n\n`;
    welcomeMessage += `Struggling to make connections out there? Don't worry — Matchmaker has got you covered.\n\n`;
    welcomeMessage += `Before we can pair you with your perfect block-mates, we need to get to know your project. You're just a few clicks away from meeting your perfect soul-projects.\n\n`;
    welcomeMessage += `Tap "Set Me Up" below to mint your profile. 💖`;

    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: welcomeMessage,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    return;
  }

  if (projectName.startsWith("/cancel")) {
    // Exit conversation and show main menu
    const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
    const keyboard = await createMenuKeyboard(user.id);

    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: "❌ Operation cancelled. Choose an option:",
      reply_markup: keyboard,
    });
    return;
  }

  if (projectName.trim().length < 2 || projectName.trim().length > 100) {
    await ctx.reply("❌ Token name must be between 2 and 100 characters.");
    const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
    const keyboard = await createMenuKeyboard(user.id);
    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: "Choose an option:",
      reply_markup: keyboard,
    });
    return;
  }

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const step2Message = await ctx.reply(
    `✅ Token name: <b>${escapeHtml(
      projectName.trim()
    )}</b>\n\n<b>Step 2/8:</b> Please send your token logo or GIF.`,
    {
      parse_mode: "HTML",
    }
  );
  previousStepMessageId = step2Message.message_id;

  // Step 2: Logo/GIF
  let logoFileId: string | undefined;
  const logoResponse = await conversation.waitFor([
    "message:photo",
    "message:animation",
    "message:text",
  ]);

  if (logoResponse.message?.photo) {
    logoFileId =
      logoResponse.message.photo[logoResponse.message.photo.length - 1].file_id;
    await sendSimpleMessage(ctx, "✅ Logo received!");
  } else if (logoResponse.message?.animation) {
    logoFileId = logoResponse.message.animation.file_id;
    await sendSimpleMessage(ctx, "✅ GIF received!");
  } else if (logoResponse.message?.text?.toLowerCase() === "skip") {
    await ctx.reply(" Logo skipped.");
  } else {
    await ctx.reply('❌ Please send a photo/GIF or type "skip".');
    const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
    const keyboard = await createMenuKeyboard(user.id);
    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: "Choose an option:",
      reply_markup: keyboard,
    });
    return;
  }

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const step3Message = await ctx.reply(
    `**Step 3/8:** Which blockchain networks is your token on?\n\nSelect all that apply:`,
    {
      parse_mode: "Markdown",
      reply_markup: createChainKeyboard(),
    }
  );
  previousStepMessageId = step3Message.message_id;

  // Step 3: Chains
  const selectedChains: Chain[] = [];
  let chainSelectionDone = false;

  while (!chainSelectionDone) {
    const chainResponse = await conversation.waitFor("callback_query:data");
    const chainData = chainResponse.callbackQuery.data;

    if (chainData === "chains_done") {
      if (selectedChains.length === 0) {
        try {
          await chainResponse.answerCallbackQuery(
            "❌ Please select at least one chain."
          );
        } catch (error) {
          // Ignore callback query timeout errors
          console.log("Callback query timeout - continuing...");
        }
        continue;
      }
      chainSelectionDone = true;
      try {
        await chainResponse.answerCallbackQuery("✅ Chains selected!");
      } catch (error) {
        // Ignore callback query timeout errors
        console.log("Callback query timeout - continuing...");
      }
    } else if (chainData.startsWith("chain_")) {
      const chain = chainData.replace("chain_", "") as Chain;

      let wasAdded = false;
      if (selectedChains.includes(chain)) {
        selectedChains.splice(selectedChains.indexOf(chain), 1);
        wasAdded = false;
      } else {
        selectedChains.push(chain);
        wasAdded = true;
      }

      // Update keyboard first, then send callback response
      try {
        await chainResponse.editMessageReplyMarkup({
          reply_markup: createChainKeyboard(selectedChains),
        });
      } catch (error) {
        console.error("Error updating keyboard:", error);
      }

      try {
        await chainResponse.answerCallbackQuery(
          `${wasAdded ? "Added" : "Removed"} ${chain}`
        );
      } catch (error) {
        // Ignore callback query timeout errors
        console.log("Callback query timeout - continuing...");
      }
    }
  }

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const step4Message = await ctx.reply(
    `✅ Selected chains: ${selectedChains.join(
      ", "
    )}\n\n**Step 4/8:** What's your contract address?\n\n*Please provide the main token contract address.*`,
    {
      parse_mode: "Markdown",
    }
  );
  previousStepMessageId = step4Message.message_id;

  // Step 4: Contract Address
  const contractAddress = await conversation.form.text();

  // Check if user typed /start to return to menu
  if (contractAddress.startsWith("/start")) {
    // Exit conversation and show main menu
    const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
    const keyboard = await createMenuKeyboard(user.id);

    let welcomeMessage = `💖 Congratulations — you've made it to Matchmaker!\n\n`;
    welcomeMessage += `Struggling to make connections out there? Don't worry — Matchmaker has got you covered.\n\n`;
    welcomeMessage += `Before we can pair you with your perfect block-mates, we need to get to know your project. You're just a few clicks away from meeting your perfect soul-projects.\n\n`;
    welcomeMessage += `Tap "Set Me Up" below to mint your profile. 💖`;

    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: welcomeMessage,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    return;
  }

  if (contractAddress.trim().length < 10) {
    await ctx.reply("❌ Please provide a valid contract address.");
    const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
    const keyboard = await createMenuKeyboard(user.id);
    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: "Choose an option:",
      reply_markup: keyboard,
    });
    return;
  }

  // Check if contract already exists
  const existingProject = await dbService.getProjectByContractAddress(
    contractAddress.trim()
  );
  if (existingProject) {
    await ctx.reply(
      `❌ This contract address is already registered for project: <b>${escapeHtml(
        existingProject.name
      )}</b>`,
      {
        parse_mode: "HTML",
      }
    );
    const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
    const keyboard = await createMenuKeyboard(user.id);
    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: "Choose an option:",
      reply_markup: keyboard,
    });
    return;
  }

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const step5Message = await ctx.reply(
    `**Step 5/8:** What's your X (Twitter) account?\n\n*Please provide your X handle (e.g., @yourproject).*`,
    {
      parse_mode: "Markdown",
    }
  );
  previousStepMessageId = step5Message.message_id;

  // Step 5: X Account
  let xAccount: string | undefined;
  const xAccountResponse = await conversation.waitFor(["message:text"]);

  if (xAccountResponse.message?.text) {
    const xAccountInput = xAccountResponse.message.text.trim();

    // Check if user typed /start to return to menu
    if (xAccountInput.startsWith("/start")) {
      // Exit conversation and show main menu
      const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
      const keyboard = await createMenuKeyboard(user.id);

      let welcomeMessage = `💖 Congratulations — you've made it to Matchmaker!\n\n`;
      welcomeMessage += `Struggling to make connections out there? Don't worry — Matchmaker has got you covered.\n\n`;
      welcomeMessage += `Before we can pair you with your perfect block-mates, we need to get to know your project. You're just a few clicks away from meeting your perfect soul-projects.\n\n`;
      welcomeMessage += `Tap "Set Me Up" below to mint your profile. 💖`;

      await ctx.replyWithPhoto(new InputFile(iconPath), {
        caption: welcomeMessage,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      return;
    }

    if (xAccountInput.toLowerCase() === "skip") {
      await ctx.reply(" X account skipped.");
    } else {
      // Clean the X handle (remove @ if present, add it back)
      let cleanHandle = xAccountInput.replace("@", "").trim();
      if (cleanHandle.length > 0) {
        xAccount = `@${cleanHandle}`;
        await ctx.reply(`✅ X account: <b>${escapeHtml(xAccount)}</b>`, {
          parse_mode: "HTML",
        });
      } else {
        await ctx.reply(" X account skipped.");
      }
    }
  }

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  // Fetch token information from APIs
  await sendTyping(ctx);
  const fetchingMessage = await ctx.reply(
    `🔍 **Fetching token information...**\n\nI'm getting the latest market data for your token from CoinGecko and DexScreener. This will help others see real-time information when browsing your token.`
  );
  previousStepMessageId = fetchingMessage.message_id;

  // Fetch token information from APIs
  let tokenInfo = null;
  try {
    // Try to fetch from the first selected chain
    const primaryChain = selectedChains[0];
    tokenInfo = await tokenInfoService.fetchTokenInfo(
      contractAddress.trim(),
      primaryChain
    );

    if (tokenInfo) {
      await sendTyping(ctx);
      await ctx.reply(
        `✅ **Token information fetched successfully!**\n\n **Market Data:**\n• **Price:** ${tokenInfoService.formatPrice(
          tokenInfo.price
        )}\n• **Market Cap:** ${tokenInfoService.formatMarketCap(
          tokenInfo.marketCap
        )}\n• **24h Volume:** ${tokenInfoService.formatVolume(
          tokenInfo.volume24h
        )}\n• **24h Change:** ${tokenInfoService.formatPriceChange(
          tokenInfo.priceChange24h
        )}\n\n **Links Found:**\n${
          tokenInfo.telegramGroup
            ? `• [Telegram Group](${tokenInfo.telegramGroup})\n`
            : ""
        }${
          tokenInfo.twitterHandle
            ? `• [Twitter](${tokenInfo.twitterHandle})\n`
            : ""
        }${tokenInfo.website ? `• [Website](${tokenInfo.website})\n` : ""}`
      );
    } else {
      await sendTyping(ctx);
      await ctx.reply(
        `ℹ️ **Token information not found**\n\nI couldn't find market data for your token on the selected chains. This is normal for new or private tokens. You can still register and match with other projects!`
      );
    }
  } catch (error) {
    console.error("Error fetching token info:", error);
    await sendTyping(ctx);
    await ctx.reply(
      `ℹ️ **Token information fetch failed**\n\nThere was an issue fetching market data, but you can still register your token and start matching!`
    );
  }

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const step6Message = await ctx.reply(
    `**Step 6/8:** Select your project categories (up to 3)\n\nChoose categories that best describe your project:`,
    {
      parse_mode: "Markdown",
      reply_markup: createCategoryKeyboard(),
    }
  );
  previousStepMessageId = step6Message.message_id;

  // Step 6: Categories
  const selectedCategories: string[] = [];
  let categorySelectionDone = false;

  while (!categorySelectionDone) {
    const categoryResponse = await conversation.waitFor("callback_query:data");

    const data = categoryResponse.callbackQuery.data;

    if (data === "categories_done") {
      try {
        await categoryResponse.answerCallbackQuery("✅ Categories selected!");
      } catch (error) {
        // Ignore callback query timeout errors
      }
      categorySelectionDone = true;
    } else if (data.startsWith("category_")) {
      const category = data.replace("category_", "");

      let wasAdded = false;
      let feedbackMessage = "";

      if (selectedCategories.includes(category)) {
        selectedCategories.splice(selectedCategories.indexOf(category), 1);
        wasAdded = false;
        feedbackMessage = `Removed ${category}`;
      } else if (selectedCategories.length < 3) {
        selectedCategories.push(category);
        wasAdded = true;
        feedbackMessage = `Added ${category}`;
      } else {
        feedbackMessage = "❌ You can select up to 3 categories only.";
      }

      try {
        await categoryResponse.answerCallbackQuery(feedbackMessage);
      } catch (error) {
        // Ignore callback query timeout errors
      }

      // Always update keyboard for visual feedback, except when limit is reached and nothing was changed
      if (feedbackMessage !== "❌ You can select up to 3 categories only.") {
        try {
          await categoryResponse.editMessageReplyMarkup({
            reply_markup: createCategoryKeyboard(selectedCategories),
          });
        } catch (error) {
          console.error("Error updating category keyboard:", error);
        }
      }
    }
  }

  let categoriesText =
    selectedCategories.length > 0
      ? selectedCategories.join(", ")
      : "None selected";
  await safeReply(
    ctx,
    `✅ Selected categories: <b>${escapeHtml(categoriesText)}</b>`,
    { parse_mode: "HTML" }
  );

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const step7Message = await ctx.reply(
    `<b>Step 7/8:</b> Describe your project in one sentence\n\n<i>Enter your project description.</i>`,
    {
      parse_mode: "HTML",
    }
  );
  previousStepMessageId = step7Message.message_id;

  // Step 7: Description
  const description = await conversation.form.text();

  // Check if user typed /start to return to menu
  if (description.startsWith("/start")) {
    // Exit conversation and show main menu
    const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
    const keyboard = await createMenuKeyboard(user.id);

    let welcomeMessage = `💖 Congratulations — you've made it to Matchmaker!\n\n`;
    welcomeMessage += `Struggling to make connections out there? Don't worry — Matchmaker has got you covered.\n\n`;
    welcomeMessage += `Before we can pair you with your perfect block-mates, we need to get to know your project. You're just a few clicks away from meeting your perfect soul-projects.\n\n`;
    welcomeMessage += `Tap "Set Me Up" below to mint your profile. 💖`;

    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: welcomeMessage,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    return;
  }

  if (description.trim().length > 500) {
    await ctx.reply(
      "❌ Description must be 500 characters or less. Please try again."
    );
    const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
    const keyboard = await createMenuKeyboard(user.id);
    await ctx.replyWithPhoto(new InputFile(iconPath), {
      caption: "Choose an option:",
      reply_markup: keyboard,
    });
    return;
  }

  await ctx.reply(`✅ Description: <b>${escapeHtml(description.trim())}</b>`, {
    parse_mode: "HTML",
  });

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const step8Message = await ctx.reply(
    `**Step 8/8:** Connect your Telegram community (optional)\n\nLet's connect your Telegram spaces so your community can discover and engage with potential collaborations!`,
    { parse_mode: "Markdown" }
  );
  previousStepMessageId = step8Message.message_id;

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  // Step 8: Enhanced Telegram Setup
  let telegramGroup: string | undefined;
  let telegramChannel: string | undefined;
  let telegramSetupDone = false;

  // Show the enhanced setup hub
  await showTelegramSetupHub(ctx, telegramGroup, telegramChannel);

  while (!telegramSetupDone) {
    const telegramResponse = await conversation.waitFor("callback_query:data");
    try {
      await telegramResponse.answerCallbackQuery();
    } catch (error) {
      // Ignore callback query timeout errors
    }

    const telegramAction = telegramResponse.callbackQuery.data;

    if (telegramAction === "telegram_add_group") {
      const result = await handleEnhancedGroupSelection(conversation, ctx);
      if (result.success) {
        telegramGroup = result.groupUrl;
      }
      // Show updated hub
      await showTelegramSetupHub(ctx, telegramGroup, telegramChannel);
    } else if (telegramAction === "telegram_reset_setup") {
      telegramGroup = undefined;
      telegramChannel = undefined;
      await ctx.reply(
        "🔄 **Setup Reset**\n\nStarting fresh with your Telegram connections.",
        { parse_mode: "Markdown" }
      );
      await showTelegramSetupHub(ctx, telegramGroup, telegramChannel);
    } else if (telegramAction === "telegram_manual_entry") {
      const result = await handleEnhancedManualEntry(conversation, ctx);
      telegramGroup = result.groupUrl;
      telegramChannel = result.channelUrl;
      telegramSetupDone = true;
    } else if (telegramAction === "telegram_setup_complete") {
      if (telegramGroup || telegramChannel) {
        await ctx.reply(
          "✅ **Telegram setup completed!** Your community connections are ready.",
          { parse_mode: "Markdown" }
        );
      } else {
        await ctx.reply(
          "⏭️ **Telegram setup skipped.** You can add connections later from your profile.",
          { parse_mode: "Markdown" }
        );
      }
      telegramSetupDone = true;
    }
  }

  // Set default admin handle from user
  const adminHandles = [user.username || user.first_name || `user_${user.id}`];

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  // Create project
  await sendTyping(ctx);
  await ctx.reply("💖 Creating your project registration...");

  try {
    const projectData: Omit<Project, "id" | "created_at" | "updated_at"> = {
      name: projectName.trim(),
      logo_file_id: logoFileId,
      contract_address: contractAddress.trim(),
      chains: selectedChains,
      market_cap: "MATCH_ANYTHING", // Default market cap
      categories: selectedCategories,
      description: description.trim(),
      telegram_group: telegramGroup,
      telegram_channel: telegramChannel,
      x_account: xAccount,
      admin_handles: adminHandles,
      is_active: true,
      verified: true, // Auto-verify since we're removing verification
      // Add token info if available
      ...(tokenInfo && {
        token_symbol: tokenInfo.symbol,
        token_price: tokenInfo.price || undefined,
        token_price_change_24h: tokenInfo.priceChange24h || undefined,
        token_volume_24h: tokenInfo.volume24h || undefined,
        token_market_cap_api: tokenInfo.marketCap || undefined,
        token_telegram_group_api: tokenInfo.telegramGroup || undefined,
        token_twitter_handle: tokenInfo.twitterHandle || undefined,
        token_website: tokenInfo.website || undefined,
        token_description: tokenInfo.description || undefined,
        token_logo_url: tokenInfo.logoUrl || undefined,
        token_info_last_updated: new Date(),
      }),
    };

    const project = await dbService.createProject(projectData);

    // Create or update admin record (handles existing users)
    await dbService.createOrUpdateAdmin({
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      project_id: project.id || "",
    });

    // Create token card in the same format as browsing
    let card = `Token Registration Complete!\n\n`;
    card += `💞 Token: **${project.name.replace(
      /[*_`[\]()~>#+=|{}.!-]/g,
      "\\$&"
    )}**\n\n`;

    card += `💞 **Project Info:**\n`;
    card += `• **Chains:** ${project.chains.join(", ")}\n`;
    // Add categories if available
    if (project.categories && project.categories.length > 0) {
      card += `• **Categories:** ${project.categories.join(", ")}\n`;
    }
    // Add description if available
    if (project.description) {
      card += `• **Description:** ${project.description.replace(
        /[*_`[\]()~>#+=|{}.!-]/g,
        "\\$&"
      )}\n`;
    }

    // Add real-time market data if available
    if (
      project.token_price ||
      project.token_market_cap_api ||
      project.token_volume_24h
    ) {
      card += `\n💞 **Live Market Data:**\n`;
      if (project.token_price) {
        const priceChange = project.token_price_change_24h;
        const changeText = priceChange
          ? ` (${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(2)}%)`
          : "";
        card += `• **Price:** $${project.token_price.toFixed(
          6
        )}${changeText}\n`;
      }
      if (project.token_market_cap_api) {
        const marketCap = project.token_market_cap_api;
        let formattedMarketCap = "";
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
        let formattedVolume = "";
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
    if (project.x_account) {
      socialLinks.push(
        `[X (Twitter)](https://x.com/${project.x_account.replace("@", "")})`
      );
    }
    if (project.token_telegram_group_api) {
      socialLinks.push(
        `[Official Telegram](${project.token_telegram_group_api})`
      );
    }
    if (project.token_twitter_handle) {
      socialLinks.push(`[Twitter](${project.token_twitter_handle})`);
    }
    if (project.token_website) {
      socialLinks.push(`[Website](${project.token_website})`);
    }

    if (socialLinks.length > 0) {
      card += `\n💞 **Community:**\n`;
      card += socialLinks.map((link) => `• ${link}`).join("\n") + "\n";
    }

    card += `\n**Registered:** ${
      project.created_at?.toLocaleDateString() || "Unknown"
    }\n`;
    card += `\n**Contract:** \`${project.contract_address}\`\n`;
    card += `\nYou can now start browsing and matching with other tokens!`;

    // Create buttons with Start Matching on top
    const completionButtons = new InlineKeyboard()
      .text("💕 Start Matching 💞", "start_browsing")
      .row()
      .text("Main Menu", "return_to_menu");

    // Send the registration completion card
    if (project.logo_file_id) {
      try {
        await ctx.replyWithPhoto(project.logo_file_id, {
          caption: card,
          parse_mode: "Markdown",
          reply_markup: completionButtons,
        });
      } catch (error) {
        // Fallback to text if logo fails
        await ctx.reply(card, {
          parse_mode: "Markdown",
          reply_markup: completionButtons,
        });
      }
    } else {
      await ctx.reply(card, {
        parse_mode: "Markdown",
        reply_markup: completionButtons,
      });
    }
  } catch (error) {
    console.error("Error creating project:", error);
    await ctx.reply(
      "❌ An error occurred while registering your project. Please try again or contact support."
    );
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

  keyboard.text("✅ Done", "chains_done");
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
  keyboard.text(" Skip This Step", "edit_skip_market_cap");
  return keyboard;
}

function createCategoryKeyboard(selected: string[] = []): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const categories = Object.values(Category);

  for (let i = 0; i < categories.length; i += 2) {
    const category1 = categories[i];
    const category2 = categories[i + 1];

    const button1Text = selected.includes(category1)
      ? `✅ ${category1}`
      : category1;
    keyboard.text(button1Text, `category_${category1}`);

    if (category2) {
      const button2Text = selected.includes(category2)
        ? `✅ ${category2}`
        : category2;
      keyboard.text(button2Text, `category_${category2}`);
    }

    keyboard.row();
  }

  keyboard.text("✅ Done", "categories_done");
  return keyboard;
}

function createCategoryKeyboardWithSkip(
  selected: string[] = []
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const categories = Object.values(Category);

  for (let i = 0; i < categories.length; i += 2) {
    const category1 = categories[i];
    const category2 = categories[i + 1];

    const button1Text = selected.includes(category1)
      ? `✅ ${category1}`
      : category1;
    keyboard.text(button1Text, `category_${category1}`);

    if (category2) {
      const button2Text = selected.includes(category2)
        ? `✅ ${category2}`
        : category2;
      keyboard.text(button2Text, `category_${category2}`);
    }

    keyboard.row();
  }

  keyboard.text("✅ Done", "categories_done");
  keyboard.text(" Skip This Step", "edit_skip_categories").row();
  return keyboard;
}

async function editExistingToken(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  existingProject: Project
) {
  const user = ctx.from;
  if (!user) return;

  // Track message IDs for deletion
  let previousStepMessageId: number | undefined;

  await sendTyping(ctx);
  const editStep1Message = await ctx.reply(
    ` **Editing your token: ${escapeMarkdown(
      existingProject.name
    )}**\n\nI'll guide you through updating each field. You can skip any field to keep the current value.\n\n**Step 1/8:** Token name\n\nCurrent: **${escapeMarkdown(
      existingProject.name
    )}**\n\nEnter new name or skip:`,
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().text(
        " Skip This Step",
        "edit_skip_name"
      ),
    }
  );
  previousStepMessageId = editStep1Message.message_id;

  // Step 1: Token Name
  let projectName = existingProject.name;
  const nameResponse = await conversation.waitFor([
    "message:text",
    "callback_query:data",
  ]);

  if (nameResponse.callbackQuery?.data === "edit_skip_name") {
    try {
      await nameResponse.answerCallbackQuery("✅ Skipped name update");
    } catch (error) {
      // Ignore callback query timeout errors
    }
    await safeReply(
      ctx,
      `✅ Keeping current name: <b>${escapeHtml(projectName)}</b>`,
      { parse_mode: "HTML" }
    );
  } else if (nameResponse.message?.text) {
    const projectNameInput = nameResponse.message.text;

    // Check if user typed /start to return to menu
    if (projectNameInput.startsWith("/start")) {
      // Exit conversation and show main menu
      const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
      const keyboard = await createMenuKeyboard(user.id);

      let welcomeMessage = `💖 Congratulations — you've made it to Matchmaker!\n\n`;
      welcomeMessage += `Struggling to make connections out there? Don't worry — Matchmaker has got you covered.\n\n`;
      welcomeMessage += `Before we can pair you with your perfect block-mates, we need to get to know your project. You're just a few clicks away from meeting your perfect soul-projects.\n\n`;
      welcomeMessage += `Tap "Set Me Up" below to mint your profile. 💖`;

      await ctx.replyWithPhoto(new InputFile(iconPath), {
        caption: welcomeMessage,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      return;
    }

    if (
      projectNameInput.trim().length < 2 ||
      projectNameInput.trim().length > 100
    ) {
      await ctx.reply(
        "❌ Token name must be between 2 and 100 characters. Keeping current name."
      );
    } else {
      projectName = projectNameInput.trim();
      await safeReply(
        ctx,
        `✅ Updated token name: <b>${escapeHtml(projectName)}</b>`,
        { parse_mode: "HTML" }
      );
    }
  }

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const editStep2Message = await ctx.reply(
    `**Step 2/8:** Token logo or GIF\n\nCurrent: ${
      existingProject.logo_file_id ? "Logo uploaded" : "No logo"
    }\n\nSend new logo/GIF or skip to keep current:`,
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().text(
        " Skip This Step",
        "edit_skip_logo"
      ),
    }
  );
  previousStepMessageId = editStep2Message.message_id;

  // Step 2: Logo/GIF
  let logoFileId = existingProject.logo_file_id;
  const logoResponse = await conversation.waitFor([
    "message:photo",
    "message:animation",
    "callback_query:data",
  ]);

  if (logoResponse.callbackQuery?.data === "edit_skip_logo") {
    try {
      await logoResponse.answerCallbackQuery("✅ Skipped logo update");
    } catch (error) {
      // Ignore callback query timeout errors
    }
    await ctx.reply("✅ Keeping current logo.");
  } else if (logoResponse.message?.photo) {
    logoFileId =
      logoResponse.message.photo[logoResponse.message.photo.length - 1].file_id;
    await sendSimpleMessage(ctx, "✅ New logo received!");
  } else if (logoResponse.message?.animation) {
    logoFileId = logoResponse.message.animation.file_id;
    await sendSimpleMessage(ctx, "✅ New GIF received!");
  }

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const editStep3Message = await ctx.reply(
    `**Step 3/8:** Blockchain networks\n\nCurrent: ${existingProject.chains.join(
      ", "
    )}\n\nSelect new chains:`,
    {
      parse_mode: "Markdown",
      reply_markup: createChainKeyboard(existingProject.chains as Chain[]),
    }
  );
  previousStepMessageId = editStep3Message.message_id;

  // Step 3: Chains
  const selectedChains: Chain[] = [...(existingProject.chains as Chain[])];
  let chainSelectionDone = false;

  while (!chainSelectionDone) {
    const chainResponse = await conversation.waitFor("callback_query:data");
    const chainData = chainResponse.callbackQuery.data;

    if (chainData === "chains_done") {
      if (selectedChains.length === 0) {
        try {
          await chainResponse.answerCallbackQuery(
            "❌ Please select at least one chain."
          );
        } catch (error) {
          console.log("Callback query timeout - continuing...");
        }
        continue;
      }
      chainSelectionDone = true;
      try {
        await chainResponse.answerCallbackQuery("✅ Chains updated!");
      } catch (error) {
        console.log("Callback query timeout - continuing...");
      }
    } else if (chainData.startsWith("chain_")) {
      const chain = chainData.replace("chain_", "") as Chain;

      let wasAdded = false;
      if (selectedChains.includes(chain)) {
        selectedChains.splice(selectedChains.indexOf(chain), 1);
        wasAdded = false;
      } else {
        selectedChains.push(chain);
        wasAdded = true;
      }

      // Update keyboard first, then send callback response
      try {
        await chainResponse.editMessageReplyMarkup({
          reply_markup: createChainKeyboard(selectedChains),
        });
      } catch (error) {
        console.error("Error updating keyboard:", error);
      }

      try {
        await chainResponse.answerCallbackQuery(
          `${wasAdded ? "Added" : "Removed"} ${chain}`
        );
      } catch (error) {
        console.log("Callback query timeout - continuing...");
      }
    }
  }

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const editStep4Message = await ctx.reply(
    `✅ Updated chains: ${selectedChains.join(
      ", "
    )}\n\n**Step 4/8:** Contract address\n\nCurrent: \`${
      existingProject.contract_address
    }\`\n\nEnter new contract address or skip:`,
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().text(
        " Skip This Step",
        "edit_skip_contract"
      ),
    }
  );
  previousStepMessageId = editStep4Message.message_id;

  // Step 4: Contract Address
  let contractAddress = existingProject.contract_address;
  const contractResponse = await conversation.waitFor([
    "message:text",
    "callback_query:data",
  ]);

  if (contractResponse.callbackQuery?.data === "edit_skip_contract") {
    try {
      await contractResponse.answerCallbackQuery("✅ Skipped contract update");
    } catch (error) {
      // Ignore callback query timeout errors
    }
    await safeReply(
      ctx,
      `✅ Keeping current contract: <code>${escapeHtml(
        contractAddress
      )}</code>`,
      { parse_mode: "HTML" }
    );
  } else if (contractResponse.message?.text) {
    const contractInput = contractResponse.message.text;

    // Check if user typed /start to return to menu
    if (contractInput.startsWith("/start")) {
      // Exit conversation and show main menu
      const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
      const keyboard = await createMenuKeyboard(user.id);

      let welcomeMessage = `💖 Congratulations — you've made it to Matchmaker!\n\n`;
      welcomeMessage += `Struggling to make connections out there? Don't worry — Matchmaker has got you covered.\n\n`;
      welcomeMessage += `Before we can pair you with your perfect block-mates, we need to get to know your project. You're just a few clicks away from meeting your perfect soul-projects.\n\n`;
      welcomeMessage += `Tap "Set Me Up" below to mint your profile. 💖`;

      await ctx.replyWithPhoto(new InputFile(iconPath), {
        caption: welcomeMessage,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      return;
    }

    if (contractInput.trim().length < 10) {
      await ctx.reply(
        "❌ Please provide a valid contract address. Keeping current address."
      );
    } else {
      // Check if new contract already exists (but not for current project)
      const existingProjectWithContract =
        await dbService.getProjectByContractAddress(contractInput.trim());
      if (
        existingProjectWithContract &&
        existingProjectWithContract.id !== existingProject.id
      ) {
        await ctx.reply(
          `❌ This contract address is already registered for project: <b>${escapeHtml(
            existingProjectWithContract.name
          )}</b>. Keeping current address.`,
          {
            parse_mode: "HTML",
          }
        );
      } else {
        contractAddress = contractInput.trim();
        await safeReply(
          ctx,
          `✅ Updated contract address: <code>${escapeHtml(
            contractAddress
          )}</code>`,
          { parse_mode: "HTML" }
        );
      }
    }
  }

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const editStep5Message = await ctx.reply(
    `**Step 5/8:** X (Twitter) account\n\nCurrent: ${
      existingProject.x_account || "None"
    }\n\nEnter new X handle or skip:`,
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().text(
        " Skip This Step",
        "edit_skip_x_account"
      ),
    }
  );
  previousStepMessageId = editStep5Message.message_id;

  // Step 5: X Account
  let xAccount = existingProject.x_account;
  const xAccountResponse = await conversation.waitFor([
    "message:text",
    "callback_query:data",
  ]);

  if (xAccountResponse.callbackQuery?.data === "edit_skip_x_account") {
    try {
      await xAccountResponse.answerCallbackQuery("✅ Skipped X account update");
    } catch (error) {
      // Ignore callback query timeout errors
    }
    const currentXAccount = xAccount ? xAccount : "None";
    await safeReply(
      ctx,
      `✅ Keeping current X account: <b>${escapeHtml(currentXAccount)}</b>`,
      { parse_mode: "HTML" }
    );
  } else if (xAccountResponse.message?.text) {
    const xAccountInput = xAccountResponse.message.text.trim();

    // Check if user typed /start to return to menu
    if (xAccountInput.startsWith("/start")) {
      // Exit conversation and show main menu
      const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
      const keyboard = await createMenuKeyboard(user.id);

      let welcomeMessage = `💖 Congratulations — you've made it to Matchmaker!\n\n`;
      welcomeMessage += `Struggling to make connections out there? Don't worry — Matchmaker has got you covered.\n\n`;
      welcomeMessage += `Before we can pair you with your perfect block-mates, we need to get to know your project. You're just a few clicks away from meeting your perfect soul-projects.\n\n`;
      welcomeMessage += `Tap "Set Me Up" below to mint your profile. 💖`;

      await ctx.replyWithPhoto(new InputFile(iconPath), {
        caption: welcomeMessage,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      return;
    }

    if (xAccountInput.toLowerCase() === "skip") {
      await ctx.reply(" X account update skipped.");
    } else {
      // Clean the X handle (remove @ if present, add it back)
      let cleanHandle = xAccountInput.replace("@", "").trim();
      if (cleanHandle.length > 0) {
        xAccount = `@${cleanHandle}`;
        await safeReply(
          ctx,
          `✅ Updated X account: <b>${escapeHtml(xAccount)}</b>`,
          { parse_mode: "HTML" }
        );
      } else {
        await ctx.reply(" X account cleared.");
        xAccount = undefined;
      }
    }
  }

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const editStep6Message = await ctx.reply(
    `**Step 6/8:** Update project categories (up to 3)\n\nCurrent: ${
      existingProject.categories && existingProject.categories.length > 0
        ? existingProject.categories.join(", ")
        : "None"
    }\n\nSelect new categories or skip:`,
    {
      parse_mode: "Markdown",
      reply_markup: createCategoryKeyboardWithSkip(
        existingProject.categories || []
      ),
    }
  );
  previousStepMessageId = editStep6Message.message_id;

  // Step 6: Categories
  let selectedCategoriesEdit = existingProject.categories || [];
  let categoryEditSelectionDone = false;

  while (!categoryEditSelectionDone) {
    const categoryResponse = await conversation.waitFor("callback_query:data");

    const data = categoryResponse.callbackQuery.data;

    if (data === "edit_skip_categories") {
      try {
        await categoryResponse.answerCallbackQuery(
          "✅ Skipped categories update"
        );
      } catch (error) {
        // Ignore callback query timeout errors
      }
      const currentCategoriesText =
        selectedCategoriesEdit.length > 0
          ? selectedCategoriesEdit.join(", ")
          : "None";
      await safeReply(
        ctx,
        `✅ Keeping current categories: <b>${escapeHtml(
          currentCategoriesText
        )}</b>`,
        { parse_mode: "HTML" }
      );
      categoryEditSelectionDone = true;
    } else if (data === "categories_done") {
      try {
        await categoryResponse.answerCallbackQuery("✅ Categories updated!");
      } catch (error) {
        // Ignore callback query timeout errors
      }
      categoryEditSelectionDone = true;
      const updatedCategoriesText =
        selectedCategoriesEdit.length > 0
          ? selectedCategoriesEdit.join(", ")
          : "None";
      await safeReply(
        ctx,
        `✅ Updated categories: <b>${escapeHtml(updatedCategoriesText)}</b>`,
        { parse_mode: "HTML" }
      );
    } else if (data.startsWith("category_")) {
      const category = data.replace("category_", "");

      let wasAdded = false;
      let feedbackMessage = "";

      if (selectedCategoriesEdit.includes(category)) {
        selectedCategoriesEdit.splice(
          selectedCategoriesEdit.indexOf(category),
          1
        );
        wasAdded = false;
        feedbackMessage = `Removed ${category}`;
      } else if (selectedCategoriesEdit.length < 3) {
        selectedCategoriesEdit.push(category);
        wasAdded = true;
        feedbackMessage = `Added ${category}`;
      } else {
        feedbackMessage = "❌ You can select up to 3 categories only.";
      }

      try {
        await categoryResponse.answerCallbackQuery(feedbackMessage);
      } catch (error) {
        // Ignore callback query timeout errors
      }

      // Always update keyboard for visual feedback, except when limit is reached and nothing was changed
      if (feedbackMessage !== "❌ You can select up to 3 categories only.") {
        try {
          await categoryResponse.editMessageReplyMarkup({
            reply_markup: createCategoryKeyboardWithSkip(
              selectedCategoriesEdit
            ),
          });
        } catch (error) {
          console.error("Error updating category keyboard:", error);
        }
      }
    }
  }

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const editStep7Message = await ctx.reply(
    `**Step 7/8:** Update project description\n\nCurrent: ${
      existingProject.description || "None"
    }\n\nEnter new description or skip:`,
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().text(
        " Skip This Step",
        "edit_skip_description"
      ),
    }
  );
  previousStepMessageId = editStep7Message.message_id;

  // Step 7: Description
  let description = existingProject.description || "";
  const descriptionResponse = await conversation.waitFor([
    "message:text",
    "callback_query:data",
  ]);

  if (descriptionResponse.callbackQuery?.data === "edit_skip_description") {
    try {
      await descriptionResponse.answerCallbackQuery(
        "✅ Skipped description update"
      );
    } catch (error) {
      // Ignore callback query timeout errors
    }
    const currentDescription = description ? description : "None";
    await safeReply(
      ctx,
      `✅ Keeping current description: <b>${escapeHtml(
        currentDescription
      )}</b>`,
      { parse_mode: "HTML" }
    );
  } else if (descriptionResponse.message?.text) {
    const descriptionInput = descriptionResponse.message.text;

    // Check if user typed /start to return to menu
    if (descriptionInput.startsWith("/start")) {
      // Exit conversation and show main menu
      const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
      const keyboard = await createMenuKeyboard(user.id);

      let welcomeMessage = `💖 Congratulations — you've made it to Matchmaker!\n\n`;
      welcomeMessage += `Struggling to make connections out there? Don't worry — Matchmaker has got you covered.\n\n`;
      welcomeMessage += `Before we can pair you with your perfect block-mates, we need to get to know your project. You're just a few clicks away from meeting your perfect soul-projects.\n\n`;
      welcomeMessage += `Tap "Set Me Up" below to mint your profile. 💖`;

      await ctx.replyWithPhoto(new InputFile(iconPath), {
        caption: welcomeMessage,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      return;
    }

    if (descriptionInput.trim().length > 500) {
      await ctx.reply(
        "❌ Description must be 500 characters or less. Keeping current description."
      );
    } else {
      description = descriptionInput.trim();
      await safeReply(
        ctx,
        `✅ Updated description: <b>${escapeHtml(description)}</b>`,
        { parse_mode: "HTML" }
      );
    }
  }

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  await sendTyping(ctx);
  const editStep8Message = await ctx.reply(
    `**Step 8/8:** Update your Telegram community connections\n\nLet's update your Telegram spaces for better community engagement!`,
    { parse_mode: "Markdown" }
  );
  previousStepMessageId = editStep8Message.message_id;

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  // Step 8: Enhanced Telegram Setup for Edit
  let telegramGroup = existingProject.telegram_group;
  let telegramChannel = existingProject.telegram_channel;
  let telegramEditSetupDone = false;

  // Show the enhanced setup hub with current values
  await showTelegramSetupHub(ctx, telegramGroup, telegramChannel);

  while (!telegramEditSetupDone) {
    const telegramResponse = await conversation.waitFor("callback_query:data");
    try {
      await telegramResponse.answerCallbackQuery();
    } catch (error) {
      // Ignore callback query timeout errors
    }

    const telegramAction = telegramResponse.callbackQuery.data;

    if (telegramAction === "telegram_quick_setup") {
      const result = await handleQuickTelegramSetup(conversation, ctx);
      telegramGroup = result.groupUrl;
      telegramChannel = result.channelUrl;
      telegramEditSetupDone = true;
    } else if (telegramAction === "telegram_add_group") {
      const result = await handleEnhancedGroupSelection(conversation, ctx);
      if (result.success) {
        telegramGroup = result.groupUrl;
      }
      // Show updated hub
      await showTelegramSetupHub(ctx, telegramGroup, telegramChannel);
    } else if (
      telegramAction === "telegram_add_channel" ||
      telegramAction === "telegram_edit_channel"
    ) {
      const result = await handleEnhancedChannelSelection(conversation, ctx);
      if (result.success) {
        telegramChannel = result.channelUrl;
      }
      // Show updated hub
      await showTelegramSetupHub(ctx, telegramGroup, telegramChannel);
    } else if (telegramAction === "telegram_reset_setup") {
      telegramGroup = undefined;
      telegramChannel = undefined;
      await ctx.reply(
        "🔄 **Setup Reset**\n\nStarting fresh with your Telegram connections.",
        { parse_mode: "Markdown" }
      );
      await showTelegramSetupHub(ctx, telegramGroup, telegramChannel);
    } else if (telegramAction === "telegram_manual_entry") {
      const result = await handleEnhancedManualEntry(conversation, ctx);
      telegramGroup = result.groupUrl;
      telegramChannel = result.channelUrl;
      telegramEditSetupDone = true;
    } else if (telegramAction === "telegram_setup_complete") {
      if (telegramGroup || telegramChannel) {
        await ctx.reply(
          "✅ **Telegram connections updated!** Your community setup is ready.",
          { parse_mode: "Markdown" }
        );
      } else {
        await ctx.reply(
          "✅ **Telegram connections cleared.** You can add them back anytime.",
          { parse_mode: "Markdown" }
        );
      }
      telegramEditSetupDone = true;
    }
  }

  // Old telegram handling code has been replaced with enhanced flow above

  // Keep existing admin handles
  const adminHandles = existingProject.admin_handles;

  // Delete previous step message
  if (previousStepMessageId) {
    await safeDeleteMessage(ctx, previousStepMessageId);
  }

  // Update project
  await sendTyping(ctx);
  await ctx.reply(" Updating your project...");

  try {
    const updatedProjectData: Omit<
      Project,
      "id" | "created_at" | "updated_at"
    > = {
      name: projectName,
      logo_file_id: logoFileId,
      contract_address: contractAddress,
      chains: selectedChains,
      market_cap: "MATCH_ANYTHING", // Default market cap
      categories: selectedCategoriesEdit,
      description: description,
      telegram_group: telegramGroup,
      telegram_channel: telegramChannel,
      x_account: xAccount,
      admin_handles: adminHandles,
      is_active: true,
      verified: true,
    };

    const updatedProject = await dbService.updateProject(
      existingProject.id || "",
      updatedProjectData
    );

    if (!updatedProject) {
      throw new Error("Failed to update project");
    }

    // Create updated token card
    let card = `✅ **Token updated successfully!**\n\n`;
    card += `💖 Token Name : **${escapeMarkdown(updatedProject.name)}**\n`;

    card += `💖 **Contract:** \`${updatedProject.contract_address}\`\n`;
    card += `💖 **Chains:** ${updatedProject.chains.join(", ")}\n`;

    // Add categories if available
    if (updatedProject.categories && updatedProject.categories.length > 0) {
      card += `💖 **Categories:** ${updatedProject.categories.join(", ")}\n`;
    }

    // Add description if available
    if (updatedProject.description) {
      card += `💖 **Description:** ${escapeMarkdown(
        updatedProject.description
      )}\n`;
    }

    if (
      updatedProject.telegram_group ||
      updatedProject.telegram_channel ||
      updatedProject.x_account
    ) {
      card += `\n💖 **Community:**\n`;
      if (updatedProject.telegram_group) {
        card += `• [Telegram Group](${updatedProject.telegram_group})\n`;
      }
      if (updatedProject.telegram_channel) {
        card += `• [Announcement Channel](${updatedProject.telegram_channel})\n`;
      }
      if (updatedProject.x_account) {
        card += `• [X (Twitter)](https://x.com/${escapeMarkdown(
          updatedProject.x_account.replace("@", "")
        )})\n`;
      }
    }

    card += `💖 **Last Updated:** ${
      updatedProject.updated_at?.toLocaleDateString() || "Today"
    }\n`;
    card += `\n💖 **Admins:** ${updatedProject.admin_handles
      .map((handle) => `@${escapeMarkdown(handle)}`)
      .join(", ")}\n`;
    card += `\nYour updated token is ready for matching!`;

    // Create menu button
    const menuButton = new InlineKeyboard().text(" Menu", "return_to_menu");

    // Send with logo if available
    if (updatedProject.logo_file_id) {
      try {
        await ctx.replyWithPhoto(updatedProject.logo_file_id, {
          caption: card,
          parse_mode: "Markdown",
          reply_markup: menuButton,
        });
      } catch (error) {
        // Fallback to text if logo fails
        await ctx.reply(card, {
          parse_mode: "Markdown",
          reply_markup: menuButton,
        });
      }
    } else {
      await ctx.reply(card, {
        parse_mode: "Markdown",
        reply_markup: menuButton,
      });
    }
  } catch (error) {
    console.error("Error updating project:", error);
    await ctx.reply(
      "❌ An error occurred while updating your project. Please try again or contact support."
    );
  }
}

// Helper function to check bot permissions in a chat
async function checkBotPermissions(
  ctx: MyContext,
  chatId: string
): Promise<boolean> {
  try {
    const chatMember = await ctx.api.getChatMember(chatId, ctx.me.id);
    return (
      chatMember.status === "administrator" || chatMember.status === "creator"
    );
  } catch (error) {
    console.error("Error checking bot permissions:", error);
    return false;
  }
}

// Helper function to provide bot setup instructions
async function provideBotSetupInstructions(
  ctx: MyContext,
  isGroup: boolean = true
) {
  const chatType = isGroup ? "group" : "channel";
  const permissions = isGroup
    ? "• Send Messages\n • Pin Messages\n • Invite Users"
    : "• Post Messages\n • Edit Messages\n • Delete Messages";

  await sendTyping(ctx);
  await ctx.reply(
    ` **Bot Setup Instructions**\n\nTo receive match notifications in your ${chatType}, please:\n\n **Add the bot to your ${chatType}**\n **Make the bot an admin**\n **Grant these permissions:**\n ${permissions}\n\nWould you like me to generate an invite link for the bot?`,
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard()
        .text(
          " Get Bot Invite Link",
          `get_bot_invite_link_${isGroup ? "group" : "channel"}`
        )
        .row()
        .text(
          " Skip for Now",
          `skip_bot_setup_${isGroup ? "group" : "channel"}`
        ),
    }
  );
}

// Helper function to generate bot invite link
async function generateBotInviteLink(
  ctx: MyContext,
  isGroup: boolean = true
): Promise<string> {
  try {
    const botInfo = await ctx.api.getMe();
    const inviteType = isGroup ? "startgroup=true" : "startchannel=true";
    return `https://t.me/${botInfo.username}?${inviteType}`;
  } catch (error) {
    console.error("Error generating invite link:", error);
    throw error;
  }
}

async function handleBothTelegramSelection(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  existingProject: Project,
  telegramGroup: string | undefined,
  telegramChannel: string | undefined
) {
  // First, handle group selection
  await ctx.reply(
    ' **Step 1/2: Select your Telegram group**\n\nPlease select your main group or type "cancel" to skip:',
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [
            {
              text: " Select Group",
              request_chat: {
                request_id: 5,
                chat_is_channel: false,
                bot_is_member: false,
              },
            },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );

  try {
    const groupResponse = await conversation.waitFor([
      "message:chat_shared",
      "message:text",
    ]);

    if (groupResponse.message?.text?.toLowerCase() === "cancel") {
      await ctx.reply(" Group selection cancelled.");
    } else if (groupResponse.message?.chat_shared) {
      telegramGroup = `https://t.me/${groupResponse.message.chat_shared.chat_id}`;
      await ctx.reply(`✅ Group selected: ${telegramGroup}`);

      // Provide bot setup instructions for group
      await sendTyping(ctx);
      await ctx.reply(
        ` **Bot Setup Instructions for Group**\n\nTo receive match notifications in your group, please:\n\n **Add the bot to your group**\n **Make the bot an admin**\n **Grant these permissions:**\n • Send Messages\n • Pin Messages\n • Invite Users\n\nWould you like me to generate an invite link for the bot?`,
        {
          parse_mode: "Markdown",
          reply_markup: new InlineKeyboard()
            .text(" Get Bot Invite Link", "get_bot_invite_link_both_group")
            .row()
            .text(" Skip for Now", "skip_bot_setup_both_group"),
        }
      );

      const botSetupResponse = await conversation.waitFor(
        "callback_query:data"
      );
      try {
        await botSetupResponse.answerCallbackQuery();
      } catch (error) {
        // Ignore callback query timeout errors
      }

      if (
        botSetupResponse.callbackQuery.data === "get_bot_invite_link_both_group"
      ) {
        try {
          const botInfo = await ctx.api.getMe();
          const inviteLink = `https://t.me/${botInfo.username}?startgroup=true`;
          await ctx.reply(
            ` **Bot Invite Link for Group**\n\nUse this link to add the bot to your group:\n\n\`${inviteLink}\`\n\nAfter adding the bot:\n1. Make it an admin\n2. Grant message permissions\n3. The bot will automatically start monitoring for matches!`,
            {
              parse_mode: "Markdown",
            }
          );
        } catch (error) {
          console.error("Error generating invite link:", error);
          await ctx.reply(
            "❌ Could not generate invite link. Please add the bot manually using @" +
              (
                await ctx.api.getMe()
              ).username
          );
        }
      } else {
        await ctx.reply(
          " Bot setup skipped for group. You can add the bot later when needed."
        );
      }
    }
  } catch (error) {
    console.log("Group selection error in both selection:", error);
    await ctx.reply("❌ Group selection failed. You can add your group later.");
  }

  // Remove the keyboard
  await ctx.reply("Please continue with channel selection:", {
    reply_markup: { remove_keyboard: true },
  });

  // Then, handle channel selection
  await ctx.reply(
    ' **Step 2/2: Select your Telegram channel**\n\nPlease select your announcement channel or type "cancel" to skip:',
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [
            {
              text: " Select Channel",
              request_chat: {
                request_id: 6,
                chat_is_channel: true,
                bot_is_member: false,
              },
            },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );

  try {
    const channelResponse = await conversation.waitFor([
      "message:chat_shared",
      "message:text",
    ]);

    if (channelResponse.message?.text?.toLowerCase() === "cancel") {
      await ctx.reply(" Channel selection cancelled.");
    } else if (channelResponse.message?.chat_shared) {
      telegramChannel = `https://t.me/${channelResponse.message.chat_shared.chat_id}`;
      await ctx.reply(`✅ Channel selected: ${telegramChannel}`);

      // Provide bot setup instructions for channel
      await sendTyping(ctx);
      await ctx.reply(
        ` **Bot Setup Instructions for Channel**\n\nTo receive match notifications in your channel, please:\n\n **Add the bot to your channel**\n **Make the bot an admin**\n **Grant these permissions:**\n • Post Messages\n • Edit Messages\n • Delete Messages\n\nWould you like me to generate an invite link for the bot?`,
        {
          parse_mode: "Markdown",
          reply_markup: new InlineKeyboard()
            .text(" Get Bot Invite Link", "get_bot_invite_link_both_channel")
            .row()
            .text(" Skip for Now", "skip_bot_setup_both_channel"),
        }
      );

      const botSetupResponse = await conversation.waitFor(
        "callback_query:data"
      );
      try {
        await botSetupResponse.answerCallbackQuery();
      } catch (error) {
        // Ignore callback query timeout errors
      }

      if (
        botSetupResponse.callbackQuery.data ===
        "get_bot_invite_link_both_channel"
      ) {
        try {
          const botInfo = await ctx.api.getMe();
          const inviteLink = `https://t.me/${botInfo.username}?startchannel=true`;
          await ctx.reply(
            ` **Bot Invite Link for Channel**\n\nUse this link to add the bot to your channel:\n\n\`${inviteLink}\`\n\nAfter adding the bot:\n1. Make it an admin\n2. Grant message permissions\n3. The bot will automatically start posting match announcements!`,
            {
              parse_mode: "Markdown",
            }
          );
        } catch (error) {
          console.error("Error generating invite link:", error);
          await ctx.reply(
            "❌ Could not generate invite link. Please add the bot manually using @" +
              (
                await ctx.api.getMe()
              ).username
          );
        }
      } else {
        await ctx.reply(
          " Bot setup skipped for channel. You can add the bot later when needed."
        );
      }
    }
  } catch (error) {
    console.log("Channel selection error in both selection:", error);
    await ctx.reply(
      "❌ Channel selection failed. You can add your channel later."
    );
  }

  // Remove the keyboard
  await ctx.reply("✅ Both group and channel selection completed!", {
    reply_markup: { remove_keyboard: true },
  });
}
