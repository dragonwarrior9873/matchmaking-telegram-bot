import { 
  ProjectModel, 
  AdminModel, 
  ProjectLikeModel, 
  MatchModel, 
  MatchGroupModel,
  toJSON 
} from '../database/models';
import { Project, Admin, ProjectLike, Match, MatchGroup } from '../types';
import mongoose from 'mongoose';

export class DatabaseService {
  // Project operations
  async createProject(projectData: Omit<Project, 'id' | '_id' | 'created_at' | 'updated_at'>): Promise<Project> {
    try {
      const project = new ProjectModel(projectData);
      const savedProject = await project.save();
      return toJSON(savedProject);
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error('Contract address already exists');
      }
      throw error;
    }
  }

  async getProjectById(id: string): Promise<Project | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
      }
      const project = await ProjectModel.findById(id);
      return project ? toJSON(project) : null;
    } catch (error) {
      console.error('Error getting project by ID:', error);
      return null;
    }
  }

  async getProjectByContractAddress(contractAddress: string): Promise<Project | null> {
    try {
      const project = await ProjectModel.findOne({ contract_address: contractAddress });
      return project ? toJSON(project) : null;
    } catch (error) {
      console.error('Error getting project by contract address:', error);
      return null;
    }
  }

  async getActiveProjects(excludeProjectId?: string): Promise<Project[]> {
    try {
      const query: any = { is_active: true };
      
      if (excludeProjectId) {
        query._id = { $ne: excludeProjectId };
      }
      
      const projects = await ProjectModel.find(query).sort({ created_at: -1 });
      return projects.map(toJSON);
    } catch (error) {
      console.error('Error getting active projects:', error);
      return [];
    }
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
      }
      
      const project = await ProjectModel.findByIdAndUpdate(
        id, 
        { $set: updates }, 
        { new: true, runValidators: true }
      );
      
      return project ? toJSON(project) : null;
    } catch (error) {
      console.error('Error updating project:', error);
      return null;
    }
  }

  // Admin operations
  async createAdmin(adminData: Omit<Admin, 'id' | '_id' | 'created_at'>): Promise<Admin> {
    try {
      const admin = new AdminModel(adminData);
      const savedAdmin = await admin.save();
      return toJSON(savedAdmin);
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error('Telegram ID already registered');
      }
      throw error;
    }
  }

  async createOrUpdateAdmin(adminData: Omit<Admin, 'id' | '_id' | 'created_at'>): Promise<Admin> {
    try {
      // Check if admin already exists
      const existingAdmin = await AdminModel.findOne({ telegram_id: adminData.telegram_id });
      
      if (existingAdmin) {
        // Update existing admin with new project_id
        const updatedAdmin = await AdminModel.findByIdAndUpdate(
          existingAdmin._id,
          { 
            $set: { 
              project_id: adminData.project_id,
              username: adminData.username,
              first_name: adminData.first_name,
              last_name: adminData.last_name
            } 
          },
          { new: true, runValidators: true }
        );
        return toJSON(updatedAdmin!);
      } else {
        // Create new admin
        const admin = new AdminModel(adminData);
        const savedAdmin = await admin.save();
        return toJSON(savedAdmin);
      }
    } catch (error) {
      console.error('Error creating or updating admin:', error);
      throw error;
    }
  }

  async getAdminByTelegramId(telegramId: number): Promise<Admin | null> {
    try {
      const admin = await AdminModel.findOne({ telegram_id: telegramId });
      return admin ? toJSON(admin) : null;
    } catch (error) {
      console.error('Error getting admin by telegram ID:', error);
      return null;
    }
  }

  async getAdminsByTelegramId(telegramId: number): Promise<Admin[]> {
    try {
      const admins = await AdminModel.find({ telegram_id: telegramId });
      return admins.map(toJSON);
    } catch (error) {
      console.error('Error getting admins by telegram ID:', error);
      return [];
    }
  }

  async getAdminsByProjectId(projectId: string): Promise<Admin[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return [];
      }
      
      const admins = await AdminModel.find({ project_id: projectId });
      return admins.map(toJSON);
    } catch (error) {
      console.error('Error getting admins by project ID:', error);
      return [];
    }
  }

  // Project likes operations
  async createLike(likerProjectId: string, likedProjectId: string): Promise<ProjectLike | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(likerProjectId) || 
          !mongoose.Types.ObjectId.isValid(likedProjectId)) {
        return null;
      }

      // Check if like already exists
      const existingLike = await ProjectLikeModel.findOne({
        liker_project_id: likerProjectId,
        liked_project_id: likedProjectId
      });

      if (existingLike) {
        return toJSON(existingLike);
      }

      const like = new ProjectLikeModel({
        liker_project_id: likerProjectId,
        liked_project_id: likedProjectId
      });
      
      const savedLike = await like.save();
      return toJSON(savedLike);
    } catch (error) {
      console.error('Error creating like:', error);
      return null;
    }
  }

  async checkMutualLike(projectAId: string, projectBId: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(projectAId) || 
          !mongoose.Types.ObjectId.isValid(projectBId)) {
        return false;
      }

      const likeCount = await ProjectLikeModel.countDocuments({
        $or: [
          { liker_project_id: projectAId, liked_project_id: projectBId },
          { liker_project_id: projectBId, liked_project_id: projectAId }
        ]
      });

      return likeCount === 2;
    } catch (error) {
      console.error('Error checking mutual like:', error);
      return false;
    }
  }

  async hasLiked(likerProjectId: string, likedProjectId: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(likerProjectId) || 
          !mongoose.Types.ObjectId.isValid(likedProjectId)) {
        return false;
      }

      const like = await ProjectLikeModel.findOne({
        liker_project_id: likerProjectId,
        liked_project_id: likedProjectId
      });

      return !!like;
    } catch (error) {
      console.error('Error checking if liked:', error);
      return false;
    }
  }

  async getProjectsNotLikedBy(projectId: string): Promise<Project[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return [];
      }

      // Get all project IDs that have been liked by this project
      const likedProjects = await ProjectLikeModel.find(
        { liker_project_id: projectId },
        { liked_project_id: 1 }
      );
      
      const likedProjectIds = likedProjects.map(like => like.liked_project_id);
      
      // Find active projects excluding the current project and already liked projects
      const projects = await ProjectModel.find({
        is_active: true,
        _id: { 
          $ne: projectId,
          $nin: likedProjectIds
        }
      }).sort({ created_at: -1 });

      return projects.map(toJSON);
    } catch (error) {
      console.error('Error getting projects not liked by:', error);
      return [];
    }
  }

  // Match operations
  async createMatch(projectAId: string, projectBId: string): Promise<Match> {
    try {
      if (!mongoose.Types.ObjectId.isValid(projectAId) || 
          !mongoose.Types.ObjectId.isValid(projectBId)) {
        throw new Error('Invalid project IDs');
      }

      const match = new MatchModel({
        project_a_id: projectAId,
        project_b_id: projectBId
      });
      
      const savedMatch = await match.save();
      return toJSON(savedMatch);
    } catch (error) {
      console.error('Error creating match:', error);
      throw error;
    }
  }

  async getMatchById(id: string): Promise<Match | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
      }
      
      const match = await MatchModel.findById(id);
      return match ? toJSON(match) : null;
    } catch (error) {
      console.error('Error getting match by ID:', error);
      return null;
    }
  }

  async getMatchesByProjectId(projectId: string): Promise<Match[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return [];
      }

      const matches = await MatchModel.find({
        $or: [
          { project_a_id: projectId },
          { project_b_id: projectId }
        ]
      }).sort({ created_at: -1 });

      return matches.map(toJSON);
    } catch (error) {
      console.error('Error getting matches by project ID:', error);
      return [];
    }
  }

  async updateMatchAnnounced(matchId: string, announced: boolean): Promise<Match | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(matchId)) {
        return null;
      }

      const match = await MatchModel.findByIdAndUpdate(
        matchId,
        { $set: { announced } },
        { new: true }
      );

      return match ? toJSON(match) : null;
    } catch (error) {
      console.error('Error updating match announced status:', error);
      return null;
    }
  }

  async updateMatchPrivateGroup(matchId: string, groupId: string, inviteLink: string): Promise<Match | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(matchId)) {
        return null;
      }

      const match = await MatchModel.findByIdAndUpdate(
        matchId,
        { 
          $set: { 
            private_group_id: groupId, 
            private_group_invite_link: inviteLink 
          } 
        },
        { new: true }
      );

      return match ? toJSON(match) : null;
    } catch (error) {
      console.error('Error updating match private group:', error);
      return null;
    }
  }

  // Match group operations
  async createMatchGroup(matchId: string, telegramGroupId: string, inviteLink: string): Promise<MatchGroup> {
    try {
      if (!mongoose.Types.ObjectId.isValid(matchId)) {
        throw new Error('Invalid match ID');
      }

      const matchGroup = new MatchGroupModel({
        match_id: matchId,
        telegram_group_id: telegramGroupId,
        invite_link: inviteLink
      });

      const savedMatchGroup = await matchGroup.save();
      return toJSON(savedMatchGroup);
    } catch (error) {
      console.error('Error creating match group:', error);
      throw error;
    }
  }

  // Get unannounced matches for background processing
  async getUnannouncedMatches(): Promise<Match[]> {
    try {
      const matches = await MatchModel.find({ announced: false }).sort({ created_at: 1 });
      return matches.map(toJSON);
    } catch (error) {
      console.error('Error getting unannounced matches:', error);
      return [];
    }
  }

  // Statistics methods for admin commands
  async getStatistics(): Promise<{
    totalProjects: number;
    totalAdmins: number;
    totalLikes: number;
    totalMatches: number;
    activeProjects: number;
    verifiedProjects: number;
  }> {
    try {
      const [
        totalProjects,
        totalAdmins,
        totalLikes,
        totalMatches,
        activeProjects,
        verifiedProjects
      ] = await Promise.all([
        ProjectModel.countDocuments(),
        AdminModel.countDocuments(),
        ProjectLikeModel.countDocuments(),
        MatchModel.countDocuments(),
        ProjectModel.countDocuments({ is_active: true }),
        ProjectModel.countDocuments({ verified: true })
      ]);

      return {
        totalProjects,
        totalAdmins,
        totalLikes,
        totalMatches,
        activeProjects,
        verifiedProjects
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      return {
        totalProjects: 0,
        totalAdmins: 0,
        totalLikes: 0,
        totalMatches: 0,
        activeProjects: 0,
        verifiedProjects: 0
      };
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await ProjectModel.findOne().limit(1);
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

export const dbService = new DatabaseService();