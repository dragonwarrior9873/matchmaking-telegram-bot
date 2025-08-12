import axios from 'axios';

export interface TokenInfo {
  name: string;
  symbol: string;
  marketCap: number | null;
  volume24h: number | null;
  price: number | null;
  priceChange24h: number | null;
  telegramGroup: string | null;
  twitterHandle: string | null;
  website: string | null;
  description: string | null;
  logoUrl: string | null;
}

export class TokenInfoService {
  private static instance: TokenInfoService;

  private constructor() {}

  public static getInstance(): TokenInfoService {
    if (!TokenInfoService.instance) {
      TokenInfoService.instance = new TokenInfoService();
    }
    return TokenInfoService.instance;
  }

  async fetchTokenInfo(contractAddress: string, chain: string): Promise<TokenInfo | null> {
    try {
      let tokenInfo = await this.fetchFromCoinGecko(contractAddress, chain);
      
      if (!tokenInfo) {
        tokenInfo = await this.fetchFromDexScreener(contractAddress, chain);
      }
      
      return tokenInfo;
    } catch (error) {
      console.error(`Error fetching token info for ${contractAddress}:`, error);
      return null;
    }
  }

  private async fetchFromCoinGecko(contractAddress: string, chain: string): Promise<TokenInfo | null> {
    try {
      const platformId = this.mapChainToCoinGeckoPlatform(chain);
      if (!platformId) return null;

      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${platformId}/contract/${contractAddress}`,
        { timeout: 10000 }
      );

      if (response.data && response.data.id) {
        const data = response.data;
        const marketData = data.market_data;
        
        return {
          name: data.name || '',
          symbol: data.symbol?.toUpperCase() || '',
          marketCap: marketData?.market_cap?.usd || null,
          volume24h: marketData?.total_volume?.usd || null,
          price: marketData?.current_price?.usd || null,
          priceChange24h: marketData?.price_change_percentage_24h || null,
          telegramGroup: this.extractTelegramFromLinks(data.links),
          twitterHandle: this.extractTwitterFromLinks(data.links),
          website: data.links?.homepage?.[0] || null,
          description: data.description?.en || null,
          logoUrl: data.image?.large || null
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private async fetchFromDexScreener(contractAddress: string, chain: string): Promise<TokenInfo | null> {
    try {
      const response = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`,
        { timeout: 10000 }
      );

      if (response.data && response.data.pairs && response.data.pairs.length > 0) {
        const pair = response.data.pairs[0];
        const token = pair.baseToken;
        
        return {
          name: token.name || '',
          symbol: token.symbol || '',
          marketCap: pair.marketCap ? parseFloat(pair.marketCap) : null,
          volume24h: pair.volume?.h24 ? parseFloat(pair.volume.h24) : null,
          price: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
          priceChange24h: pair.priceChange?.h24 ? parseFloat(pair.priceChange.h24) : null,
          telegramGroup: null,
          twitterHandle: null,
          website: null,
          description: null,
          logoUrl: null
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private mapChainToCoinGeckoPlatform(chain: string): string | null {
    const chainMap: { [key: string]: string } = {
      'Ethereum': 'ethereum',
      'BSC': 'binance-smart-chain',
      'Polygon': 'polygon-pos',
      'Arbitrum': 'arbitrum-one',
      'Optimism': 'optimistic-ethereum',
      'Avalanche': 'avalanche',
      'Fantom': 'fantom',
      'Cronos': 'cronos',
      'Base': 'base',
      'Linea': 'linea',
      'Mantle': 'mantle',
      'Scroll': 'scroll',
      'zkSync': 'zksync',
      'Starknet': 'starknet'
    };
    
    return chainMap[chain] || null;
  }

  private extractTelegramFromLinks(links: any): string | null {
    if (!links) return null;
    
    const telegramLinks = links.repos_url?.telegram || links.chat_url || [];
    if (Array.isArray(telegramLinks) && telegramLinks.length > 0) {
      return telegramLinks[0];
    }
    
    if (links.community_url?.telegram) {
      return links.community_url.telegram[0];
    }
    
    return null;
  }

  private extractTwitterFromLinks(links: any): string | null {
    if (!links) return null;
    
    const twitterLinks = links.repos_url?.twitter || links.twitter_screen_name || [];
    if (Array.isArray(twitterLinks) && twitterLinks.length > 0) {
      return twitterLinks[0];
    }
    
    if (links.community_url?.twitter) {
      return links.community_url.twitter[0];
    }
    
    return null;
  }

  formatMarketCap(marketCap: number | null): string {
    if (!marketCap) return 'N/A';
    
    if (marketCap >= 1e12) {
      return `$${(marketCap / 1e12).toFixed(2)}T`;
    } else if (marketCap >= 1e9) {
      return `$${(marketCap / 1e9).toFixed(2)}B`;
    } else if (marketCap >= 1e6) {
      return `$${(marketCap / 1e6).toFixed(2)}M`;
    } else if (marketCap >= 1e3) {
      return `$${(marketCap / 1e3).toFixed(2)}K`;
    } else {
      return `$${marketCap.toFixed(2)}`;
    }
  }

  formatVolume(volume: number | null): string {
    if (!volume) return 'N/A';
    
    if (volume >= 1e12) {
      return `$${(volume / 1e12).toFixed(2)}T`;
    } else if (volume >= 1e9) {
      return `$${(volume / 1e9).toFixed(2)}B`;
    } else if (volume >= 1e6) {
      return `$${(volume / 1e6).toFixed(2)}M`;
    } else if (volume >= 1e3) {
      return `$${(volume / 1e3).toFixed(2)}K`;
    } else {
      return `$${volume.toFixed(2)}`;
    }
  }

  formatPrice(price: number | null): string {
    if (!price) return 'N/A';
    
    if (price < 0.000001) {
      return `$${price.toExponential(2)}`;
    } else if (price < 0.01) {
      return `$${price.toFixed(6)}`;
    } else if (price < 1) {
      return `$${price.toFixed(4)}`;
    } else if (price < 100) {
      return `$${price.toFixed(2)}`;
    } else {
      return `$${price.toFixed(2)}`;
    }
  }

  formatPriceChange(change: number | null): string {
    if (change === null || change === undefined) return 'N/A';
    
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }
}

export const tokenInfoService = TokenInfoService.getInstance();
