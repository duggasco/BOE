// Phase 5.5 Testing & Optimization - Comprehensive Scheduling Tests
// This test suite validates all Phase 5 scheduling features

const TEST_CONFIG = {
  // Test credentials
  admin: { email: 'admin@boe-system.local', password: 'admin123' },
  creator: { email: 'creator@boe-system.local', password: 'creator123' },
  viewer: { email: 'viewer@boe-system.local', password: 'viewer123' },
  
  // Base URLs
  frontend: 'http://localhost:5173',
  backend: 'http://localhost:8001',
  
  // Test timeouts
  shortTimeout: 5000,
  mediumTimeout: 15000,
  longTimeout: 30000,
  
  // Test data
  testSchedule: {
    name: 'Test Daily Report',
    description: 'Automated test schedule',
    cron: '0 9 * * *',
    timezone: 'America/New_York',
    emailRecipients: ['test@example.com', 'test2@example.com'],
    distributionChannels: ['local', 'email']
  }
};

// Test Suite 1: Schedule Creation Wizard
async function testScheduleCreationWizard() {
  console.log('\n🧪 Testing Schedule Creation Wizard...');
  
  const tests = [
    {
      name: 'Navigate to Schedules page',
      action: async () => {
        await browser.navigate(TEST_CONFIG.frontend);
        await browser.wait_for({ time: 2 });
        
        // Login as admin
        await browser.type({
          element: 'Email input field',
          ref: 'input[type="email"]',
          text: TEST_CONFIG.admin.email
        });
        
        await browser.type({
          element: 'Password input field',
          ref: 'input[type="password"]',
          text: TEST_CONFIG.admin.password
        });
        
        await browser.click({
          element: 'Login button',
          ref: 'button[type="submit"]'
        });
        
        await browser.wait_for({ time: 3 });
        
        // Navigate to Schedules
        await browser.click({
          element: 'Schedules menu item',
          ref: 'a[href="/schedules"]'
        });
        
        await browser.wait_for({ time: 2 });
        return true;
      }
    },
    {
      name: 'Open Schedule Creation Wizard',
      action: async () => {
        await browser.click({
          element: 'Create Schedule button',
          ref: 'button:has-text("Create Schedule")'
        });
        await browser.wait_for({ time: 1 });
        
        // Check if wizard opened
        const snapshot = await browser.snapshot();
        return snapshot.includes('Schedule Creation Wizard') || 
               snapshot.includes('Create New Schedule');
      }
    },
    {
      name: 'Step 1: Select Report',
      action: async () => {
        // Select first available report
        await browser.click({
          element: 'First report in list',
          ref: '.ant-select-selector'
        });
        await browser.wait_for({ time: 1 });
        
        await browser.click({
          element: 'First report option',
          ref: '.ant-select-item-option:first-child'
        });
        
        // Click Next
        await browser.click({
          element: 'Next button',
          ref: 'button:has-text("Next")'
        });
        await browser.wait_for({ time: 1 });
        return true;
      }
    },
    {
      name: 'Step 2: Configure Schedule',
      action: async () => {
        // Enter schedule name
        await browser.type({
          element: 'Schedule name input',
          ref: 'input[placeholder*="schedule name"]',
          text: TEST_CONFIG.testSchedule.name
        });
        
        // Enter description
        await browser.type({
          element: 'Description textarea',
          ref: 'textarea[placeholder*="description"]',
          text: TEST_CONFIG.testSchedule.description
        });
        
        // Select frequency
        await browser.click({
          element: 'Frequency selector',
          ref: 'button:has-text("Daily")'
        });
        
        // Set timezone
        await browser.click({
          element: 'Timezone selector',
          ref: '.ant-select-selector:has-text("timezone")'
        });
        await browser.type({
          element: 'Timezone search',
          ref: '.ant-select-dropdown input',
          text: 'New York'
        });
        await browser.click({
          element: 'New York timezone option',
          ref: '.ant-select-item-option:has-text("New York")'
        });
        
        // Click Next
        await browser.click({
          element: 'Next button',
          ref: 'button:has-text("Next")'
        });
        await browser.wait_for({ time: 1 });
        return true;
      }
    },
    {
      name: 'Step 3: Configure Distribution',
      action: async () => {
        // Enable local storage
        await browser.click({
          element: 'Local storage checkbox',
          ref: 'input[type="checkbox"][value="local"]'
        });
        
        // Enable email distribution
        await browser.click({
          element: 'Email distribution checkbox',
          ref: 'input[type="checkbox"][value="email"]'
        });
        
        // Click Next
        await browser.click({
          element: 'Next button',
          ref: 'button:has-text("Next")'
        });
        await browser.wait_for({ time: 1 });
        return true;
      }
    },
    {
      name: 'Step 4: Email Configuration',
      action: async () => {
        // Add email recipients
        for (const email of TEST_CONFIG.testSchedule.emailRecipients) {
          await browser.type({
            element: 'Email recipient input',
            ref: 'input[placeholder*="email"]',
            text: email
          });
          await browser.press_key({ key: 'Enter' });
          await browser.wait_for({ time: 0.5 });
        }
        
        // Test SMTP connection
        await browser.click({
          element: 'Test Connection button',
          ref: 'button:has-text("Test Connection")'
        });
        await browser.wait_for({ time: 3 });
        
        // Click Next
        await browser.click({
          element: 'Next button',
          ref: 'button:has-text("Next")'
        });
        await browser.wait_for({ time: 1 });
        return true;
      }
    },
    {
      name: 'Step 5: Review and Create',
      action: async () => {
        // Review the configuration
        const snapshot = await browser.snapshot();
        const hasReview = snapshot.includes('Review') || 
                         snapshot.includes('Summary');
        
        if (!hasReview) {
          throw new Error('Review step not showing configuration');
        }
        
        // Create the schedule
        await browser.click({
          element: 'Create button',
          ref: 'button:has-text("Create")'
        });
        await browser.wait_for({ time: 3 });
        
        // Check for success message
        const finalSnapshot = await browser.snapshot();
        return finalSnapshot.includes('success') || 
               finalSnapshot.includes('created');
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`  Testing: ${test.name}...`);
      const result = await test.action();
      if (result) {
        console.log(`  ✅ ${test.name} - PASSED`);
        passed++;
      } else {
        console.log(`  ❌ ${test.name} - FAILED`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ${test.name} - ERROR: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Wizard Test Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Test Suite 2: Schedule Management Operations
async function testScheduleManagement() {
  console.log('\n🧪 Testing Schedule Management Operations...');
  
  const tests = [
    {
      name: 'View Schedule List',
      action: async () => {
        await browser.navigate(`${TEST_CONFIG.frontend}/schedules`);
        await browser.wait_for({ time: 2 });
        
        const snapshot = await browser.snapshot();
        return snapshot.includes('Schedule') || 
               snapshot.includes('schedule');
      }
    },
    {
      name: 'Search for Schedule',
      action: async () => {
        await browser.type({
          element: 'Search input',
          ref: 'input[placeholder*="Search"]',
          text: 'Test Daily'
        });
        await browser.wait_for({ time: 1 });
        
        const snapshot = await browser.snapshot();
        return snapshot.includes('Test Daily');
      }
    },
    {
      name: 'Pause Schedule',
      action: async () => {
        // Find pause button for our test schedule
        await browser.click({
          element: 'Pause button',
          ref: 'button[title="Pause"]'
        });
        await browser.wait_for({ time: 2 });
        
        const snapshot = await browser.snapshot();
        return snapshot.includes('paused') || 
               snapshot.includes('Paused');
      }
    },
    {
      name: 'Resume Schedule',
      action: async () => {
        // Find resume button
        await browser.click({
          element: 'Resume button',
          ref: 'button[title="Resume"]'
        });
        await browser.wait_for({ time: 2 });
        
        const snapshot = await browser.snapshot();
        return snapshot.includes('active') || 
               snapshot.includes('Active');
      }
    },
    {
      name: 'Test Run Schedule',
      action: async () => {
        // Click test run button
        await browser.click({
          element: 'Test Run button',
          ref: 'button[title="Test Run"]'
        });
        await browser.wait_for({ time: 3 });
        
        // Check for execution
        const snapshot = await browser.snapshot();
        return snapshot.includes('running') || 
               snapshot.includes('executing') ||
               snapshot.includes('success');
      }
    },
    {
      name: 'View Execution History',
      action: async () => {
        // Click history button
        await browser.click({
          element: 'History button',
          ref: 'button[title="History"]'
        });
        await browser.wait_for({ time: 2 });
        
        const snapshot = await browser.snapshot();
        return snapshot.includes('Execution') || 
               snapshot.includes('History');
      }
    },
    {
      name: 'Edit Schedule',
      action: async () => {
        // Close history modal if open
        await browser.press_key({ key: 'Escape' });
        await browser.wait_for({ time: 1 });
        
        // Click edit button
        await browser.click({
          element: 'Edit button',
          ref: 'button[title="Edit"]'
        });
        await browser.wait_for({ time: 2 });
        
        // Update description
        await browser.type({
          element: 'Description field',
          ref: 'textarea',
          text: ' - Updated'
        });
        
        // Save changes
        await browser.click({
          element: 'Save button',
          ref: 'button:has-text("Save")'
        });
        await browser.wait_for({ time: 2 });
        
        const snapshot = await browser.snapshot();
        return snapshot.includes('Updated') || 
               snapshot.includes('saved');
      }
    },
    {
      name: 'Delete Schedule',
      action: async () => {
        // Click delete button
        await browser.click({
          element: 'Delete button',
          ref: 'button[title="Delete"]'
        });
        await browser.wait_for({ time: 1 });
        
        // Confirm deletion
        await browser.click({
          element: 'Confirm delete button',
          ref: '.ant-modal button:has-text("OK")'
        });
        await browser.wait_for({ time: 2 });
        
        const snapshot = await browser.snapshot();
        return !snapshot.includes('Test Daily Report');
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`  Testing: ${test.name}...`);
      const result = await test.action();
      if (result) {
        console.log(`  ✅ ${test.name} - PASSED`);
        passed++;
      } else {
        console.log(`  ❌ ${test.name} - FAILED`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ${test.name} - ERROR: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Management Test Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Test Suite 3: Email Configuration
async function testEmailConfiguration() {
  console.log('\n🧪 Testing Email Configuration...');
  
  const tests = [
    {
      name: 'Test SMTP Connection',
      action: async () => {
        // Navigate to email config
        await browser.navigate(`${TEST_CONFIG.frontend}/schedules/email-config`);
        await browser.wait_for({ time: 2 });
        
        // Click test connection
        await browser.click({
          element: 'Test SMTP button',
          ref: 'button:has-text("Test Connection")'
        });
        await browser.wait_for({ time: 5 });
        
        const snapshot = await browser.snapshot();
        return snapshot.includes('success') || 
               snapshot.includes('connected');
      }
    },
    {
      name: 'Send Test Email',
      action: async () => {
        // Enter test recipient
        await browser.type({
          element: 'Test email input',
          ref: 'input[type="email"]',
          text: 'test@example.com'
        });
        
        // Send test email
        await browser.click({
          element: 'Send Test Email button',
          ref: 'button:has-text("Send Test")'
        });
        await browser.wait_for({ time: 5 });
        
        const snapshot = await browser.snapshot();
        return snapshot.includes('sent') || 
               snapshot.includes('success');
      }
    },
    {
      name: 'Validate Email Recipients',
      action: async () => {
        // Test invalid email
        await browser.type({
          element: 'Email input',
          ref: 'input[placeholder*="recipient"]',
          text: 'invalid-email'
        });
        await browser.press_key({ key: 'Enter' });
        
        const snapshot = await browser.snapshot();
        return snapshot.includes('invalid') || 
               snapshot.includes('error');
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`  Testing: ${test.name}...`);
      const result = await test.action();
      if (result) {
        console.log(`  ✅ ${test.name} - PASSED`);
        passed++;
      } else {
        console.log(`  ❌ ${test.name} - FAILED`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ${test.name} - ERROR: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Email Test Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Test Suite 4: Schedule Monitoring Dashboard
async function testScheduleMonitoring() {
  console.log('\n🧪 Testing Schedule Monitoring Dashboard...');
  
  const tests = [
    {
      name: 'View Schedule Monitor',
      action: async () => {
        await browser.navigate(`${TEST_CONFIG.frontend}/monitoring`);
        await browser.wait_for({ time: 2 });
        
        const snapshot = await browser.snapshot();
        return snapshot.includes('Schedule Monitor') || 
               snapshot.includes('Active Schedules');
      }
    },
    {
      name: 'Check Success Rate Metrics',
      action: async () => {
        const snapshot = await browser.snapshot();
        return snapshot.includes('Success Rate') || 
               snapshot.includes('%');
      }
    },
    {
      name: 'View Execution Timeline',
      action: async () => {
        const snapshot = await browser.snapshot();
        return snapshot.includes('Timeline') || 
               snapshot.includes('Execution History');
      }
    },
    {
      name: 'Check System Metrics',
      action: async () => {
        const snapshot = await browser.snapshot();
        return snapshot.includes('System Metrics') || 
               snapshot.includes('Performance');
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`  Testing: ${test.name}...`);
      const result = await test.action();
      if (result) {
        console.log(`  ✅ ${test.name} - PASSED`);
        passed++;
      } else {
        console.log(`  ❌ ${test.name} - FAILED`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ${test.name} - ERROR: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Monitoring Test Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Test Suite 5: Template Management
async function testTemplateManagement() {
  console.log('\n🧪 Testing Template Management...');
  
  const tests = [
    {
      name: 'Create Distribution Template',
      action: async () => {
        await browser.navigate(`${TEST_CONFIG.frontend}/schedules/templates`);
        await browser.wait_for({ time: 2 });
        
        // Click create template
        await browser.click({
          element: 'Create Template button',
          ref: 'button:has-text("Create Template")'
        });
        await browser.wait_for({ time: 1 });
        
        // Fill template details
        await browser.type({
          element: 'Template name input',
          ref: 'input[placeholder*="name"]',
          text: 'Test Email Template'
        });
        
        await browser.type({
          element: 'Template description',
          ref: 'textarea[placeholder*="description"]',
          text: 'Template for automated testing'
        });
        
        // Save template
        await browser.click({
          element: 'Save button',
          ref: 'button:has-text("Save")'
        });
        await browser.wait_for({ time: 2 });
        
        const snapshot = await browser.snapshot();
        return snapshot.includes('Test Email Template');
      }
    },
    {
      name: 'Clone Template',
      action: async () => {
        // Find clone button
        await browser.click({
          element: 'Clone button',
          ref: 'button[title="Clone"]'
        });
        await browser.wait_for({ time: 2 });
        
        const snapshot = await browser.snapshot();
        return snapshot.includes('Copy of') || 
               snapshot.includes('cloned');
      }
    },
    {
      name: 'Delete Template',
      action: async () => {
        // Find delete button
        await browser.click({
          element: 'Delete button',
          ref: 'button[title="Delete"]'
        });
        await browser.wait_for({ time: 1 });
        
        // Confirm deletion
        await browser.click({
          element: 'Confirm button',
          ref: '.ant-modal button:has-text("OK")'
        });
        await browser.wait_for({ time: 2 });
        
        const snapshot = await browser.snapshot();
        return !snapshot.includes('Copy of Test Email Template');
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`  Testing: ${test.name}...`);
      const result = await test.action();
      if (result) {
        console.log(`  ✅ ${test.name} - PASSED`);
        passed++;
      } else {
        console.log(`  ❌ ${test.name} - FAILED`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ${test.name} - ERROR: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Template Test Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Performance Test: Create Multiple Schedules
async function testPerformanceLoadSchedules() {
  console.log('\n🧪 Testing Performance with Multiple Schedules...');
  
  const scheduleCount = 10; // Start with 10, can increase to 1000
  const startTime = Date.now();
  let created = 0;
  let failed = 0;
  
  console.log(`  Creating ${scheduleCount} test schedules...`);
  
  for (let i = 1; i <= scheduleCount; i++) {
    try {
      // Use backend API directly for performance testing
      const response = await fetch(`${TEST_CONFIG.backend}/api/v1/schedules/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          report_id: 'test-report-id',
          name: `Performance Test Schedule ${i}`,
          description: `Auto-generated schedule for load testing #${i}`,
          schedule_config: {
            frequency: 'daily',
            cron_expression: '0 */6 * * *',
            timezone: 'UTC'
          },
          distribution_config: {
            local: {
              base_path: '/exports/scheduled',
              create_subdirs: true
            }
          },
          export_config: {
            format: 'csv',
            include_headers: true
          },
          is_active: i % 2 === 0 // Half active, half inactive
        })
      });
      
      if (response.ok) {
        created++;
        if (created % 10 === 0) {
          console.log(`    Created ${created}/${scheduleCount} schedules...`);
        }
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
    }
  }
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  console.log(`\n📊 Performance Test Results:`);
  console.log(`  - Schedules created: ${created}/${scheduleCount}`);
  console.log(`  - Failed: ${failed}`);
  console.log(`  - Time taken: ${duration.toFixed(2)} seconds`);
  console.log(`  - Average time per schedule: ${(duration / scheduleCount).toFixed(3)} seconds`);
  
  // Test query performance
  console.log('\n  Testing query performance...');
  const queryStart = Date.now();
  
  await browser.navigate(`${TEST_CONFIG.frontend}/schedules`);
  await browser.wait_for({ time: 3 });
  
  const queryEnd = Date.now();
  const queryTime = (queryEnd - queryStart) / 1000;
  
  console.log(`  - Schedule list load time: ${queryTime.toFixed(2)} seconds`);
  
  return {
    created,
    failed,
    duration,
    queryTime
  };
}

// Main test runner
async function runAllTests() {
  console.log('========================================');
  console.log('PHASE 5.5: COMPREHENSIVE SCHEDULING TESTS');
  console.log('========================================');
  console.log(`Starting at: ${new Date().toISOString()}`);
  
  const results = {
    wizard: { passed: 0, failed: 0 },
    management: { passed: 0, failed: 0 },
    email: { passed: 0, failed: 0 },
    monitoring: { passed: 0, failed: 0 },
    templates: { passed: 0, failed: 0 },
    performance: null
  };
  
  try {
    // Start frontend if needed
    console.log('\n📦 Checking frontend status...');
    const frontendCheck = await fetch(TEST_CONFIG.frontend).catch(() => null);
    if (!frontendCheck) {
      console.log('Frontend not running. Please start it with: npm run dev');
      return;
    }
    
    // Run test suites
    results.wizard = await testScheduleCreationWizard();
    results.management = await testScheduleManagement();
    results.email = await testEmailConfiguration();
    results.monitoring = await testScheduleMonitoring();
    results.templates = await testTemplateManagement();
    results.performance = await testPerformanceLoadSchedules();
    
    // Calculate totals
    const totalPassed = Object.values(results)
      .filter(r => r && r.passed)
      .reduce((sum, r) => sum + r.passed, 0);
    
    const totalFailed = Object.values(results)
      .filter(r => r && r.failed)
      .reduce((sum, r) => sum + r.failed, 0);
    
    // Print summary
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log(`✅ Total Passed: ${totalPassed}`);
    console.log(`❌ Total Failed: ${totalFailed}`);
    console.log(`📊 Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
    
    if (results.performance) {
      console.log(`\n⚡ Performance Metrics:`);
      console.log(`  - Schedules created: ${results.performance.created}`);
      console.log(`  - Creation time: ${results.performance.duration.toFixed(2)}s`);
      console.log(`  - Query time: ${results.performance.queryTime.toFixed(2)}s`);
    }
    
    console.log('\n✨ Testing completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testScheduleCreationWizard,
    testScheduleManagement,
    testEmailConfiguration,
    testScheduleMonitoring,
    testTemplateManagement,
    testPerformanceLoadSchedules,
    TEST_CONFIG
  };
}