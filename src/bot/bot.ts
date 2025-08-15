import { Bot, Context, session, SessionFlavor, InputFile, InlineKeyboard } from 'grammy';
import { conversations, ConversationFlavor, createConversation } from '@grammyjs/conversations';
import { Menu } from '@grammyjs/menu';
import dotenv from 'dotenv';
import path from 'path';
import { ConversationData } from '../types';
import { dbService } from '../services/database';

dotenv.config();

// Extend the context type
type MyContext = Context & SessionFlavor<ConversationData> & ConversationFlavor<Context>;

// Create the bot instance
export const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

// Set bot description
const description = `👋 𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐓𝐨 𝐌𝐚𝐭𝐜𝐡𝐦𝐚𝐤𝐞𝐫

It's time to boost your networking game.

Connect with token projects across all chains, grow your community, and spark real collaborations — all with a simple swipe.

𝐌𝐚𝐭𝐜𝐡𝐦𝐚𝐤𝐞𝐫 is your swipe-based connection bot, where you can match directly with 𝐂𝐄𝐎𝐬 and top admins for 𝐅𝐑𝐄𝐄 𝐀𝐌𝐀𝐬, 𝐗 𝐒𝐩𝐚𝐜𝐞𝐬, and collabs. Think Tinder, but for building serious Web3 relationships.

Hit 𝐒𝐭𝐚𝐫𝐭 below to get matched with projects you'll actually want to talk to.

𝐒𝐰𝐢𝐩𝐞. 𝐌𝐚𝐭𝐜𝐡. 𝐌𝐨𝐨𝐧 𝐓𝐨𝐠𝐞𝐭𝐡𝐞𝐫. 🚀`;

bot.api.setMyDescription(description);

// Install session middleware
bot.use(session({
initial: (): ConversationData => ({}),
}));

// Install conversations plugin
bot.use(conversations());

// Import and register conversations
import { onboardingConversation } from './conversations/onboarding';
import { browsingConversation } from './conversations/browsing';
import { editConversation } from './conversations/edit';
import { editTokenConversation } from './conversations/editToken';

bot.use(createConversation(onboardingConversation));
bot.use(createConversation(browsingConversation));
bot.use(createConversation(editConversation));
bot.use(createConversation(editTokenConversation));

// Error handling
bot.catch((err) => {
const ctx = err.ctx;
console.error(`Error while handling update ${ctx.update.update_id}:`);
const e = err.error;
if (e instanceof Error) {
console.error('Error:', e.message);
console.error('Stack:', e.stack);
} else {
console.error('Unknown error:', e);
}
});

// Middleware to check if user is registered
export async function requireRegistration(ctx: MyContext, next: () => Promise<void>) {
// This will be implemented after we create the database service integration
await next();
}

// Utility function to get user info
export function getUserInfo(ctx: MyContext) {
const user = ctx.from;
if (!user) return null;

return {
id: user.id,
username: user.username,
first_name: user.first_name,
last_name: user.last_name,
};
}

// Utility function to send typing action
export async function sendTyping(ctx: MyContext) {
try {
await ctx.replyWithChatAction('typing');
} catch (error) {
// Ignore errors for typing action
}
}

// Utility function to create consistent logo header
export function createLogoHeader(): string {
return ` **MATCHMAKER** \n**Swipe. Match. Moon Together.** \n\n`;
}

// Utility function to get icon file path
export function getIconPath(): string {
return path.join(__dirname, '../../assets', 'icon.jpg');
}

// Utility function to send only icon (no text header)
export async function sendIcon(ctx: MyContext) {
try {
// Send only icon image
const iconPath = getIconPath();
const iconFile = new InputFile(iconPath);
await ctx.replyWithPhoto(iconFile);
} catch (error) {
// If icon fails to send, silently continue (no fallback text)
console.warn('Failed to send icon:', error);
}
}

