# Bug Tracking

## 🔴 Critical Issues
*None currently*

## 🟡 Known Issues

### UI/UX Issues

#### Issue #001: Properties Panel Not Connected
- **Status**: Resolved (v0.13.0)
- **Priority**: Medium
- **Description**: Properties panel displays section info but doesn't update state
- **Impact**: Users cannot modify section properties after creation
- **Resolution**: Connected all form controls to Redux updateSection action with proper debouncing for text inputs
- **Date**: 2025-08-07

#### Issue #002: No Field Removal
- **Status**: Resolved (v0.14.0)
- **Priority**: Medium
- **Description**: Once a field is added to a section, it cannot be removed
- **Resolution**: Field tags now have X buttons that properly remove fields from sections
- **Date**: 2025-08-07


### Data Issues

#### Issue #004: Query Execution on Every Drop
- **Status**: Open
- **Priority**: Low
- **Description**: Query executes immediately when field is dropped
- **Impact**: Unnecessary API calls
- **Workaround**: None - acceptable for MVP
- **Fix**: Implement debouncing or manual refresh button

#### Issue #005: Cache Never Clears
- **Status**: Open (Identified by Gemini)
- **Priority**: Low
- **Description**: Query cache grows indefinitely
- **Impact**: Potential memory leak in long sessions
- **Workaround**: Refresh page periodically
- **Fix**: Implement cache TTL and cleanup

### Layout Issues

#### Issue #006: Can't Drop Between Sections
- **Status**: Open
- **Priority**: Low
- **Description**: New sections can only be created on empty canvas
- **Impact**: Limited layout flexibility
- **Workaround**: Use "Add Section" button
- **Fix**: Add drop zones between existing sections

### Visual Interface (VI) Issues

#### Issue #008: Sidebar Layout Issues
- **Status**: Open
- **Priority**: High
- **Description**: The sidebar navigation has significant layout problems with insufficient width, cramped navigation items, misaligned icons/text, and improper active state indicators
- **Impact**: Poor user experience across all pages, difficult navigation
- **Root Cause**: Fixed width constraints, insufficient padding/margin values, flexbox alignment issues
- **Workaround**: None - affects core navigation
- **Fix**: Implement responsive sidebar sizing, adjust padding/margins, fix flexbox alignment

#### Issue #009: Table Layout Problems
- **Status**: Open
- **Priority**: Medium
- **Description**: Reports table extends beyond viewport on smaller screens, action buttons misaligned, no horizontal scrolling for mobile
- **Impact**: Table data not accessible on mobile devices
- **Root Cause**: Missing responsive table wrapper, fixed table widths, lack of overflow handling
- **Workaround**: None - critical for mobile users
- **Fix**: Add responsive table wrapper, implement flexible sizing, add overflow-x: auto

#### Issue #010: Tab Component Overflow
- **Status**: Open
- **Priority**: Medium
- **Description**: Admin page tabs are cut off with ellipsis button showing when tabs should fit
- **Impact**: Tab labels truncated, poor use of horizontal space
- **Root Cause**: Incorrect space calculation, fixed tab widths
- **Workaround**: Click ellipsis to see hidden tabs
- **Fix**: Recalculate available space, implement responsive tab widths

#### Issue #011: Mobile Responsive Issues
- **Status**: Open
- **Priority**: High
- **Description**: Multiple responsive problems at 375px width - sidebar too wide, compressed content, non-scrollable tables
- **Impact**: Unusable on mobile devices
- **Root Cause**: Fixed sidebar width, missing media queries, lack of mobile-first design
- **Workaround**: Use desktop view
- **Fix**: Implement collapsible sidebar for mobile, add media queries, adopt mobile-first approach

#### Issue #012: Empty State Presentation
- **Status**: Open
- **Priority**: Low
- **Description**: Empty states lack proper styling - small text, no centering, missing illustrations
- **Impact**: Poor user experience when no data present
- **Root Cause**: Missing empty state component design
- **Workaround**: None - cosmetic issue
- **Fix**: Create proper empty state components with icons/illustrations

