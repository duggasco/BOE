/**
 * Schedule service for managing report schedules and distribution
 */

import apiClient from './client';
import { 
  type Schedule, 
  type ScheduleCreate, 
  type ScheduleUpdate, 
  type ScheduleExecution,
  type DistributionTemplate,
  type EmailTestRequest
} from '../../types/schedule';

const SCHEDULE_BASE_URL = '/schedules';

/**
 * Schedule CRUD operations
 */
export const scheduleService = {
  /**
   * Get all schedules for the current user
   */
  async getSchedules(params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
  }): Promise<{ schedules: Schedule[]; total: number }> {
    const response = await apiClient.get(SCHEDULE_BASE_URL, { params });
    return response.data;
  },

  /**
   * Get a specific schedule by ID
   */
  async getSchedule(id: string): Promise<Schedule> {
    const response = await apiClient.get(`${SCHEDULE_BASE_URL}/${id}`);
    return response.data;
  },

  /**
   * Create a new schedule
   */
  async createSchedule(schedule: ScheduleCreate): Promise<Schedule> {
    const response = await apiClient.post(SCHEDULE_BASE_URL, schedule);
    return response.data;
  },

  /**
   * Update an existing schedule
   */
  async updateSchedule(id: string, schedule: ScheduleUpdate): Promise<Schedule> {
    const response = await apiClient.put(`${SCHEDULE_BASE_URL}/${id}`, schedule);
    return response.data;
  },

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string): Promise<void> {
    await apiClient.delete(`${SCHEDULE_BASE_URL}/${id}`);
  },

  /**
   * Pause a schedule
   */
  async pauseSchedule(id: string): Promise<Schedule> {
    const response = await apiClient.post(`${SCHEDULE_BASE_URL}/${id}/pause`);
    return response.data;
  },

  /**
   * Resume a paused schedule
   */
  async resumeSchedule(id: string): Promise<Schedule> {
    const response = await apiClient.post(`${SCHEDULE_BASE_URL}/${id}/resume`);
    return response.data;
  },

  /**
   * Test run a schedule immediately
   */
  async testSchedule(id: string): Promise<{ message: string; execution_id?: string }> {
    const response = await apiClient.post(`${SCHEDULE_BASE_URL}/${id}/test`);
    return response.data;
  },

  /**
   * Get execution history for a schedule
   */
  async getScheduleHistory(
    id: string,
    params?: { skip?: number; limit?: number }
  ): Promise<{ executions: ScheduleExecution[]; total: number }> {
    const response = await apiClient.get(`${SCHEDULE_BASE_URL}/${id}/history`, { params });
    return response.data;
  },

  /**
   * Get all executions across all schedules
   */
  async getAllExecutions(params?: {
    skip?: number;
    limit?: number;
    status?: string;
  }): Promise<{ executions: ScheduleExecution[]; total: number }> {
    const response = await apiClient.get(`${SCHEDULE_BASE_URL}/executions`, { params });
    return response.data;
  },

  /**
   * Test schedule configuration
   */
  async testConfiguration(config: Partial<ScheduleCreate>): Promise<{
    valid: boolean;
    next_run?: string;
    errors?: string[];
  }> {
    const response = await apiClient.post(`${SCHEDULE_BASE_URL}/test`, config);
    return response.data;
  }
};

/**
 * Distribution template operations
 */
export const templateService = {
  /**
   * Get all distribution templates
   */
  async getTemplates(): Promise<DistributionTemplate[]> {
    const response = await apiClient.get(`${SCHEDULE_BASE_URL}/templates`);
    return response.data;
  },

  /**
   * Create a new distribution template
   */
  async createTemplate(template: Omit<DistributionTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<DistributionTemplate> {
    const response = await apiClient.post(`${SCHEDULE_BASE_URL}/templates`, template);
    return response.data;
  },

  /**
   * Delete a distribution template
   */
  async deleteTemplate(id: string): Promise<void> {
    await apiClient.delete(`${SCHEDULE_BASE_URL}/templates/${id}`);
  }
};

/**
 * Email testing operations
 */
export const emailTestService = {
  /**
   * Test SMTP connection
   */
  async testConnection(): Promise<{
    success: boolean;
    server?: string;
    port?: number;
    error?: string;
  }> {
    const response = await apiClient.post(`${SCHEDULE_BASE_URL}/test/email/connection`);
    return response.data;
  },

  /**
   * Send a test email
   */
  async sendTestEmail(request: EmailTestRequest): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    const response = await apiClient.post(`${SCHEDULE_BASE_URL}/test/email/send`, request);
    return response.data;
  },

  /**
   * Validate email configuration
   */
  async validateConfig(config: any): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    const response = await apiClient.post(`${SCHEDULE_BASE_URL}/test/email/config`, config);
    return response.data;
  }
};

export default {
  schedules: scheduleService,
  templates: templateService,
  email: emailTestService
};