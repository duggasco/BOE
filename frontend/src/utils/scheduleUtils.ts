/**
 * Shared utility functions for schedule-related components
 */

import type { ExecutionStatus } from '../types/schedule';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import React from 'react';

/**
 * Get the appropriate color for an execution status
 */
export const getStatusColor = (status: ExecutionStatus): string => {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
      return 'error';
    case 'running':
      return 'processing';
    case 'pending':
      return 'default';
    case 'skipped':
      return 'warning';
    default:
      return 'default';
  }
};

/**
 * Get the appropriate icon for an execution status
 */
export const getStatusIcon = (status: ExecutionStatus): React.ReactNode => {
  switch (status) {
    case 'success':
      return React.createElement(CheckCircleOutlined);
    case 'failed':
      return React.createElement(CloseCircleOutlined);
    case 'running':
      return React.createElement(SyncOutlined, { spin: true });
    case 'pending':
      return React.createElement(ClockCircleOutlined);
    case 'skipped':
      return React.createElement(WarningOutlined);
    default:
      return React.createElement(QuestionCircleOutlined);
  }
};

/**
 * Calculate success rate percentage
 */
export const calculateSuccessRate = (successCount: number, totalCount: number): number => {
  if (totalCount === 0) return 0;
  return (successCount / totalCount) * 100;
};

/**
 * Format duration from milliseconds to human-readable string
 */
export const formatDuration = (milliseconds: number): string => {
  const seconds = milliseconds / 1000;
  
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};

/**
 * Get success rate color based on percentage
 */
export const getSuccessRateColor = (rate: number): string => {
  if (rate >= 95) return '#52c41a'; // green
  if (rate >= 80) return '#faad14'; // orange
  return '#ff4d4f'; // red
};

/**
 * Validate email addresses
 */
export const validateEmailList = (emailString: string): string[] | null => {
  const emails = emailString.split(',').map(e => e.trim()).filter(Boolean);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  for (const email of emails) {
    if (!emailRegex.test(email)) {
      return null;
    }
  }
  
  return emails;
};

/**
 * Format file size from bytes to human-readable string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};