// Utility function to send icon with text message (no header)
export async function sendWithIcon(ctx: MyContext, message: string, parseMode: 'Markdown' | 'HTML' = 'Markdown') {
try {
// Send icon image first
const iconPath = getIconPath();
const iconFile = new InputFile(iconPath);
await ctx.replyWithPhoto(iconFile);

// Then send message without logo header
await ctx.reply(message, { parse_mode: parseMode });
} catch (error) {
// If icon fails to send, just send text message
console.warn('Failed to send icon, using text only:', error);
await ctx.reply(message, { parse_mode: parseMode });
}
}

// Utility function to send simple messages without icon (for status/feedback messages)
export async function sendSimpleMessage(ctx: MyContext, message: string, parseMode: 'Markdown' | 'HTML' = 'Markdown') {
await ctx.reply(message, { parse_mode: parseMode });
}

// Helper function to create menu keyboard based on user registration status
export async function createMenuKeyboard(userId: number): Promise<InlineKeyboard> {
const admins = await dbService.getAdminsByTelegramId(userId);
const isRegistered = admins.length > 0;

let keyboard = new InlineKeyboard();

if (isRegistered) {
// For registered users, show edit buttons instead of "Set me up"
keyboard = keyboard
.text('Token Name', 'edit_token_name')
.text('Logo', 'edit_logo')
.row()
.text('Chains', 'edit_chains')
.text('Contract Address', 'edit_contract')
.row()
.text('X', 'edit_x')
.text('Telegram', 'edit_telegram')
.row()
.text('Description', 'edit_description')
.text('Categories', 'edit_categories')
.row()
.text('💞 Start Matching 💞', 'start_browsing')
.row()
.text('💘 My Matches 💘', 'show_matches')
.row()
.text('Report', 'report_button')
.text('Support', 'support_button')
.row()
.text('Advertise', 'advertise_button')
.row()
.text('Matchmaker X', 'matchmaker_x_button')
.text('Matchmaker TG', 'matchmaker_tg_button')
.row()
.text('Cancel', 'cancel_registration_button');
} else {
// For unregistered users, show the setup button
keyboard = keyboard
.text('💞 Set me up 💞', 'start_onboarding')
.row()
.text('Advertise', 'advertise_button')
.row()
.text('Support', 'support_button')
.row()
}

return keyboard;
}

