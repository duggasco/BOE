# Email Distribution Setup Guide

## Overview
Phase 5.2 Email Distribution enables automated sending of scheduled reports via email with support for attachments, download links, and comprehensive delivery tracking.

## Configuration

### 1. Environment Variables
Add the following to your `.env` file:

```bash
# SMTP Configuration
MAIL_USERNAME=your_smtp_username@example.com
MAIL_PASSWORD=your_smtp_password
MAIL_FROM=noreply@your-domain.com
MAIL_FROM_NAME="BOE System"
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com  # or your SMTP provider
MAIL_STARTTLS=true
MAIL_SSL_TLS=false
MAIL_USE_CREDENTIALS=true
MAIL_VALIDATE_CERTS=true

# Rate Limiting
MAIL_MAX_PER_HOUR_GLOBAL=1000  # Global rate limit
MAIL_MAX_PER_HOUR_USER=50      # Per-user rate limit
MAIL_MAX_RECIPIENTS=50         # Max recipients per email
MAIL_MAX_ATTACHMENT_SIZE=10485760  # 10MB in bytes

# Retry Settings
MAIL_MAX_RETRIES=5
MAIL_RETRY_BACKOFF_BASE=10     # Base seconds for exponential backoff
```

### 2. Popular SMTP Provider Settings

#### Gmail
```bash
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_STARTTLS=true
MAIL_SSL_TLS=false
# Use App Password, not regular password
# Enable 2FA and generate app password at: https://myaccount.google.com/apppasswords
```

#### SendGrid
```bash
MAIL_SERVER=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USERNAME=apikey  # Literally "apikey"
MAIL_PASSWORD=your_sendgrid_api_key
MAIL_STARTTLS=true
```

#### AWS SES
```bash
MAIL_SERVER=email-smtp.us-east-1.amazonaws.com
MAIL_PORT=587
MAIL_USERNAME=your_ses_smtp_username
MAIL_PASSWORD=your_ses_smtp_password
MAIL_STARTTLS=true
```

#### Office 365
```bash
MAIL_SERVER=smtp.office365.com
MAIL_PORT=587
MAIL_STARTTLS=true
```

## Installation

### 1. Install Dependencies
```bash
cd /root/BOE/backend
source venv/bin/activate
pip install -r requirements.txt
```

The following packages are required:
- `fastapi-mail==1.4.1` - Email sending library
- `email-validator==2.1.0.post1` - Email validation
- `Jinja2==3.1.2` - Template engine
- `aiosmtplib==2.0.2` - Async SMTP client

### 2. Verify Redis is Running
Email rate limiting requires Redis:
```bash
docker compose up -d redis
# Or if Redis is installed locally:
redis-cli ping
```

### 3. Start Celery Workers
Email sending is handled by Celery workers:
```bash
# Start Celery worker with distribution queue
celery -A app.core.celery_app worker --loglevel=info --queues=distribution,exports
```

## Features

### 1. Smart Attachment Handling
- Files under 10MB are attached directly
- Larger files use secure download links
- Automatic file size detection and routing

### 2. Rate Limiting
- Global limit: 1000 emails/hour
- Per-user limit: 50 emails/hour
- Prevents spam and protects SMTP reputation

### 3. Email Templates
Professional HTML templates with:
- Responsive design
- Brand customization
- Variable substitution
- Download link support

### 4. Retry Logic
- Exponential backoff: 10s, 20s, 40s, 80s, 160s
- Max 5 retries per email
- Automatic failure notifications

### 5. Batch Sending
- Process multiple recipients efficiently
- Staggered sending to avoid rate limits
- CC/BCC support

## API Endpoints

### Test SMTP Connection
```bash
curl -X POST http://localhost:8001/api/v1/schedules/test/email/connection \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Send Test Email
```bash
curl -X POST "http://localhost:8001/api/v1/schedules/test/email/send?recipient=test@example.com" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Email Configuration
```bash
curl -X POST http://localhost:8001/api/v1/schedules/test/email/config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": ["user@example.com"],
    "subject": "Test Report",
    "message": "This is a test"
  }'
```

## Creating Email Schedules

