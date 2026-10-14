import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

export type ClientProjectStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'UNDER_REVIEW'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CreateClientProjectInput {
  title: string;
  description?: string;
  category?: string;
  technologyStack?: string[];
  serviceType?: string;
  budget?: number;
  currency?: string;
  deadline?: Date | string;
}

export interface UpdateClientProjectInput {
  title?: string;
  description?: string;
  category?: string;
  technologyStack?: string[];
  serviceType?: string;
  budget?: number;
  currency?: string;
  deadline?: Date | string;
  status?: ClientProjectStatus;
}

export interface ProjectFile {
  url: string;
  name?: string;
  uploadedAt?: string;
}

export interface ClientProject {
  id: string;
  projectToken: string;
  clientId: string;
  title: string;
  description: string | null;
  category: string | null;
  technologyStack: string[];
  serviceType: string | null;
  budget: number | null;
  currency: string;
  deadline: Date | null;
  status: ClientProjectStatus;
  assignedTeamId: string | null;
  assignedDeveloperId: string | null;
  files: ProjectFile[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const VALID_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
const VALID_PROJECT_CATEGORIES = [
  'Web Development',
  'Mobile App',
  'Software Development',
  'AI/ML Solutions',
  'E-commerce',
  'UI/UX Design',
  'Consulting',
  'Other',
];

@Injectable()
export class ClientsService {
  constructor(private readonly database: DatabaseService) {}

  // ============================================================================
  // Client Project Management
  // ============================================================================

  async getClientProjects(clientId: string): Promise<ClientProject[]> {
    const result = await this.database.query<ClientProject>(
      `SELECT 
        id, project_token AS "projectToken", client_id AS "clientId",
        title, description, category, technology_stack AS "technologyStack",
        service_type AS "serviceType", budget, currency, deadline,
        status, assigned_team_id AS "assignedTeamId", 
        assigned_developer_id AS "assignedDeveloperId",
        files, metadata, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM client_projects 
       WHERE client_id = $1 
       ORDER BY created_at DESC`,
      [clientId],
    );
    return result.rows.map(this.normalizeProject);
  }

  async getClientProjectById(projectId: string): Promise<ClientProject> {
    const result = await this.database.query<ClientProject>(
      `SELECT 
        id, project_token AS "projectToken", client_id AS "clientId",
        title, description, category, technology_stack AS "technologyStack",
        service_type AS "serviceType", budget, currency, deadline,
        status, assigned_team_id AS "assignedTeamId", 
        assigned_developer_id AS "assignedDeveloperId",
        files, metadata, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM client_projects 
       WHERE id = $1`,
      [projectId],
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }
    
    return this.normalizeProject(result.rows[0]);
  }

  async getClientProjectByToken(projectToken: string): Promise<ClientProject> {
    const result = await this.database.query<ClientProject>(
      `SELECT 
        id, project_token AS "projectToken", client_id AS "clientId",
        title, description, category, technology_stack AS "technologyStack",
        service_type AS "serviceType", budget, currency, deadline,
        status, assigned_team_id AS "assignedTeamId", 
        assigned_developer_id AS "assignedDeveloperId",
        files, metadata, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM client_projects 
       WHERE project_token = $1`,
      [projectToken],
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundException(`Project not found: ${projectToken}`);
    }
    
    return this.normalizeProject(result.rows[0]);
  }

  async createClientProject(
    clientId: string,
    input: CreateClientProjectInput,
  ): Promise<ClientProject> {
    // Validate inputs
    this.validateProjectInput(input);
    
    const projectId = randomUUID();
    const projectToken = `UK-P-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const deadlineDate = input.deadline 
      ? new Date(input.deadline) 
      : null;
    
    const result = await this.database.query(
      `INSERT INTO client_projects (
        id, project_token, client_id, title, description, category,
        technology_stack, service_type, budget, currency, deadline, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING 
        id, project_token AS "projectToken", client_id AS "clientId",
        title, description, category, technology_stack AS "technologyStack",
        service_type AS "serviceType", budget, currency, deadline,
        status, assigned_team_id AS "assignedTeamId", 
        assigned_developer_id AS "assignedDeveloperId",
        files, metadata, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        projectId,
        projectToken,
        clientId,
        input.title,
        input.description ?? null,
        input.category ?? null,
        input.technologyStack ?? [],
        input.serviceType ?? null,
        input.budget ?? null,
        input.currency ?? 'INR',
        deadlineDate,
        'DRAFT' as ClientProjectStatus,
      ],
    );
    
    const project = this.normalizeProject(result.rows[0]);
    
    // Record creation in audit log
    await this.recordAuditEvent(
      clientId,
      'PROJECT_CREATED',
      'SUCCESS',
      { projectId: project.id, projectToken: project.projectToken, title: project.title },
    );
    
    return project;
  }

  async updateClientProject(
    clientId: string,
    projectId: string,
    input: UpdateClientProjectInput,
  ): Promise<ClientProject> {
    // First, verify the project belongs to the client
    const project = await this.getClientProjectById(projectId);
    if (project.clientId !== clientId) {
      throw new ForbiddenException('You can only update your own projects');
    }
    
    // Validate status transitions
    if (input.status) {
      await this.validateStatusTransition(project.status, input.status, clientId);
    }
    
    // Validate other inputs
    if (input.budget !== undefined || input.currency !== undefined) {
      if (input.budget !== undefined && (input.budget < 0 || input.budget > 10000000)) {
        throw new BadRequestException('Budget must be between 0 and 10,000,000');
      }
      if (input.currency && !VALID_CURRENCIES.includes(input.currency)) {
        throw new BadRequestException(`Invalid currency. Must be one of: ${VALID_CURRENCIES.join(', ')}`);
      }
    }
    
    // Build update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    
    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(input.category);
    }
    if (input.technologyStack !== undefined) {
      updates.push(`technology_stack = $${paramIndex++}`);
      values.push(input.technologyStack);
    }
    if (input.serviceType !== undefined) {
      updates.push(`service_type = $${paramIndex++}`);
      values.push(input.serviceType);
    }
    if (input.budget !== undefined) {
      updates.push(`budget = $${paramIndex++}`);
      values.push(input.budget);
    }
    if (input.currency !== undefined) {
      updates.push(`currency = $${paramIndex++}`);
      values.push(input.currency);
    }
    if (input.deadline !== undefined) {
      const deadlineDate = input.deadline ? new Date(input.deadline) : null;
      updates.push(`deadline = $${paramIndex++}`);
      values.push(deadlineDate);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(projectId);
    
    if (updates.length === 1) {
      // Only updated_at was added
      throw new BadRequestException('No valid updates provided');
    }
    
    const result = await this.database.query<ClientProject>(
      `UPDATE client_projects 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING 
        id, project_token AS "projectToken", client_id AS "clientId",
        title, description, category, technology_stack AS "technologyStack",
        service_type AS "serviceType", budget, currency, deadline,
        status, assigned_team_id AS "assignedTeamId", 
        assigned_developer_id AS "assignedDeveloperId",
        files, metadata, created_at AS "createdAt", updated_at AS "updatedAt"`,
      values,
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }
    
    const updatedProject = this.normalizeProject(result.rows[0]);
    
    // Record status change in history if status changed
    if (input.status && input.status !== project.status) {
      await this.recordStatusChange(projectId, project.status, input.status, clientId);
    }
    
    // Record update in audit log
    await this.recordAuditEvent(
      clientId,
      'PROJECT_UPDATED',
      'SUCCESS',
      { 
        projectId: updatedProject.id, 
        previousStatus: project.status,
        newStatus: updatedProject.status 
      },
    );
    
    return updatedProject;
  }

  async deleteClientProject(clientId: string, projectId: string): Promise<{ success: boolean }> {
    // First, verify the project belongs to the client
    const project = await this.getClientProjectById(projectId);
    if (project.clientId !== clientId) {
      throw new ForbiddenException('You can only delete your own projects');
    }
    
    // Check if project can be deleted
    if (project.status !== 'DRAFT' && project.status !== 'CANCELLED') {
      throw new ForbiddenException('Only draft or cancelled projects can be deleted');
    }
    
    await this.database.query('DELETE FROM client_projects WHERE id = $1', [projectId]);
    
    // Record deletion in audit log
    await this.recordAuditEvent(
      clientId,
      'PROJECT_DELETED',
      'SUCCESS',
      { projectId, projectToken: project.projectToken, title: project.title },
    );
    
    return { success: true };
  }

  // ============================================================================
  // Project Status Management
  // ============================================================================

  private async validateStatusTransition(
    currentStatus: ClientProjectStatus,
    newStatus: ClientProjectStatus,
    clientId: string,
  ): Promise<void> {
    const validTransitions: Record<ClientProjectStatus, ClientProjectStatus[]> = {
      DRAFT: ['SUBMITTED', 'CANCELLED'],
      SUBMITTED: ['AWAITING_PAYMENT', 'UNDER_REVIEW', 'CANCELLED'],
      AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
      PAID: ['UNDER_REVIEW', 'CANCELLED'],
      UNDER_REVIEW: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['DELIVERED', 'CANCELLED'],
      DELIVERED: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };
    
    const allowedTransitions = validTransitions[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${currentStatus} -> ${newStatus}. ` +
        `Allowed transitions: ${allowedTransitions.join(', ')}`,
      );
    }
    
    // Clients can only transition to certain statuses
    const clientAllowedTransitions: Record<ClientProjectStatus, ClientProjectStatus[]> = {
      DRAFT: ['SUBMITTED', 'CANCELLED'],
      SUBMITTED: ['CANCELLED'],
      AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
      PAID: ['CANCELLED'],
      UNDER_REVIEW: ['CANCELLED'],
      IN_PROGRESS: ['CANCELLED'],
      DELIVERED: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };
    
    const clientAllowed = clientAllowedTransitions[currentStatus];
    if (!clientAllowed.includes(newStatus)) {
      throw new ForbiddenException(
        `Clients cannot transition project from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  private async recordStatusChange(
    projectId: string,
    oldStatus: ClientProjectStatus,
    newStatus: ClientProjectStatus,
    changedBy: string,
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO project_status_history (
        project_id, previous_status, new_status, changed_by, notes
      ) VALUES ($1, $2, $3, $4, $5)`,
      [projectId, oldStatus, newStatus, changedBy, null],
    );
  }

  async getProjectStatusHistory(projectId: string): Promise<Array<{
    id: string;
    previousStatus: ClientProjectStatus;
    newStatus: ClientProjectStatus;
    changedBy: string;
    changedAt: Date;
    notes: string | null;
  }>> {
    const result = await this.database.query(
      `SELECT 
        id, previous_status AS "previousStatus", new_status AS "newStatus",
        changed_by AS "changedBy", changed_at AS "changedAt", notes
       FROM project_status_history 
       WHERE project_id = $1 
       ORDER BY changed_at DESC`,
      [projectId],
    );
    return result.rows.map(row => ({
      id: row.id,
      previousStatus: row.previousStatus as ClientProjectStatus,
      newStatus: row.newStatus as ClientProjectStatus,
      changedBy: row.changedBy,
      changedAt: row.changedAt instanceof Date ? row.changedAt : new Date(row.changedAt),
      notes: row.notes,
    }));
  }

  // ============================================================================
  // Project Files
  // ============================================================================

  async addProjectFile(
    clientId: string,
    projectId: string,
    fileUrl: string,
    fileName: string,
  ): Promise<ClientProject> {
    // Verify project belongs to client
    const project = await this.getClientProjectById(projectId);
    if (project.clientId !== clientId) {
      throw new ForbiddenException('You can only add files to your own projects');
    }
    
    // Add new file
    const updatedFiles = [...project.files, { url: fileUrl, name: fileName, uploadedAt: new Date().toISOString() }];
    
    const result = await this.database.query<ClientProject>(
      `UPDATE client_projects 
       SET files = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING 
        id, project_token AS "projectToken", client_id AS "clientId",
        title, description, category, technology_stack AS "technologyStack",
        service_type AS "serviceType", budget, currency, deadline,
        status, assigned_team_id AS "assignedTeamId", 
        assigned_developer_id AS "assignedDeveloperId",
        files, metadata, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [JSON.stringify(updatedFiles), projectId],
    );
    
    return this.normalizeProject(result.rows[0]);
  }

  async removeProjectFile(
    clientId: string,
    projectId: string,
    fileUrl: string,
  ): Promise<ClientProject> {
    // Verify project belongs to client
    const project = await this.getClientProjectById(projectId);
    if (project.clientId !== clientId) {
      throw new ForbiddenException('You can only remove files from your own projects');
    }
    
    // Filter out the file to remove
    const updatedFiles = project.files.filter((file) => file.url !== fileUrl);
    
    const result = await this.database.query<ClientProject>(
      `UPDATE client_projects 
       SET files = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING 
        id, project_token AS "projectToken", client_id AS "clientId",
        title, description, category, technology_stack AS "technologyStack",
        service_type AS "serviceType", budget, currency, deadline,
        status, assigned_team_id AS "assignedTeamId", 
        assigned_developer_id AS "assignedDeveloperId",
        files, metadata, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [JSON.stringify(updatedFiles), projectId],
    );
    
    return this.normalizeProject(result.rows[0]);
  }

  // ============================================================================
  // Client Management
  // ============================================================================

  async getClientProfile(clientId: string): Promise<{
    id: string;
    email: string;
    name: string;
    role: string;
    accountType: string;
    workspaceId: string;
    companyName: string | null;
    companyRole: string | null;
    createdAt: Date;
  }> {
    const result = await this.database.query(
      `SELECT 
        id, email, name, role, account_type AS "accountType",
        workspace_id AS "workspaceId", company_name AS "companyName",
        company_role AS "companyRole", created_at AS "createdAt"
       FROM users 
       WHERE id = $1`,
      [clientId],
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundException(`Client not found: ${clientId}`);
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      accountType: row.accountType,
      workspaceId: row.workspaceId,
      companyName: row.companyName,
      companyRole: row.companyRole,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    };
  }

  async updateClientProfile(
    clientId: string,
    updates: { name?: string; companyName?: string },
  ): Promise<{ success: boolean; message: string }> {
    const updatesList: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    
    if (updates.name !== undefined) {
      if (updates.name.length < 2 || updates.name.length > 100) {
        throw new BadRequestException('Name must be between 2 and 100 characters');
      }
      updatesList.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    
    if (updates.companyName !== undefined) {
      if (updates.companyName.length > 120) {
        throw new BadRequestException('Company name must be less than 120 characters');
      }
      updatesList.push(`company_name = $${paramIndex++}`);
      values.push(updates.companyName);
    }
    
    if (updatesList.length === 0) {
      return { success: true, message: 'No updates provided' };
    }
    
    updatesList.push(`updated_at = NOW()`);
    values.push(clientId);
    
    await this.database.query(
      `UPDATE users SET ${updatesList.join(', ')} WHERE id = $${paramIndex}`,
      values,
    );
    
    await this.recordAuditEvent(
      clientId,
      'PROFILE_UPDATED',
      'SUCCESS',
      { updates: Object.keys(updates) },
    );
    
    return { success: true, message: 'Profile updated successfully' };
  }

  // ============================================================================
  // Client Projects Summary
  // ============================================================================

  async getClientDashboardStats(clientId: string): Promise<{
    totalProjects: number;
    submittedProjects: number;
    inProgressProjects: number;
    completedProjects: number;
    awaitingPayment: number;
    paidProjects: number;
  }> {
    const result = await this.database.query<{
      total: string;
      submitted: string;
      in_progress: string;
      completed: string;
      awaiting_payment: string;
      paid: string;
    }>(
      `SELECT 
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE status = 'SUBMITTED')::text AS submitted,
        COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::text AS in_progress,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::text AS completed,
        COUNT(*) FILTER (WHERE status = 'AWAITING_PAYMENT')::text AS awaiting_payment,
        COUNT(*) FILTER (WHERE status = 'PAID')::text AS paid
       FROM client_projects 
       WHERE client_id = $1`,
      [clientId],
    );
    
    return {
      totalProjects: Number(result.rows[0]?.total ?? 0),
      submittedProjects: Number(result.rows[0]?.submitted ?? 0),
      inProgressProjects: Number(result.rows[0]?.in_progress ?? 0),
      completedProjects: Number(result.rows[0]?.completed ?? 0),
      awaitingPayment: Number(result.rows[0]?.awaiting_payment ?? 0),
      paidProjects: Number(result.rows[0]?.paid ?? 0),
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private validateProjectInput(input: CreateClientProjectInput): void {
    if (!input.title || input.title.length < 3 || input.title.length > 255) {
      throw new BadRequestException('Title must be between 3 and 255 characters');
    }
    
    if (input.budget !== undefined && (input.budget < 0 || input.budget > 10000000)) {
      throw new BadRequestException('Budget must be between 0 and 10,000,000');
    }
    
    if (input.currency && !VALID_CURRENCIES.includes(input.currency)) {
      throw new BadRequestException(`Invalid currency. Must be one of: ${VALID_CURRENCIES.join(', ')}`);
    }
    
    if (input.category && !VALID_PROJECT_CATEGORIES.includes(input.category)) {
      throw new BadRequestException(`Invalid category. Must be one of: ${VALID_PROJECT_CATEGORIES.join(', ')}`);
    }
    
    if (input.deadline && new Date(input.deadline) < new Date()) {
      throw new BadRequestException('Deadline must be in the future');
    }
  }

  private normalizeProject(row: any): ClientProject {
    return {
      ...row,
      id: row.id,
      projectToken: row.project_token || row.projectToken,
      clientId: row.client_id || row.clientId,
      title: row.title,
      description: row.description,
      category: row.category,
      technologyStack: Array.isArray(row.technology_stack || row.technologyStack) 
        ? (row.technology_stack || row.technologyStack) 
        : (typeof (row.technology_stack || row.technologyStack) === 'string' 
          ? JSON.parse((row.technology_stack || row.technologyStack) || '[]') 
          : []),
      serviceType: row.service_type || row.serviceType,
      budget: row.budget,
      currency: row.currency || 'INR',
      deadline: row.deadline ? (row.deadline instanceof Date ? row.deadline : new Date(row.deadline)) : null,
      status: row.status,
      assignedTeamId: row.assigned_team_id || row.assignedTeamId,
      assignedDeveloperId: row.assigned_developer_id || row.assignedDeveloperId,
      files: (Array.isArray(row.files) 
        ? row.files 
        : (typeof row.files === 'string' 
          ? JSON.parse(row.files || '[]') 
          : [])) as ProjectFile[],
      metadata: typeof row.metadata === 'string' 
        ? JSON.parse(row.metadata || '{}') 
        : (row.metadata ?? {}),
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at || row.createdAt),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at || row.updatedAt),
    };
  }

  private async recordAuditEvent(
    userId: string,
    action: string,
    result: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO audit_log (user_id, action, result, metadata, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, action, result, JSON.stringify(metadata)],
      );
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      console.error('Failed to record audit event:', error);
    }
  }
}