#### Issue #013: Color Contrast Issues
- **Status**: Open
- **Priority**: Medium
- **Description**: Dark navy sidebar with gray text may not meet WCAG standards, faint pagination buttons
- **Impact**: Accessibility issues for users with visual impairments
- **Root Cause**: Color palette not optimized for accessibility
- **Workaround**: None - accessibility requirement
- **Fix**: Update color scheme to meet WCAG AA standards

#### Issue #014: React Router Console Warnings
- **Status**: Open
- **Priority**: Low
- **Description**: Future flag warnings about state updates and relative route resolution in console
- **Impact**: Console noise, potential future compatibility issues
- **Root Cause**: Outdated React Router configuration
- **Workaround**: Ignore warnings - no functional impact
- **Fix**: Update to newer React Router patterns

## 🟢 Resolved Issues

### Issue #001: Properties Panel Not Connected
- **Status**: Resolved (v0.13.0)
- **Priority**: Medium
- **Description**: Properties panel displays section info but doesn't update state
- **Resolution**: Connected all form controls to Redux updateSection action with proper debouncing
- **Date**: 2025-08-07

### Issue #016: Properties Panel Not Fully Connected  
- **Status**: Resolved (v0.13.0)
- **Priority**: Medium
- **Description**: Properties panel shows section type but doesn't allow editing most properties
- **Resolution**: Fully wired Properties Panel with Redux, supports all section types
- **Date**: 2025-08-07

### Issue #003: AG-Grid CSS Not Imported
- **Status**: Resolved (v0.6.0)
- **Priority**: High
- **Description**: AG-Grid styles not loaded, causing unstyled components
- **Resolution**: Added AG-Grid CSS imports to main.tsx and updated ReportCanvas to use AgGridReact component
- **Date**: 2025-08-06

### Issue #007: setTimeout Race Condition
- **Status**: Resolved (v0.2.0)
- **Resolution**: Replaced with createSectionWithField thunk
- **Date**: 2025-08-06

#### Issue #015: Limited Multi-Field Table Support
- **Status**: Open
- **Priority**: High
- **Description**: While tables support multiple fields technically, the UX is poor - no visual indicators of current fields, no remove buttons
- **Impact**: Users can't easily see what fields are in a table or remove them
- **Root Cause**: UI components not implemented for field management
- **Workaround**: Use undo or recreate section
- **Fix**: Add field chips/badges with remove buttons, show current fields in section header

#### Issue #016: Properties Panel Not Fully Connected
- **Status**: Resolved (v0.13.0)
- **Priority**: Medium
- **Description**: Properties panel shows section type but doesn't allow editing most properties
- **Resolution**: Fully wired Properties Panel with Redux, supports all section types (table, chart, text, container)
- **Date**: 2025-08-07

#### Issue #017: No Field Type Indicators
- **Status**: Open
- **Priority**: Low
- **Description**: No visual distinction between dimensions and measures in the field tree
- **Impact**: Users may not know which fields are dimensions vs measures
- **Root Cause**: Missing UI indicators in field selector
- **Workaround**: Check field properties or trial and error
- **Fix**: Add icons or badges to indicate field types

## 📊 Issue Statistics

- **Total Issues**: 17
- **Open**: 12
- **Resolved**: 5
- **Critical**: 0
- **High Priority**: 4
- **Medium Priority**: 6
- **Low Priority**: 5

## 🔄 Testing Checklist

Before marking an issue as resolved, ensure:
- [ ] Issue cannot be reproduced
- [ ] Fix doesn't introduce new bugs
- [ ] Related functionality still works
- [ ] Update CHANGELOG.md
- [ ] Remove from TODO.md if applicable

---

**Last Updated**: 2025-08-06  
**Next Review**: End of Phase 1