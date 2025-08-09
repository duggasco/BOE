# Phase 5: Scheduling & Distribution Requirements

## Overview
Phase 5 focuses on automated report scheduling and distribution, allowing users to set up recurring reports that are automatically generated and delivered to stakeholders.

## Core Features

### 1. Report Scheduling Engine
- **Cron-based scheduling**: Support standard cron expressions
- **Frequency options**: 
  - Immediate (one-time)
  - Daily (with time selection)
  - Weekly (with day/time selection)
  - Monthly (with date/time selection)
  - Custom cron expression
- **Timezone support**: User-specific timezones
- **Schedule management**: Create, update, pause, resume, delete schedules
- **Conflict detection**: Warn about overlapping schedules

### 2. Distribution Channels

#### Email Distribution
- Multiple recipients (To, CC, BCC)
- Custom subject with variables (e.g., {date}, {report_name})
- HTML email body with report summary
- Attachment options (inline vs. attachment)
- Size limits and compression

#### SFTP/FTP Distribution
- Secure connection management
- Path configuration with variables
- Overwrite vs. timestamp naming
- Connection testing before scheduling

#### Cloud Storage Distribution
- S3/Azure Blob/Google Cloud Storage support
- Bucket/container selection
- Path templating
- IAM role integration

#### Webhook Distribution
- POST to custom endpoints
- Authentication (Bearer, Basic, API Key)
- Retry logic with exponential backoff
- Response validation

### 3. Schedule Management Interface

#### Schedule List View
- Active/paused/failed schedules
- Last run time and status
- Next scheduled run
- Quick actions (pause, resume, delete)

#### Schedule Creation Wizard
- Step 1: Select report
- Step 2: Configure schedule frequency
- Step 3: Set filters/parameters
- Step 4: Choose distribution method(s)
- Step 5: Review and activate

#### Schedule History
- Execution log with timestamps
- Success/failure status
- Error messages and retry attempts
- Downloaded/sent confirmations

### 4. Technical Architecture

#### Job Scheduler (Celery Beat)
```python
from celery.schedules import crontab

CELERYBEAT_SCHEDULE = {
    'process-scheduled-exports': {
        'task': 'app.tasks.process_scheduled_exports',
        'schedule': crontab(minute='*/5'),  # Check every 5 minutes
    },
}
```

#### Database Schema
```sql
CREATE TABLE export_schedules (
    id UUID PRIMARY KEY,
    report_id UUID REFERENCES reports(id),
    user_id UUID REFERENCES users(id),
    schedule_config JSONB,  -- Cron expression, timezone
    distribution_config JSONB,  -- Channel settings
    filter_config JSONB,  -- Report parameters
    is_active BOOLEAN DEFAULT true,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE schedule_executions (
    id UUID PRIMARY KEY,
    schedule_id UUID REFERENCES export_schedules(id),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50),  -- pending, running, success, failed
    error_message TEXT,
    export_id UUID REFERENCES exports(id)
);
```

### 5. User Permissions

#### Role-Based Access
- **Viewer**: Cannot create schedules
- **Creator**: Can schedule own reports
- **Admin**: Can manage all schedules

#### Schedule Limits
- Max schedules per user: 10 (configurable)
- Min interval between runs: 1 hour
- Max recipients per email: 50

### 6. Monitoring & Alerts

#### Health Monitoring
- Schedule execution success rate
- Average processing time
- Queue depth monitoring
- Failed schedule alerts

#### User Notifications
- Email on schedule failure
- In-app notifications for status changes
- Weekly summary of scheduled reports

### 7. API Endpoints

