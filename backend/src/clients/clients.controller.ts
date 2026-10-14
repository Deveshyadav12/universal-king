import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles, CurrentUser } from '../auth/auth.decorators';
import { AuthGuard } from '../auth/auth.guard';
import { ClientOnlyGuard } from '../common/guards/client-only.guard';
import { AuthenticatedUser } from '../users/users.service';
import {
  ClientsService,
  CreateClientProjectInput,
  UpdateClientProjectInput,
} from './clients.service';

@Roles('client', 'admin', 'king', 'super_admin')
@UseGuards(AuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // ============================================================================
  // Client Profile
  // ============================================================================

  @Get('me/profile')
  @UseGuards(ClientOnlyGuard)
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.getClientProfile(user.id);
  }

  @Patch('me/profile')
  @UseGuards(ClientOnlyGuard)
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { name?: string; companyName?: string },
  ) {
    return this.clientsService.updateClientProfile(user.id, body);
  }

  // ============================================================================
  // Client Projects
  // ============================================================================

  @Get('me/projects')
  @UseGuards(ClientOnlyGuard)
  async getMyProjects(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const projects = await this.clientsService.getClientProjects(user.id);
    
    // Apply filters
    let filtered = projects;
    if (status) {
      filtered = filtered.filter(p => p.status === status);
    }
    
    // Apply pagination
    const limitNum = limit ? Number(limit) : 100;
    const offsetNum = offset ? Number(offset) : 0;
    
    return {
      success: true,
      projects: filtered.slice(offsetNum, offsetNum + limitNum),
      total: filtered.length,
      offset: offsetNum,
      limit: limitNum,
    };
  }

  @Get('me/projects/:id')
  @UseGuards(ClientOnlyGuard)
  async getMyProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const project = await this.clientsService.getClientProjectById(id);
    if (project.clientId !== user.id) {
      throw new BadRequestException('Project not found');
    }
    
    return { success: true, project };
  }

  @Get('me/projects/token/:token')
  @UseGuards(ClientOnlyGuard)
  async getMyProjectByToken(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
  ) {
    const project = await this.clientsService.getClientProjectByToken(token);
    if (project.clientId !== user.id) {
      throw new BadRequestException('Project not found');
    }
    
    return { success: true, project };
  }

  @Post('me/projects')
  @UseGuards(ClientOnlyGuard)
  async createProject(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateClientProjectInput,
  ) {
    const project = await this.clientsService.createClientProject(user.id, body);
    return { success: true, project };
  }

  @Patch('me/projects/:id')
  @UseGuards(ClientOnlyGuard)
  async updateProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateClientProjectInput,
  ) {
    const project = await this.clientsService.updateClientProject(
      user.id,
      id,
      body,
    );
    return { success: true, project };
  }

  @Delete('me/projects/:id')
  @UseGuards(ClientOnlyGuard)
  async deleteProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const result = await this.clientsService.deleteClientProject(user.id, id);
    return result;
  }

  // ============================================================================
  // Project Files
  // ============================================================================

  @Post('me/projects/:id/files')
  @UseGuards(ClientOnlyGuard)
  async addProjectFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { fileUrl: string; fileName: string },
  ) {
    const project = await this.clientsService.addProjectFile(
      user.id,
      id,
      body.fileUrl,
      body.fileName,
    );
    return { success: true, project };
  }

  @Delete('me/projects/:id/files')
  @UseGuards(ClientOnlyGuard)
  async removeProjectFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { fileUrl: string },
  ) {
    const project = await this.clientsService.removeProjectFile(
      user.id,
      id,
      body.fileUrl,
    );
    return { success: true, project };
  }

  // ============================================================================
  // Project Status History
  // ============================================================================

  @Get('me/projects/:id/history')
  @UseGuards(ClientOnlyGuard)
  async getProjectStatusHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    // Verify project belongs to client
    const project = await this.clientsService.getClientProjectById(id);
    if (project.clientId !== user.id) {
      throw new BadRequestException('Project not found');
    }
    
    const history = await this.clientsService.getProjectStatusHistory(id);
    return { success: true, history };
  }

  // ============================================================================
  // Client Dashboard Stats
  // ============================================================================

  @Get('me/stats')
  @UseGuards(ClientOnlyGuard)
  async getDashboardStats(@CurrentUser() user: AuthenticatedUser) {
    const stats = await this.clientsService.getClientDashboardStats(user.id);
    return { success: true, stats };
  }
}