// Main menu
export const mainMenu = new Menu<MyContext>('main-menu')
.text('💕 Set me up 💕', (ctx) => ctx.conversation.enter('onboardingConversation'))
.row()
.text('👀 Browse Tokens', (ctx) => ctx.conversation.enter('browsingConversation'))
.row()
.text('💕 My Matches', async (ctx) => {
// Reuse the same logic as the show_matches callback
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
await sendWithIcon(ctx, ' No matches yet! Keep browsing and liking tokens to find matches.');
return;
}

// Send header message
await sendWithIcon(ctx, ` **Your Token Matches (${allMatches.length})**\n`);

for (const match of allMatches) {
const otherProjectId = match.project_a_id === match.userTokenId ? match.project_b_id : match.project_a_id;
const otherProject = await dbService.getProjectById(otherProjectId);

if (otherProject) {
// Get user's project details
const userProject = await dbService.getProjectById(match.userTokenId);

let matchInfo = ` **${match.userTokenName}** ↔️ **${otherProject.name}**\n`;
matchInfo += ` Matched: ${match.created_at?.toLocaleDateString() || 'Unknown'}\n`;
matchInfo += ` Contract: \`${otherProject.contract_address}\`\n`;

if (match.private_group_invite_link) {
matchInfo += ` [Private Room](${match.private_group_invite_link})\n`;
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

// Register the menu
bot.use(mainMenu);

// Handle return to menu callback
bot.callbackQuery('return_to_menu', async (ctx) => {
await ctx.answerCallbackQuery();

const user = ctx.from;
if (!user) return;

const iconPath = getIconPath();
const keyboard = await createMenuKeyboard(user.id);

await ctx.replyWithPhoto(new InputFile(iconPath), {
caption: 'Choose an option:',
reply_markup: keyboard
});
});

// Handle inline menu buttons
bot.callbackQuery('start_onboarding', async (ctx) => {
await ctx.answerCallbackQuery();
await ctx.conversation.enter('onboardingConversation');
});

bot.callbackQuery('start_browsing', async (ctx) => {
await ctx.answerCallbackQuery();
await ctx.conversation.enter('browsingConversation');
});

bot.callbackQuery('show_matches', async (ctx) => {
await ctx.answerCallbackQuery();
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
await sendWithIcon(ctx, ' No matches yet! Keep browsing and liking tokens to find matches.');
return;
}

// Send header message
await sendWithIcon(ctx, ` **Your Token Matches (${allMatches.length})**\n`);

for (const match of allMatches) {
const otherProjectId = match.project_a_id === match.userTokenId ? match.project_b_id : match.project_a_id;
const otherProject = await dbService.getProjectById(otherProjectId);

if (otherProject) {
// Get user's project details
const userProject = await dbService.getProjectById(match.userTokenId);

let matchInfo = ` **${match.userTokenName}** ↔️ **${otherProject.name}**\n`;
matchInfo += ` Matched: ${match.created_at?.toLocaleDateString() || 'Unknown'}\n`;
matchInfo += ` Contract: \`${otherProject.contract_address}\`\n`;

if (match.private_group_invite_link) {
matchInfo += ` [Private Room](${match.private_group_invite_link})\n`;
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

// Handle edit buttons for registered users
bot.callbackQuery('edit_token_name', async (ctx) => {
await ctx.answerCallbackQuery();
ctx.session.editField = 'token_name';
await ctx.conversation.enter('editTokenConversation');
});

bot.callbackQuery('edit_logo', async (ctx) => {
await ctx.answerCallbackQuery();
ctx.session.editField = 'logo';
await ctx.conversation.enter('editTokenConversation');
});

bot.callbackQuery('edit_chains', async (ctx) => {
await ctx.answerCallbackQuery();
ctx.session.editField = 'chains';
await ctx.conversation.enter('editTokenConversation');
});

bot.callbackQuery('edit_contract', async (ctx) => {
await ctx.answerCallbackQuery();
ctx.session.editField = 'contract_address';
await ctx.conversation.enter('editTokenConversation');
});

bot.callbackQuery('edit_x', async (ctx) => {
await ctx.answerCallbackQuery();
ctx.session.editField = 'x_account';
await ctx.conversation.enter('editTokenConversation');
});

bot.callbackQuery('edit_telegram', async (ctx) => {
await ctx.answerCallbackQuery();
ctx.session.editField = 'telegram';
await ctx.conversation.enter('editTokenConversation');
});

bot.callbackQuery('edit_description', async (ctx) => {
await ctx.answerCallbackQuery();
ctx.session.editField = 'description';
await ctx.conversation.enter('editTokenConversation');
});

bot.callbackQuery('edit_categories', async (ctx) => {
await ctx.answerCallbackQuery();
ctx.session.editField = 'categories';
await ctx.conversation.enter('editTokenConversation');
});

// Handle Report button
bot.callbackQuery('report_button', async (ctx) => {
await ctx.answerCallbackQuery();
await sendWithIcon(ctx, '📋 **Report Issues**\n\nTo report any issues or problems, please contact us at:\n\n@MatchmakerLounge/255\n\nOur team will assist you promptly!');
});

// Handle Support button  
bot.callbackQuery('support_button', async (ctx) => {
await ctx.answerCallbackQuery();
await sendWithIcon(ctx, '🆘 **Get Support**\n\nFor support and assistance, please reach out to:\n\n@MatchmakerLounge/255\n\nWe\'re here to help!');
});

// Handle Advertise button
bot.callbackQuery('advertise_button', async (ctx) => {
await ctx.answerCallbackQuery();
await sendWithIcon(ctx, '📢 **Advertise with Matchmaker**\n\nInterested in advertising opportunities? Contact us for more information:\n\n@MatchmakerLounge/255\n\nLet\'s grow together!');
});

// Handle Matchmaker X button
bot.callbackQuery('matchmaker_x_button', async (ctx) => {
await ctx.answerCallbackQuery();
await sendWithIcon(ctx, '🐦 **Follow us on X (Twitter)**\n\nStay updated with the latest news and updates:\n\n🔗 https://x.com/MatchmakerB0T\n\nFollow us for announcements and community updates!');
});

// Handle Matchmaker TG button
bot.callbackQuery('matchmaker_tg_button', async (ctx) => {
await ctx.answerCallbackQuery();
await sendWithIcon(ctx, '💬 **Join our Telegram Community**\n\nConnect with other projects and stay in the loop:\n\n🔗 @MatchmakerLounge\n\nJoin our vibrant community!');
});

// Handle Cancel Registration button
bot.callbackQuery('cancel_registration_button', async (ctx) => {
await ctx.answerCallbackQuery();

const user = ctx.from;
if (!user) return;

// Show confirmation with inline buttons
const confirmKeyboard = new InlineKeyboard()
  .text('✅ Yes, Delete Everything', 'confirm_cancel_registration')
  .row()
  .text('❌ No, Keep My Registration', 'abort_cancel_registration');

const iconPath = path.join(__dirname, '../../assets/icon.jpg');
await ctx.replyWithPhoto(new InputFile(iconPath), {
  caption: '⚠️ **Cancel Registration**\n\nAre you sure you want to cancel your registration? This will:\n\n• Delete your token information\n• Remove all your matches\n• Delete all project data\n\n**This action cannot be undone!**',
  parse_mode: 'Markdown',
  reply_markup: confirmKeyboard
});
});

// Handle confirmation of cancel registration
bot.callbackQuery('confirm_cancel_registration', async (ctx) => {
await ctx.answerCallbackQuery();
await sendTyping(ctx);

const user = ctx.from;
if (!user) return;

// Check if user has any registrations
const admins = await dbService.getAdminsByTelegramId(user.id);

if (admins.length === 0) {
  await sendWithIcon(ctx, '❌ No registration found to cancel.');
  return;
}

// Delete all user projects and related data
const deletionSuccess = await dbService.deleteAllUserProjects(user.id);

if (deletionSuccess) {
  await sendWithIcon(ctx, '✅ **Registration Cancelled Successfully**\n\nAll your data has been completely removed:\n\n• Token information deleted\n• All matches removed\n• All likes deleted\n• Match groups cleared\n\nYou can register again anytime using the "Set me up" button below.');
} else {
  await sendWithIcon(ctx, '❌ **Error Cancelling Registration**\n\nThere was an issue removing some of your data. Please contact support for assistance.\n\n@MatchmakerLounge/255');
}

// Show unregistered user menu
const iconPath = path.join(__dirname, '../../assets/icon.jpg');
const keyboard = await createMenuKeyboard(user.id);

await ctx.replyWithPhoto(new InputFile(iconPath), {
  caption: 'Choose an option:',
  reply_markup: keyboard,
});
});

// Handle abort cancel registration
bot.callbackQuery('abort_cancel_registration', async (ctx) => {
await ctx.answerCallbackQuery();
await sendWithIcon(ctx, '✅ **Cancellation Aborted**\n\nYour registration remains active. No changes were made.');

// Show registered user menu
const user = ctx.from;
if (!user) return;

const iconPath = path.join(__dirname, '../../assets/icon.jpg');
const keyboard = await createMenuKeyboard(user.id);

await ctx.replyWithPhoto(new InputFile(iconPath), {
  caption: 'Choose an option:',
  reply_markup: keyboard,
});
});

export { MyContext };
