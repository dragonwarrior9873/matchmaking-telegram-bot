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
import { Chain, Category, Project } from "../../types";
import { 
  showTelegramSetupHub, 
  handleQuickTelegramSetup, 
  handleEnhancedGroupSelection, 
  handleEnhancedChannelSelection, 
  handleEnhancedManualEntry 
} from "./onboarding";
import path from "path";

// Helper function to safely delete a message
async function safeDeleteMessage(ctx: MyContext, messageId: number) {
  try {
    await ctx.api.deleteMessage(ctx.chat!.id, messageId);
  } catch (error: any) {
    // Silently ignore common expected errors
    if (error?.description?.includes('message to delete not found') || 
        error?.description?.includes('message can\'t be deleted') ||
        error?.error_code === 400) {
      // These are expected errors - message already deleted, too old, etc.
      return;
    }
    // Log unexpected errors
    console.warn("Unexpected error deleting message:", error);
  }
}

// Helper function to create chain keyboard
function createChainKeyboard(selected: string[] = []): InlineKeyboard {
  const chains = Object.values(Chain);
  let keyboard = new InlineKeyboard();

  for (let i = 0; i < chains.length; i += 2) {
    const chain1 = chains[i];
    const chain2 = chains[i + 1];

    const isSelected1 = selected.includes(chain1);
    const isSelected2 = chain2 ? selected.includes(chain2) : false;

    if (chain2) {
      keyboard = keyboard
        .text(
          `${isSelected1 ? "✅" : "⚪"} ${chain1}`,
          `chain_${chain1}`
        )
        .text(
          `${isSelected2 ? "✅" : "⚪"} ${chain2}`,
          `chain_${chain2}`
        )
        .row();
    } else {
      keyboard = keyboard
        .text(
          `${isSelected1 ? "✅" : "⚪"} ${chain1}`,
          `chain_${chain1}`
        )
        .row();
    }
  }

  keyboard = keyboard.text("✅ Done", "chains_done");
  return keyboard;
}

// Helper function to create category keyboard
function createCategoryKeyboard(selected: string[] = []): InlineKeyboard {
  const categories = Object.values(Category);
  let keyboard = new InlineKeyboard();

  for (let i = 0; i < categories.length; i += 2) {
    const category1 = categories[i];
    const category2 = categories[i + 1];

    const isSelected1 = selected.includes(category1);
    const isSelected2 = category2 ? selected.includes(category2) : false;

    if (category2) {
      keyboard = keyboard
        .text(
          `${isSelected1 ? "✅" : "⚪"} ${category1}`,
          `category_${category1}`
        )
        .text(
          `${isSelected2 ? "✅" : "⚪"} ${category2}`,
          `category_${category2}`
        )
        .row();
    } else {
      keyboard = keyboard
        .text(
          `${isSelected1 ? "✅" : "⚪"} ${category1}`,
          `category_${category1}`
        )
        .row();
    }
  }

  keyboard = keyboard.text("✅ Done", "categories_done");
  return keyboard;
}

