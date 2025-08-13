import mongoose, { Schema, Document } from 'mongoose';
import { Project, Admin, ProjectLike, Match, MatchGroup } from '../types';

// Project Schema
const ProjectSchema = new Schema<Project & Document>({
  name: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 255 
  },
  logo_file_id: { 
    type: String, 
    required: false 
  },
  contract_address: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true 
  },
  chains: [{ 
    type: String, 
    required: true 
  }],
  market_cap: {
    type: String,
    required: true
  },
  categories: [{
    type: String,
    required: false
  }],
  description: {
    type: String,
    required: false,
    trim: true,
    maxlength: 500
  },
  
  // Token info from APIs
  token_symbol: {
    type: String,
    required: false,
    trim: true
  },
  token_price: {
    type: Number,
    required: false
  },
  token_price_change_24h: {
    type: Number,
    required: false
  },
  token_volume_24h: {
    type: Number,
    required: false
  },
  token_market_cap_api: {
    type: Number,
    required: false
  },
  token_telegram_group_api: {
    type: String,
    required: false,
    trim: true
  },
  token_twitter_handle: {
    type: String,
    required: false,
    trim: true
  },
  token_website: {
    type: String,
    required: false,
    trim: true
  },
  token_description: {
    type: String,
    required: false
  },
  token_logo_url: {
    type: String,
    required: false,
    trim: true
  },
  token_info_last_updated: {
    type: Date,
    required: false
  },

  telegram_group: { 
    type: String, 
    required: false,
    trim: true 
  },
  telegram_channel: { 
    type: String, 
    required: false,
    trim: true 
  },
  x_account: { 
    type: String, 
    required: false,
    trim: true 
  },
  admin_handles: [{ 
    type: String, 
    required: true 
  }],
  is_active: { 
    type: Boolean, 
    default: true 
  },
  verified: { 
    type: Boolean, 
    default: false 
  }
}, {
  timestamps: { 
    createdAt: 'created_at', 
    updatedAt: 'updated_at' 
  }
});

// Indexes for better performance
ProjectSchema.index({ is_active: 1 });
ProjectSchema.index({ verified: 1 });
ProjectSchema.index({ contract_address: 1 }, { unique: true });
ProjectSchema.index({ created_at: -1 });

// Admin Schema
const AdminSchema = new Schema<Admin & Document>({
  telegram_id: { 
    type: Number, 
    required: true, 
    unique: true 
  },
  username: { 
    type: String, 
    required: false,
    trim: true 
  },
  first_name: { 
    type: String, 
    required: false,
    trim: true 
  },
  last_name: { 
    type: String, 
    required: false,
    trim: true 
  },
  project_id: { 
    type: String, 
    required: true 
  }
}, {
  timestamps: { 
    createdAt: 'created_at' 
  }
});

// Indexes
AdminSchema.index({ telegram_id: 1 }, { unique: true });
AdminSchema.index({ project_id: 1 });

// Project Like Schema
const ProjectLikeSchema = new Schema<ProjectLike & Document>({
  liker_project_id: { 
    type: String, 
    required: true 
  },
  liked_project_id: { 
    type: String, 
    required: true 
  }
}, {
  timestamps: { 
    createdAt: 'created_at' 
  }
});

// Compound unique index to prevent duplicate likes
ProjectLikeSchema.index(
  { liker_project_id: 1, liked_project_id: 1 }, 
  { unique: true }
);

// Prevent self-likes with validation
ProjectLikeSchema.pre('save', function(next) {
  if (this.liker_project_id === this.liked_project_id) {
    next(new Error('Projects cannot like themselves'));
  } else {
    next();
  }
});

// Indexes for performance
ProjectLikeSchema.index({ liker_project_id: 1 });
ProjectLikeSchema.index({ liked_project_id: 1 });

// Match Schema
const MatchSchema = new Schema<Match & Document>({
  project_a_id: { 
    type: String, 
    required: true 
  },
  project_b_id: { 
    type: String, 
    required: true 
  },
  announced: { 
    type: Boolean, 
    default: false 
  },
  private_group_id: { 
    type: String, 
    required: false 
  },
  private_group_invite_link: { 
    type: String, 
    required: false,
    maxlength: 500 
  }
}, {
  timestamps: { 
    createdAt: 'created_at' 
  }
});

// Prevent self-matches with validation
MatchSchema.pre('save', function(next) {
  if (this.project_a_id === this.project_b_id) {
    next(new Error('Projects cannot match with themselves'));
  } else {
    next();
  }
});

// Indexes
MatchSchema.index({ project_a_id: 1, project_b_id: 1 });
MatchSchema.index({ announced: 1 });
MatchSchema.index({ created_at: -1 });

// Match Group Schema
const MatchGroupSchema = new Schema<MatchGroup & Document>({
  match_id: { 
    type: String, 
    required: true 
  },
  telegram_group_id: { 
    type: String, 
    required: true 
  },
  invite_link: { 
    type: String, 
    required: true,
    maxlength: 500 
  }
}, {
  timestamps: { 
    createdAt: 'created_at' 
  }
});

// Indexes
MatchGroupSchema.index({ match_id: 1 });

// Create and export models
export const ProjectModel = mongoose.model<Project & Document>('Project', ProjectSchema);
export const AdminModel = mongoose.model<Admin & Document>('Admin', AdminSchema);
export const ProjectLikeModel = mongoose.model<ProjectLike & Document>('ProjectLike', ProjectLikeSchema);
export const MatchModel = mongoose.model<Match & Document>('Match', MatchSchema);
export const MatchGroupModel = mongoose.model<MatchGroup & Document>('MatchGroup', MatchGroupSchema);

// Helper function to convert MongoDB ObjectId to string for API responses
export const toJSON = (doc: any) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  
  // Convert _id to id and remove _id
  if (obj._id) {
    obj.id = obj._id.toString();
    delete obj._id;
  }
  
  // Remove __v version field
  delete obj.__v;
  
  return obj;
};

// Helper function to populate project references
export const populateProject = (field: string) => ({
  path: field,
  select: 'name logo_file_id contract_address chains market_cap telegram_group telegram_channel admin_handles is_active verified created_at updated_at'
});
