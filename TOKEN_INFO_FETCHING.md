# Token Information Fetching Feature

## Overview

The bot now automatically fetches real-time token information from CoinGecko and DexScreener APIs when users register their tokens. This enhances the browsing experience by displaying live market data and social links.

## Features

### 🔍 Automatic Token Data Fetching
- **When**: During token registration (after contract address and chain selection)
- **Sources**: CoinGecko API (primary) and DexScreener API (fallback)
- **Data Retrieved**:
  - Token price and 24h price change
  - Market cap
  - 24h trading volume
  - Telegram group links
  - Twitter handles
  - Official website
  - Token description
  - Logo URL

### 📊 Enhanced Browsing Experience
When users browse tokens, they now see:
- **Live Market Data**: Real-time price, market cap, and volume
- **Price Changes**: 24h price change with visual indicators (📈📉)
- **Social Links**: All available community links in one place
- **Formatted Data**: Human-readable numbers (e.g., $1.2B, $500M)

### 🔗 Smart Link Aggregation
The bot intelligently combines:
- User-provided Telegram groups/channels
- API-discovered official Telegram groups
- Twitter handles
- Official websites

## Technical Implementation

### New Files Created
- `src/services/tokenInfo.ts` - Token information fetching service

### Database Schema Updates
Added new fields to the Project model:
```typescript
// Token info from APIs
token_symbol?: string;
token_price?: number;
token_price_change_24h?: number;
token_volume_24h?: number;
token_market_cap_api?: number;
token_telegram_group_api?: string;
token_twitter_handle?: string;
token_website?: string;
token_description?: string;
token_logo_url?: string;
token_info_last_updated?: Date;
```

### API Integration

#### CoinGecko API
- **Endpoint**: `https://api.coingecko.com/api/v3/coins/{platform}/contract/{address}`
- **Features**: Comprehensive token data including social links
- **Rate Limits**: Respects API limits with proper error handling

#### DexScreener API
- **Endpoint**: `https://api.dexscreener.com/latest/dex/tokens/{address}`
- **Features**: DEX-specific data, good for newer tokens
- **Fallback**: Used when CoinGecko doesn't have data

### Chain Mapping
The service maps our internal chain names to API-specific identifiers:

#### CoinGecko Platforms
- Ethereum → `ethereum`
- BSC → `binance-smart-chain`
- Polygon → `polygon-pos`
- Arbitrum → `arbitrum-one`
- Optimism → `optimistic-ethereum`
- And many more...

#### DexScreener Chains
- Ethereum → `ethereum`
- BSC → `bsc`
- Polygon → `polygon`
- Arbitrum → `arbitrum`
- And many more...

## User Experience

### During Registration
1. User enters contract address and selects chains
2. Bot shows "Fetching token information..." message
3. If successful, displays fetched data:
   ```
   ✅ Token information fetched successfully!
   
   📊 Market Data:
   • Price: $0.00012345 (+5.67%) 📈
   • Market Cap: $1.2B
   • 24h Volume: $500M
   • 24h Change: +5.67%
   
   🔗 Links Found:
   • Telegram Group: https://t.me/token_group
   • Twitter: https://twitter.com/token_handle
   • Website: https://token.com
   ```
4. If not found, shows informative message about new/private tokens

### During Browsing
Enhanced token cards now include:
```
🚀 Token Name
📊 Token 1 of 10

🔗 Contract: 0x1234...5678
⛓️ Chains: Ethereum, BSC
💰 Market Cap: 1-10M

📊 Live Market Data:
• Price: $0.00012345 (+5.67%) 📈
• Market Cap: $1.2B
• 24h Volume: $500M

📱 Community:
• Telegram Group
• Official Telegram
• Twitter
• Website

📅 Registered: 12/25/2024
Admins: @admin1, @admin2
```

## Error Handling

### Graceful Degradation
- If API calls fail, registration continues normally
- If no data found, user gets informative message
- Fallback between CoinGecko and DexScreener

### Rate Limiting
- Proper timeout handling (10 seconds)
- User-Agent headers for API compliance
- Error logging for debugging

## Benefits

### For Token Owners
- **Automatic Discovery**: Social links automatically found and displayed
- **Market Validation**: Real-time data confirms token legitimacy
- **Better Matching**: More information helps with better matches

### For Token Browsers
- **Informed Decisions**: Live market data for better evaluation
- **Complete Information**: All community links in one place
- **Professional Presentation**: Clean, formatted data display

### For the Platform
- **Enhanced Credibility**: Real-time data builds trust
- **Better User Engagement**: More information keeps users engaged
- **Reduced Manual Work**: Automatic data fetching reduces admin overhead

## Future Enhancements

### Potential Improvements
1. **Periodic Updates**: Refresh token data periodically
2. **More APIs**: Add CoinMarketCap, 1inch, etc.
3. **Price Alerts**: Notify users of significant price changes
4. **Chart Integration**: Add price charts to token cards
5. **Token Verification**: Use API data for automatic verification

### Technical Optimizations
1. **Caching**: Cache API responses to reduce rate limit issues
2. **Batch Processing**: Fetch multiple tokens simultaneously
3. **Webhook Integration**: Real-time updates from APIs
4. **Data Validation**: Validate fetched data before storing

## Configuration

### Environment Variables
No additional environment variables required - uses public APIs.

### Dependencies
- `axios` - HTTP client for API calls

## Monitoring

### Logging
The service logs:
- API call attempts and results
- Successful data fetches
- Error conditions and fallbacks
- Rate limit issues

### Metrics to Track
- Success rate of API calls
- Most commonly used chains
- Data freshness (last update times)
- User engagement with enhanced cards

## Security Considerations

### API Usage
- Respects rate limits
- Uses appropriate User-Agent headers
- Handles errors gracefully
- No sensitive data in API calls

### Data Storage
- Only stores public information
- No API keys required
- Data is publicly available anyway

## Conclusion

This feature significantly enhances the user experience by providing real-time, comprehensive token information automatically. It reduces manual work for token owners while giving browsers the information they need to make informed decisions about potential matches.
