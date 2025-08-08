# Bug Tracker

## Active Bugs

### 1. Field Name Attribute is None 🟡
- **Status**: Open
- **Priority**: MEDIUM
- **Location**: Field model/database
- **Issue**: All fields have `name` attribute as `None`
- **Impact**: Frontend may expect field names but only UUIDs are available
- **Workaround**: Use `display_name` or field UUID

## Fixed Bugs

### 1. Report Creator Role Access Issue (FIXED - v0.48.0)
- **Status**: Resolved
- **Issue**: Report Creator user couldn't access fields requiring "Report Creator" role
- **Root Cause**: `_get_user_access_info` only checked direct user-role assignments, not group-based roles
- **Fix**: Implemented centralized RBACService that checks both direct and group-based role assignments
- **Test Results**: Report Creator can now access NAV and YTD fields correctly

### 2. Report Viewer Incorrect Access (FIXED - v0.48.0)
- **Status**: Resolved
- **Issue**: Report Viewer had access to role-restricted fields
- **Root Cause**: Initial implementation error in permission checking logic
- **Fix**: Properly implemented field access conditions with AND logic for permissions
- **Test Results**: Report Viewer now correctly restricted to unrestricted fields only

### 3. Group-Role-Permission Chain Resolution (FIXED - v0.48.0)
- **Status**: Resolved
- **Issue**: User → Group → Role → Permissions chain wasn't resolving correctly
- **Root Cause**: Code only checked `user_roles` table, not `group_roles` relationship
- **Fix**: RBACService now properly loads and processes both direct and group-based roles
- **Test Results**: All users get correct roles and permissions through their groups

### 4. Report Builder Route Missing (CLARIFIED - v0.48.0)
- **Status**: Not a bug - documentation issue
- **Issue**: /reports/builder and /builder routes return 404
- **Clarification**: Correct routes are `/reports/new` (create) and `/reports/:id/edit` (edit)
- **Resolution**: Documentation updated with correct routes

### 5. Missing Permissions in /auth/me (FIXED - v0.48.0)
- **Status**: Resolved
- **Issue**: `/auth/me` endpoint didn't return permissions from direct role assignments
- **Root Cause**: Bug in endpoint logic - only collected permissions from group-based roles
- **Fix**: RBACService.get_user_full_info() correctly processes all permission sources
- **Test Results**: Endpoint now returns complete user info with all roles and permissions

### 6. QueryBuilder V2 Execution Error (FIXED - v0.44.0)
- **Status**: Resolved
- **Issue**: QueryBuilder tried to access `.value` on string fields
- **Root Causes**: 
  - `default_aggregation` field was a string but code expected enum with `.value` attribute
  - `join_type` field was a string but code tried to access `.value`
  - Query executor wrapped SQLAlchemy Select objects in `text()` incorrectly
- **Fix**: 
  - Added type checking for both enum and string types in aggregation handling
  - Changed `rel.join_type.value` to `rel.join_type.lower()`
  - Removed `text()` wrapper from Select object execution
- **Test Results**: Multi-table JOINs now working successfully

### 2. PostgreSQL JSON Comparison Error (FIXED - v0.47.0)
- **Status**: Resolved
- **Issue**: `operator does not exist: json = json` when comparing JSON fields
- **Fix**: 
  - Cast JSON fields to JSONB for better operator support
  - Used proper PostgreSQL functions (jsonb_array_length, @> operator)
  - Implemented superset check for ALL permissions logic
- **Test Results**: No more JSON comparison errors

### 3. API Route Duplication (FIXED - v0.43.0)
- **Status**: Resolved
- **Issue**: Routes were doubled (e.g., `/api/v1/fields/fields/`)
- **Fix**: Removed duplicate prefix from router definitions

### 4. CORS Wildcard Security Issue (FIXED - v0.43.0)
- **Status**: Resolved
- **Issue**: CORS allowed `localhost:*` and `127.0.0.1:*` wildcards
- **Fix**: Restricted to explicit origins only in `/app/main.py`

### 5. Export Dialog Not Opening (FIXED - v0.27.0)
- **Status**: Resolved
- **Issue**: Conflicting ExportDialog components
- **Fix**: Removed duplicate component, fixed Redux integration

### 6. JWT Signature Verification (FIXED - v0.31.0)
- **Status**: Resolved
- **Issue**: JWT tokens not being verified properly
- **Fix**: Removed `verify_signature=False` from all JWT decode calls

### 7. Path Traversal in Exports (FIXED - v0.41.0)
- **Status**: Resolved
- **Issue**: Export downloads vulnerable to path traversal
- **Fix**: Store only filenames in DB, validate paths within EXPORT_DIR

## Testing Commands

```bash
# Test RBAC implementation
python3 /tmp/test_secure_rbac_fixed.py

# Check user-role assignments
docker exec -it boe-postgres psql -U boe_user -d boe_db -c "
SELECT u.email, g.name as group_name, r.name as role_name 
FROM users u 
LEFT JOIN user_groups ug ON u.id = ug.user_id 
LEFT JOIN groups g ON ug.group_id = g.id 
LEFT JOIN group_roles gr ON g.id = gr.group_id 
LEFT JOIN roles r ON gr.role_id = r.id 
ORDER BY u.email;"

# Check field security settings
python3 /tmp/check_fields.py

# Test API endpoints
python3 /tmp/test_api.py
```

---
Last Updated: 2025-01-08 (v0.48.0)
Note: Phase 4 is 95% complete - all critical RBAC issues have been resolved