### Example Schedule with Email Distribution
```json
{
  "report_id": "report-uuid",
  "name": "Daily Sales Report",
  "description": "Automated daily sales summary",
  "schedule_config": {
    "frequency": "daily",
    "timezone": "America/New_York"
  },
  "distribution_config": {
    "email": {
      "recipients": ["manager@company.com", "team@company.com"],
      "cc": ["supervisor@company.com"],
      "subject": "Daily Sales Report - {date}",
      "message": "Please find attached the daily sales report.",
      "attach_report": true
    }
  },
  "export_config": {
    "format": "excel",
    "include_headers": true
  },
  "is_active": true
}
```

## Email Template Variables

The following variables are available in email subjects and templates:

- `{report_name}` - Name of the report
- `{schedule_name}` - Name of the schedule
- `{date}` - Current date (YYYY-MM-DD)
- `{time}` - Current time (HH:MM)
- `{format}` - Export format (CSV, Excel, PDF)
- `{file_size}` - Size of the exported file

## Monitoring

### Check Email Queue
```bash
# View pending email tasks
celery -A app.core.celery_app inspect active

# View scheduled tasks
celery -A app.core.celery_app inspect scheduled

# View task results
celery -A app.core.celery_app inspect stats
```

### View Logs
```bash
# Email service logs
tail -f /var/log/boe/email.log

# Celery worker logs
tail -f /var/log/celery/worker.log
```

## Troubleshooting

### Common Issues

#### 1. SMTP Authentication Failed
- Verify username and password
- Check if 2FA is enabled (use app password)
- Ensure correct port and TLS settings

#### 2. Emails Not Sending
- Check Redis is running
- Verify Celery workers are active
- Check rate limits haven't been exceeded
- Review SMTP server logs

#### 3. Large Files Not Attaching
- Files over 10MB use download links
- Ensure export directory is accessible
- Check file permissions

#### 4. Template Rendering Errors
- Verify template files exist in `/app/templates/emails/`
- Check variable names in templates
- Review Jinja2 syntax

### Debug Mode
Enable debug logging:
```python
# In email_service.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Security Considerations

### Production Recommendations

1. **Use Environment Variables**
   - Never commit credentials to version control
   - Use secrets management system in production

2. **Enable TLS/SSL**
   - Always use encrypted connections
   - Validate certificates in production

3. **Implement SPF/DKIM/DMARC**
   - Configure DNS records for email authentication
   - Improves deliverability and prevents spoofing

4. **Monitor for Abuse**
   - Track email sending patterns
   - Alert on unusual activity
   - Implement user reporting limits

5. **Secure Download Links**
   - TODO: Implement signed URLs with expiry
   - TODO: Add access logging
   - TODO: Implement download limits

## Known Issues (from Gemini Review)

The following issues were identified during code review and should be addressed before production:

1. **SimpleRateLimiter**: Local cache fallback won't work across multiple workers
2. **Template Injection**: Need to sanitize custom_message to prevent XSS
3. **Download URLs**: Implement signed, expiring URLs for security
4. **Async/Sync Bridge**: asyncio.run() in Celery tasks is an anti-pattern
5. **Email Validation**: Should use email-validator library instead of regex

## Testing

### Manual Testing
1. Configure SMTP settings in `.env`
2. Start services (Redis, Celery, Backend)
3. Use test endpoints to verify connectivity
4. Create a test schedule with email distribution
5. Monitor logs for successful delivery

### Automated Testing
```bash
# Run email service tests
pytest tests/test_email_service.py

# Run distribution tests
pytest tests/test_distribution.py
```

## Next Steps

### Phase 5.4 - UI Integration (PRIORITY)
- Schedule creation wizard
- Email configuration UI
- Template editor
- Delivery status dashboard
- Bounce handling UI
- Distribution channel selection

### Phase 5.5 - Testing & Optimization (PRIORITY)
- Load testing with 1000+ schedules
- Performance optimization
- End-to-end testing
- Production deployment guide

### Day 2 Items (DEPRIORITIZED)
- AWS S3 integration
- Azure Blob Storage
- Google Cloud Storage
- SFTP/FTP support
- External cloud connectivity
- Webhook enhancements

## Support

For issues or questions:
- Check logs in `/var/log/boe/`
- Review this documentation
- Contact system administrator
- File issues in project repository