// Simplified schedule utilities using native JavaScript Date objects
// For production, timezone handling will be done by Python backend services
import type { ScheduleConfig, ScheduleType } from '../store/slices/exportSlice';

export interface ScheduleValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface NextRunInfo {
  date: Date | null;
  displayText: string;
  isExpired: boolean;
}

/**
 * Common IANA time zones with their display names
 */
export const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: '+00:00' },
  { value: 'America/New_York', label: 'New York (Eastern)', offset: '-05:00' },
  { value: 'America/Chicago', label: 'Chicago (Central)', offset: '-06:00' },
  { value: 'America/Denver', label: 'Denver (Mountain)', offset: '-07:00' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (Pacific)', offset: '-08:00' },
  { value: 'Europe/London', label: 'London', offset: '+00:00' },
  { value: 'Europe/Paris', label: 'Paris', offset: '+01:00' },
  { value: 'Europe/Berlin', label: 'Berlin', offset: '+01:00' },
  { value: 'Asia/Tokyo', label: 'Tokyo', offset: '+09:00' },
  { value: 'Asia/Shanghai', label: 'Shanghai', offset: '+08:00' },
  { value: 'Asia/Singapore', label: 'Singapore', offset: '+08:00' },
  { value: 'Australia/Sydney', label: 'Sydney', offset: '+11:00' },
] as const;

/**
 * Get the user's browser timezone
 */
export const getBrowserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
};

/**
 * Validate a schedule configuration
 */