export async function editTokenConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext
) {
  const user = ctx.from;
  if (!user) return;

  // Check if user has registered tokens
  const admins = await dbService.getAdminsByTelegramId(user.id);
  if (admins.length === 0) {
    await sendWithIcon(ctx, '❌ You need to register a token first. Use /start to get started.');
    return;
  }

  // Get the field to edit from the session data
  const fieldToEdit = ctx.session.editField;
  if (!fieldToEdit) {
    await sendWithIcon(ctx, '❌ Invalid edit request. Please try again.');
    return;
  }

  let selectedProject: Project;

  if (admins.length === 1) {
    // User has only one token, use it directly
    const project = await dbService.getProjectById(admins[0].project_id);
    if (!project) {
      await sendWithIcon(ctx, '❌ Project not found. Please try again.');
      return;
    }
    selectedProject = project;
  } else {
    // User has multiple tokens, let them choose which one to edit
    await sendTyping(ctx);
    let projectMessage = "**Which token would you like to edit?**\n\nSelect the token you want to modify:\n\n";

    const keyboard = new InlineKeyboard();
    
    for (const admin of admins) {
      const project = await dbService.getProjectById(admin.project_id);
      if (project) {
        projectMessage += `🪙 **${project.name}**\n`;
        keyboard.text(`📝 ${project.name}`, `edit_select_token_${project.id}`).row();
      }
    }

    await ctx.reply(projectMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    const tokenResponse = await conversation.waitFor("callback_query:data");
    try {
      await tokenResponse.answerCallbackQuery();
    } catch (error) {
      // Ignore callback query timeout errors
    }

    const selectedTokenId = tokenResponse.callbackQuery.data.replace("edit_select_token_", "");
    const project = await dbService.getProjectById(selectedTokenId);
    
    if (!project) {
      await sendWithIcon(ctx, '❌ Project not found. Please try again.');
      return;
    }
    
    selectedProject = project;
  }

  // Now edit the specific field
  await editField(conversation, ctx, selectedProject, fieldToEdit);
}

async function editField(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  project: Project,
  field: string
) {
  switch (field) {
    case 'token_name':
      await editTokenName(conversation, ctx, project);
      break;
    case 'logo':
      await editLogo(conversation, ctx, project);
      break;
    case 'chains':
      await editChains(conversation, ctx, project);
      break;
    case 'contract_address':
      await editContractAddress(conversation, ctx, project);
      break;
    case 'x_account':
      await editXAccount(conversation, ctx, project);
      break;
    case 'telegram':
      await editTelegram(conversation, ctx, project);
      break;
    case 'description':
      await editDescription(conversation, ctx, project);
      break;
    case 'categories':
      await editCategories(conversation, ctx, project);
      break;
    default:
      await sendWithIcon(ctx, '❌ Invalid field to edit. Please try again.');
      return;
  }

  // Show success message and return to menu
  await sendWithIcon(ctx, '✅ **Update Complete!**\n\nYour token information has been successfully updated.');
  
  const iconPath = path.join(__dirname, "../../../assets/icon.jpg");
  const keyboard = await createMenuKeyboard(ctx.from!.id);
  
  await ctx.replyWithPhoto(new InputFile(iconPath), {
    caption: 'What would you like to do next?',
    reply_markup: keyboard,
  });
}

async function editTokenName(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  project: Project
) {
  await sendTyping(ctx);
  await ctx.reply(
    `**Current Token Name:** ${project.name}\n\n` +
    `**Enter the new token name:**\n` +
    `(2-100 characters)`,
    { parse_mode: 'Markdown' }
  );

  const response = await conversation.waitFor("message:text");
  const newName = response.message.text.trim();

  if (newName.length < 2 || newName.length > 100) {
    await ctx.reply("❌ Token name must be between 2 and 100 characters. Please try again.");
    return await editTokenName(conversation, ctx, project);
  }

  // Update in database
  await dbService.updateProject(project.id!, { name: newName });
  
  await sendWithIcon(ctx, `✅ Token name updated to: **${newName}**`);
}

async function editLogo(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  project: Project
) {
  await sendTyping(ctx);
  let message = `**Current Logo:** ${project.logo_file_id ? '✅ Set' : '❌ Not set'}\n\n`;
  message += `**Send a new logo image or GIF:**\n`;
  message += `• Upload a photo or GIF\n`;
  message += `• Type "remove" to remove current logo\n`;
  message += `• Type "skip" to keep current logo`;

  if (project.logo_file_id) {
    try {
      await ctx.replyWithPhoto(project.logo_file_id, {
        caption: message,
        parse_mode: 'Markdown',
      });
    } catch (error) {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } else {
    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  const response = await conversation.waitFor(["message:photo", "message:animation", "message:text"]);
  
  let newLogoFileId: string | undefined = project.logo_file_id;

  if (response.message.photo) {
    const photo = response.message.photo[response.message.photo.length - 1];
    newLogoFileId = photo.file_id;
    await ctx.reply("✅ New logo uploaded!");
  } else if (response.message.animation) {
    newLogoFileId = response.message.animation.file_id;
    await ctx.reply("✅ New logo GIF uploaded!");
  } else if (response.message.text?.toLowerCase() === "remove") {
    newLogoFileId = undefined;
    await ctx.reply("✅ Logo removed!");
  } else if (response.message.text?.toLowerCase() === "skip") {
    await ctx.reply("⏭️ Logo unchanged.");
  } else {
    await ctx.reply('❌ Please send a photo/GIF, type "remove", or type "skip".');
    return await editLogo(conversation, ctx, project);
  }

  // Update in database
  await dbService.updateProject(project.id!, { logo_file_id: newLogoFileId });
}

async function editChains(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  project: Project
) {
  await sendTyping(ctx);
  
  const currentChains = project.chains || [];
  let selectedChains = [...currentChains];

  await ctx.reply(
    `**Current Chains:** ${currentChains.length > 0 ? currentChains.join(', ') : 'None'}\n\n` +
    `**Select the blockchain networks your token is on:**`,
    {
      parse_mode: 'Markdown',
      reply_markup: createChainKeyboard(selectedChains),
    }
  );

  let chainSelectionDone = false;

  while (!chainSelectionDone) {
    const chainResponse = await conversation.waitFor("callback_query:data");
    const chainData = chainResponse.callbackQuery.data;

    if (chainData === "chains_done") {
      if (selectedChains.length === 0) {
        try {
          await chainResponse.answerCallbackQuery("❌ Please select at least one chain!");
        } catch (error) {
          // Ignore callback query timeout errors
        }
        continue;
      }

      try {
        await chainResponse.answerCallbackQuery("✅ Chains updated!");
      } catch (error) {
        // Ignore callback query timeout errors
      }

      chainSelectionDone = true;
    } else if (chainData.startsWith("chain_")) {
      const selectedChain = chainData.replace("chain_", "") as Chain;

      if (selectedChains.includes(selectedChain)) {
        selectedChains = selectedChains.filter((c) => c !== selectedChain);
      } else {
        selectedChains.push(selectedChain);
      }

      // Update keyboard with current selections
      try {
        await chainResponse.editMessageReplyMarkup({
          reply_markup: createChainKeyboard(selectedChains),
        });
        await chainResponse.answerCallbackQuery();
      } catch (error) {
        console.error("Error updating keyboard:", error);
      }
    }
  }

  // Update in database
  await dbService.updateProject(project.id!, { chains: selectedChains });
  
  await sendWithIcon(ctx, `✅ Chains updated: **${selectedChains.join(', ')}**`);
}

async function editContractAddress(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  project: Project
) {
  await sendTyping(ctx);
  await ctx.reply(
    `**Current Contract Address:** ${project.contract_address}\n\n` +
    `**Enter the new contract address:**\n` +
    `(Minimum 10 characters)`,
    { parse_mode: 'Markdown' }
  );

  const response = await conversation.waitFor("message:text");
  const newAddress = response.message.text.trim();

  if (newAddress.length < 10) {
    await ctx.reply("❌ Please provide a valid contract address (minimum 10 characters).");
    return await editContractAddress(conversation, ctx, project);
  }

  // Update in database
  await dbService.updateProject(project.id!, { contract_address: newAddress });
  
  await sendWithIcon(ctx, `✅ Contract address updated to: **${newAddress}**`);
}

async function editXAccount(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  project: Project
) {
  await sendTyping(ctx);
  const currentX = project.x_account ? `@${project.x_account}` : 'Not set';
  
  await ctx.reply(
    `**Current X Account:** ${currentX}\n\n` +
    `**Enter your X (Twitter) handle:**\n` +
    `• Without @ symbol (e.g., "mytoken")\n` +
    `• Type "remove" to remove current account\n` +
    `• Type "skip" to keep current account`,
    { parse_mode: 'Markdown' }
  );

  const response = await conversation.waitFor("message:text");
  const input = response.message.text.trim();

  let newXAccount: string | undefined = project.x_account;

  if (input.toLowerCase() === "remove") {
    newXAccount = undefined;
    await ctx.reply("✅ X account removed!");
  } else if (input.toLowerCase() === "skip") {
    await ctx.reply("⏭️ X account unchanged.");
  } else {
    // Clean the input (remove @ if present)
    const cleanHandle = input.replace(/^@/, '');
    
    if (cleanHandle.length < 1 || cleanHandle.length > 50) {
      await ctx.reply("❌ X handle must be between 1 and 50 characters. Please try again.");
      return await editXAccount(conversation, ctx, project);
    }

    newXAccount = cleanHandle;
    await ctx.reply(`✅ X account updated to: **@${cleanHandle}**`);
  }

  // Update in database
  await dbService.updateProject(project.id!, { x_account: newXAccount });
}

async function editTelegram(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  project: Project
) {
  await sendWithIcon(ctx, '🔧 **Telegram Group Update**\n\nThis will launch the Telegram setup wizard to update your group connection.');
  
  let telegramGroup = project.telegram_group;
  let telegramChannel = project.telegram_channel;
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

    if (telegramAction === "telegram_quick_setup") {
      const result = await handleQuickTelegramSetup(conversation, ctx);
      telegramGroup = result.groupUrl;
      telegramChannel = result.channelUrl;
      telegramSetupDone = true;
    } else if (telegramAction === "telegram_add_group") {
      const result = await handleEnhancedGroupSelection(conversation, ctx);
      if (result.success) {
        telegramGroup = result.groupUrl;
      }
      await showTelegramSetupHub(ctx, telegramGroup, telegramChannel);
    } else if (telegramAction === "telegram_add_channel") {
      const result = await handleEnhancedChannelSelection(conversation, ctx);
      if (result.success) {
        telegramChannel = result.channelUrl;
      }
      await showTelegramSetupHub(ctx, telegramGroup, telegramChannel);
    } else if (telegramAction === "telegram_edit_channel") {
      const result = await handleEnhancedChannelSelection(conversation, ctx);
      if (result.success) {
        telegramChannel = result.channelUrl;
      }
      await showTelegramSetupHub(ctx, telegramGroup, telegramChannel);
    } else if (telegramAction === "telegram_reset_setup") {
      telegramGroup = undefined;
      telegramChannel = undefined;
      await ctx.reply("🔄 **Setup Reset**\n\nStarting fresh with your Telegram connections.", { parse_mode: "Markdown" });
      await showTelegramSetupHub(ctx, telegramGroup, telegramChannel);
    } else if (telegramAction === "telegram_manual_entry") {
      const result = await handleEnhancedManualEntry(conversation, ctx);
      telegramGroup = result.groupUrl;
      telegramChannel = result.channelUrl;
      telegramSetupDone = true;
    } else if (telegramAction === "telegram_setup_complete") {
      telegramSetupDone = true;
    }
  }

  // Update in database
  await dbService.updateProject(project.id!, { 
    telegram_group: telegramGroup,
    telegram_channel: telegramChannel 
  });

  if (telegramGroup) {
    await sendWithIcon(ctx, '✅ **Telegram group updated successfully!**');
  } else {
    await sendWithIcon(ctx, '⏭️ **Telegram setup unchanged.**');
  }
}

async function editDescription(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  project: Project
) {
  await sendTyping(ctx);
  const currentDesc = project.description || 'Not set';
  
  await ctx.reply(
    `**Current Description:** ${currentDesc}\n\n` +
    `**Enter a new description for your token:**\n` +
    `• Maximum 500 characters\n` +
    `• Type "remove" to remove current description\n` +
    `• Type "skip" to keep current description`,
    { parse_mode: 'Markdown' }
  );

  const response = await conversation.waitFor("message:text");
  const input = response.message.text.trim();

  let newDescription: string | undefined = project.description;

  if (input.toLowerCase() === "remove") {
    newDescription = undefined;
    await ctx.reply("✅ Description removed!");
  } else if (input.toLowerCase() === "skip") {
    await ctx.reply("⏭️ Description unchanged.");
  } else {
    if (input.length > 500) {
      await ctx.reply("❌ Description must be 500 characters or less. Please try again.");
      return await editDescription(conversation, ctx, project);
    }

    newDescription = input;
    await ctx.reply("✅ Description updated successfully!");
  }

  // Update in database
  await dbService.updateProject(project.id!, { description: newDescription });
}

async function editCategories(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  project: Project
) {
  await sendTyping(ctx);
  
  const currentCategories = project.categories || [];
  let selectedCategories = [...currentCategories];

  await ctx.reply(
    `**Current Categories:** ${currentCategories.length > 0 ? currentCategories.join(', ') : 'None'}\n\n` +
    `**Select your project categories (up to 3):**`,
    {
      parse_mode: 'Markdown',
      reply_markup: createCategoryKeyboard(selectedCategories),
    }
  );

  let categorySelectionDone = false;

  while (!categorySelectionDone) {
    const categoryResponse = await conversation.waitFor("callback_query:data");
    const data = categoryResponse.callbackQuery.data;

    if (data === "categories_done") {
      try {
        await categoryResponse.answerCallbackQuery("✅ Categories updated!");
      } catch (error) {
        // Ignore callback query timeout errors
      }
      categorySelectionDone = true;
    } else if (data.startsWith("category_")) {
      const selectedCategory = data.replace("category_", "") as Category;
      let feedbackMessage = "";

      if (selectedCategories.includes(selectedCategory)) {
        selectedCategories = selectedCategories.filter((c) => c !== selectedCategory);
        feedbackMessage = `✅ ${selectedCategory} removed`;
      } else {
        if (selectedCategories.length >= 3) {
          feedbackMessage = "❌ You can select up to 3 categories only.";
        } else {
          selectedCategories.push(selectedCategory);
          feedbackMessage = `✅ ${selectedCategory} selected`;
        }
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

      try {
        await categoryResponse.answerCallbackQuery(feedbackMessage);
      } catch (error) {
        // Ignore callback query timeout errors
      }
    }
  }

  // Update in database
  await dbService.updateProject(project.id!, { categories: selectedCategories });
  
  const categoryText = selectedCategories.length > 0 ? selectedCategories.join(', ') : 'None';
  await sendWithIcon(ctx, `✅ Categories updated: **${categoryText}**`);
}