```
# Schedule Management
POST   /api/v1/schedules/              # Create schedule
GET    /api/v1/schedules/              # List schedules
GET    /api/v1/schedules/{id}          # Get schedule details
PUT    /api/v1/schedules/{id}          # Update schedule
DELETE /api/v1/schedules/{id}          # Delete schedule
POST   /api/v1/schedules/{id}/pause    # Pause schedule
POST   /api/v1/schedules/{id}/resume   # Resume schedule
POST   /api/v1/schedules/{id}/test     # Test run schedule

# Execution History
GET    /api/v1/schedules/{id}/history  # Get execution history
GET    /api/v1/schedules/executions    # List all executions

# Distribution Testing
POST   /api/v1/distribution/test/email # Test email delivery
POST   /api/v1/distribution/test/sftp  # Test SFTP connection
```

### 8. Security Considerations

#### Credential Management
- Encrypted storage of SFTP/cloud credentials
- OAuth2 for cloud providers where possible
- API key rotation reminders
- Connection string validation

#### Rate Limiting
- Per-user schedule creation limits
- Distribution channel rate limits
- Prevent schedule flooding

#### Audit Trail
- All schedule changes logged
- Distribution confirmations tracked
- Failed delivery investigations

### 9. Error Handling

#### Retry Logic
```python
@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3, 'countdown': 300}
)
def execute_scheduled_export(self, schedule_id):
    # Implementation
```

#### Failure Notifications
- Immediate alert on critical failures
- Daily summary of minor issues
- Escalation for repeated failures

### 10. Testing Requirements

#### Unit Tests
- Schedule calculation accuracy
- Distribution channel mocking
- Error handling paths

#### Integration Tests
- End-to-end schedule execution
- Multi-channel distribution
- Timezone handling

#### Load Tests
- 1000 concurrent schedules
- Peak hour execution
- Queue overflow handling

## Implementation Phases

### Phase 5.1 (Week 1-2): Core Scheduling
- Database schema setup
- Celery Beat integration
- Basic cron scheduling
- Schedule CRUD operations

### Phase 5.2 (Week 3): Email Distribution
- Email template system
- Attachment handling
- Delivery confirmation

### Phase 5.3 (DEPRIORITIZED TO DAY 2): Cloud Distribution
- **DAY 2** - S3 integration
- **DAY 2** - SFTP support  
- **DAY 2** - Webhook implementation
- **DAY 2** - Azure/GCS integration
- **DAY 2** - External cloud connectivity

### Phase 5.4 (Week 4 - PRIORITY): UI & Management
- Schedule creation wizard
- Email configuration interface
- History and monitoring views
- Error handling and retries
- Distribution channel selection

### Phase 5.5 (Week 5 - PRIORITY): Testing & Optimization
- Load testing with 1000+ schedules
- Performance optimization
- End-to-end testing
- Production deployment guide
- Documentation updates

## Success Metrics

- **Schedule Reliability**: 99.9% successful execution rate
- **Delivery Speed**: 95% delivered within 5 minutes of schedule
- **User Adoption**: 50% of active users create at least one schedule
- **Error Recovery**: 90% of failures auto-recover on retry

## Dependencies

- Celery + Celery Beat for scheduling
- Redis for job queue
- boto3 for AWS S3
- paramiko for SFTP
- sendgrid/ses for email delivery

## Open Questions

1. Should we support RSS/Atom feed generation for public reports?
2. Do we need Microsoft Teams/Slack integration for notifications?
3. Should schedules support conditional execution (e.g., only if data changed)?
4. How long should we retain execution history?
5. Should we implement schedule templates for common patterns?

## Risk Assessment

- **High Risk**: Celery Beat single point of failure
  - Mitigation: Redis Sentinel for HA
  
- **Medium Risk**: Email deliverability issues
  - Mitigation: Multiple SMTP providers
  
- **Low Risk**: Timezone calculation errors
  - Mitigation: Use pytz library, extensive testing

## Estimated Timeline

Total Duration: 6 weeks
- Core implementation: 4 weeks
- Testing & refinement: 1 week
- Documentation & deployment: 1 week

## Budget Considerations

- Additional infrastructure: Redis cluster, worker nodes
- Third-party services: Email provider, cloud storage
- Monitoring: DataDog/New Relic integration
- Estimated monthly cost: $500-1000 depending on volume