export const validateSchedule = (schedule: ScheduleConfig): ScheduleValidationResult => {
  const errors: string[] = [];

  if (!schedule.active) {
    return { isValid: true, errors: [] };
  }

  // Validate start date and time
  if (!schedule.startDate) {
    errors.push('Start date is required for scheduled exports');
  }
  if (!schedule.startTime) {
    errors.push('Start time is required for scheduled exports');
  }

  // Validate type-specific fields
  if (schedule.type === 'weekly' && schedule.dayOfWeek === undefined) {
    errors.push('Day of week is required for weekly schedules');
  }
  
  if (schedule.type === 'monthly') {
    if (schedule.dayOfMonth === undefined) {
      errors.push('Day of month is required for monthly schedules');
    } else if (schedule.dayOfMonth < 1 || schedule.dayOfMonth > 31) {
      errors.push('Day of month must be between 1 and 31');
    }
  }

  // Validate date range
  if (schedule.startDate && schedule.endDate) {
    const startDate = new Date(schedule.startDate);
    const endDate = new Date(schedule.endDate);
    
    if (startDate > endDate) {
      errors.push('End date must be after start date');
    }
  }

  // Validate that start date is not in the past
  if (schedule.startDate && schedule.startTime) {
    const scheduledDateTime = new Date(`${schedule.startDate}T${schedule.startTime}:00`);
    const now = new Date();
    
    if (scheduledDateTime < now && schedule.type === 'once') {
      errors.push('One-time schedule cannot be in the past');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Calculate the next run time for a schedule
 * Note: This is a simplified version for UI display only.
 * Production scheduling will be handled by Python backend services.
 */
export const calculateNextRunTime = (schedule: ScheduleConfig): NextRunInfo => {
  if (!schedule.active) {
    return {
      date: null,
      displayText: 'Export will run immediately',
      isExpired: false
    };
  }

  if (!schedule.startDate || !schedule.startTime) {
    return {
      date: null,
      displayText: 'Incomplete schedule configuration',
      isExpired: false
    };
  }

  const now = new Date();
  const startDateTime = new Date(`${schedule.startDate}T${schedule.startTime}:00`);
  
  // Check if schedule has ended
  if (schedule.endDate) {
    const endDate = new Date(schedule.endDate + 'T23:59:59');
    if (now > endDate) {
      return {
        date: null,
        displayText: 'Schedule has expired',
        isExpired: true
      };
    }
  }

  let nextRun: Date;

  switch (schedule.type) {
    case 'once':
      nextRun = startDateTime;
      if (nextRun < now) {
        return {
          date: null,
          displayText: 'One-time schedule has already run',
          isExpired: true
        };
      }
      break;

    case 'daily':
      nextRun = new Date(startDateTime);
      while (nextRun < now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'weekly':
      if (schedule.dayOfWeek === undefined) {
        return {
          date: null,
          displayText: 'Day of week not specified',
          isExpired: false
        };
      }
      
      nextRun = new Date(startDateTime);
      // Set to the correct day of week
      const dayDiff = schedule.dayOfWeek - nextRun.getDay();
      if (dayDiff > 0) {
        nextRun.setDate(nextRun.getDate() + dayDiff);
      } else if (dayDiff < 0) {
        nextRun.setDate(nextRun.getDate() + (7 + dayDiff));
      }
      
      // Find the next occurrence after now
      while (nextRun < now) {
        nextRun.setDate(nextRun.getDate() + 7);
      }
      break;

    case 'monthly':
      if (schedule.dayOfMonth === undefined) {
        return {
          date: null,
          displayText: 'Day of month not specified',
          isExpired: false
        };
      }
      
      nextRun = new Date(startDateTime);
      
      // Handle day of month edge cases
      const targetDay = schedule.dayOfMonth;
      const daysInMonth = getDaysInMonth(nextRun.getFullYear(), nextRun.getMonth());
      const actualDay = Math.min(targetDay, daysInMonth);
      
      nextRun.setDate(actualDay);
      
      // If the calculated day is before the start date, move to next month
      if (nextRun < startDateTime) {
        nextRun.setMonth(nextRun.getMonth() + 1);
        const daysInNewMonth = getDaysInMonth(nextRun.getFullYear(), nextRun.getMonth());
        const newActualDay = Math.min(targetDay, daysInNewMonth);
        nextRun.setDate(newActualDay);
      }
      
      // Find the next occurrence after now
      while (nextRun < now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
        const daysInNextMonth = getDaysInMonth(nextRun.getFullYear(), nextRun.getMonth());
        const nextActualDay = Math.min(targetDay, daysInNextMonth);
        nextRun.setDate(nextActualDay);
      }
      break;

    default:
      return {
        date: null,
        displayText: 'Invalid schedule type',
        isExpired: false
      };
  }

  // Final check against end date
  if (schedule.endDate) {
    const endDate = new Date(schedule.endDate + 'T23:59:59');
    if (nextRun > endDate) {
      return {
        date: null,
        displayText: 'No more runs within schedule period',
        isExpired: true
      };
    }
  }

  // Format the display text
  const displayText = formatNextRunDisplay(nextRun, schedule);

  return {
    date: nextRun,
    displayText,
    isExpired: false
  };
};

/**
 * Get days in a specific month
 */
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

/**
 * Format the next run time for display
 */
const formatNextRunDisplay = (date: Date, schedule: ScheduleConfig): string => {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  let prefix = '';
  if (diffHours < 1) {
    prefix = 'In less than an hour: ';
  } else if (diffHours < 24) {
    prefix = `In ${diffHours} hour${diffHours > 1 ? 's' : ''}: `;
  } else if (diffDays === 1) {
    prefix = 'Tomorrow: ';
  } else if (diffDays < 7) {
    prefix = `In ${diffDays} days: `;
  }

  // Format date and time using native JS
  const dateStr = date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  let recurringInfo = '';
  switch (schedule.type) {
    case 'daily':
      recurringInfo = ' (repeats daily)';
      break;
    case 'weekly':
      recurringInfo = ' (repeats weekly)';
      break;
    case 'monthly':
      recurringInfo = ' (repeats monthly)';
      break;
  }

  return `${prefix}${dateStr} at ${timeStr}${recurringInfo}`;
};

/**
 * Get a human-readable schedule description
 */
export const getScheduleDescription = (schedule: ScheduleConfig): string => {
  if (!schedule.active) {
    return 'Immediate export';
  }

  const time = schedule.startTime || '00:00';
  const [hours, minutes] = time.split(':').map(Number);
  const tempDate = new Date(2000, 0, 1, hours, minutes);
  const timeStr = tempDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  switch (schedule.type) {
    case 'once':
      return `Once on ${schedule.startDate} at ${timeStr}`;
      
    case 'daily':
      return `Daily at ${timeStr}`;
      
    case 'weekly':
      if (schedule.dayOfWeek !== undefined) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Every ${days[schedule.dayOfWeek]} at ${timeStr}`;
      }
      return `Weekly at ${timeStr}`;
      
    case 'monthly':
      if (schedule.dayOfMonth !== undefined) {
        const suffix = getOrdinalSuffix(schedule.dayOfMonth);
        return `Monthly on the ${schedule.dayOfMonth}${suffix} at ${timeStr}`;
      }
      return `Monthly at ${timeStr}`;
      
    default:
      return 'Unknown schedule type';
  }
};

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
const getOrdinalSuffix = (num: number): string => {
  const j = num % 10;
  const k = num % 100;
  
  if (j === 1 && k !== 11) {
    return 'st';
  }
  if (j === 2 && k !== 12) {
    return 'nd';
  }
  if (j === 3 && k !== 13) {
    return 'rd';
  }
  return 'th';
};

/**
 * Check if a schedule is currently active (should be running now)
 */
export const isScheduleActive = (schedule: ScheduleConfig): boolean => {
  if (!schedule.active) {
    return false;
  }

  const validation = validateSchedule(schedule);
  if (!validation.isValid) {
    return false;
  }

  const nextRun = calculateNextRunTime(schedule);
  return !nextRun.isExpired && nextRun.date !== null;
};

/**
 * Get all schedules that should run within a time window
 * This would be used by a backend scheduler to find jobs to execute
 */
export const getSchedulesToRun = (
  schedules: ScheduleConfig[],
  windowStart: Date,
  windowEnd: Date
): ScheduleConfig[] => {
  return schedules.filter(schedule => {
    if (!isScheduleActive(schedule)) {
      return false;
    }

    const nextRun = calculateNextRunTime(schedule);
    if (!nextRun.date) {
      return false;
    }

    return nextRun.date > windowStart && nextRun.date < windowEnd;
  });
};

/**
 * Create a cron expression from a schedule (for backend integration)
 * Note: This is a simplified version - a real implementation would need more sophistication
 */
export const toCronExpression = (schedule: ScheduleConfig): string | null => {
  if (!schedule.active || !schedule.startTime) {
    return null;
  }

  const [hours, minutes] = schedule.startTime.split(':').map(Number);
  
  switch (schedule.type) {
    case 'once':
      // Cron doesn't support one-time runs, would need special handling
      return null;
      
    case 'daily':
      return `${minutes} ${hours} * * *`;
      
    case 'weekly':
      if (schedule.dayOfWeek !== undefined) {
        return `${minutes} ${hours} * * ${schedule.dayOfWeek}`;
      }
      return null;
      
    case 'monthly':
      if (schedule.dayOfMonth !== undefined) {
        return `${minutes} ${hours} ${schedule.dayOfMonth} * *`;
      }
      return null;
      
    default:
      return null;
  }
};

/**
 * Parse a cron expression back to a schedule (for backend integration)
 */
export const fromCronExpression = (cron: string): Partial<ScheduleConfig> | null => {
  const parts = cron.split(' ');
  if (parts.length !== 5) {
    return null;
  }

  const [minutes, hours, dayOfMonth, , dayOfWeek] = parts;
  
  // Daily schedule
  if (dayOfMonth === '*' && dayOfWeek === '*') {
    return {
      type: 'daily' as ScheduleType,
      startTime: `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`,
      active: true
    };
  }
  
  // Weekly schedule
  if (dayOfMonth === '*' && dayOfWeek !== '*') {
    return {
      type: 'weekly' as ScheduleType,
      startTime: `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`,
      dayOfWeek: parseInt(dayOfWeek),
      active: true
    };
  }
  
  // Monthly schedule
  if (dayOfMonth !== '*' && dayOfWeek === '*') {
    return {
      type: 'monthly' as ScheduleType,
      startTime: `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`,
      dayOfMonth: parseInt(dayOfMonth),
      active: true
    };
  }
  
  return null;
};