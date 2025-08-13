export interface Project {
  id?: string;
  _id?: string;
  name: string;
  logo_file_id?: string;
  contract_address: string;
  chains: string[];
  market_cap: string;
  categories?: string[];
  description?: string;

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

  telegram_group?: string;
  telegram_channel?: string;
  x_account?: string;
  admin_handles: string[];
  created_at?: Date;
  updated_at?: Date;
  is_active: boolean;
  verified: boolean;
}

export interface Admin {
  id?: string;
  _id?: string;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  project_id: string;
  created_at?: Date;
}

export interface ProjectLike {
  id?: string;
  _id?: string;
  liker_project_id: string;
  liked_project_id: string;
  created_at?: Date;
}

export interface Match {
  id?: string;
  _id?: string;
  project_a_id: string;
  project_b_id: string;
  created_at?: Date;
  announced: boolean;
  private_group_id?: string;
  private_group_invite_link?: string;
}

export interface MatchGroup {
  id?: string;
  _id?: string;
  match_id: string;
  telegram_group_id: string;
  invite_link: string;
  created_at?: Date;
}

export enum Chain {
  ETHEREUM = 'Ethereum',
  POLYGON = 'Polygon',
  BSC = 'BSC',
  ARBITRUM = 'Arbitrum',
  OPTIMISM = 'Optimism',
  SOLANA = 'Solana',
  BASE = 'Base',
  AVALANCHE = 'Avalanche',
  SUI = 'SUI',
  XRP = 'XRP',
  TON = 'TON',
  SONIC = 'SONIC'
}

export enum MarketCap {
  RANGE_0_1M = '0-1M',
  RANGE_1_5M = '1-5M',
  RANGE_1_10M = '1-10M',
  RANGE_10_100M = '10-100M',
  RANGE_100M_PLUS = '100M+',
  MATCH_ANYTHING = '🤑 Will Match with ANYTHING 🤑'
}

export enum Category {
  MEME_COIN = 'Meme Coin',
  KOL = 'KOL',
  AI = 'AI',
  METAVERSE = 'Metaverse',
  PLAY_TO_EARN = 'Play-to-Earn',
  BLOCKCHAIN = 'Blockchain',
  LAUNCHPAD = 'Launchpad',
  NFTS = 'NFTs',
  TELEGRAM_BOT = 'Telegram Bot',
  CTO = 'CTO'
}



export interface ConversationData {
  step?: string;
  projectData?: Partial<Project>;
  currentProjectIndex?: number;
  viewingProjects?: Project[];
}
