# Assets Folder

This folder contains static assets used by the Matchmaker bot.

## Required Files

### `icon.jpg`
- **Purpose**: The main Matchmaker logo/icon displayed on all bot interfaces
- **Format**: JPEG image file
- **Recommended size**: 512x512 pixels or larger (square aspect ratio preferred)
- **Usage**: Sent as a photo with every bot interaction to maintain consistent branding

## How to Add Your Icon

1. **Replace the placeholder**: Delete the current `icon.jpg` file and add your actual logo image
2. **Naming**: The file must be named exactly `icon.jpg` (case-sensitive)
3. **Format**: Must be a JPEG image file (.jpg extension)
4. **Size**: Recommended minimum 512x512 pixels for best quality on all devices

## Example Usage

The icon is automatically included in:
- Welcome messages (`/start` command)
- Status displays (`/status` command) 
- Token browsing interface
- Match displays (`/matches` command)
- Help messages (`/help` command)
- All menu interactions
- Onboarding process

## Technical Notes

- The bot uses Telegram's `replyWithPhoto` API to send the icon
- If the icon fails to load, the bot gracefully falls back to text-only mode
- The icon is sent as a separate message before the main content
- Path resolution: `process.cwd()/assets/icon.jpg`

## Troubleshooting

If the icon doesn't display:
1. Check that the file is named exactly `icon.jpg`
2. Ensure the file is a valid JPEG image
3. Verify the file permissions are readable
4. Check the bot logs for any error messages
5. Test with a smaller file size if upload fails

The bot will continue to function normally even if the icon is missing or fails to load.
