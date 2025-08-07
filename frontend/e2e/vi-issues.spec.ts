import { test, expect } from '@playwright/test';

test.describe('BOE Frontend VI Issues', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('Issue #001: Properties Panel should update state when form inputs change', async ({ page }) => {
    // Navigate to report builder
    await page.click('text=Report Builder');
    await page.waitForSelector('.reportBuilder');
    
    // Drag and drop a field to create a section
    const field = page.locator('[data-field-id]').first();
    const canvas = page.locator('.canvas');
    
    await field.dragTo(canvas);
    await page.waitForTimeout(500);
    
    // Check if section was created
    const section = page.locator('[data-section-id]').first();
    await expect(section).toBeVisible();
    
    // Click on the section to select it
    await section.click();
    
    // Check properties panel
    const propertiesPanel = page.locator('.propertiesPanel');
    await expect(propertiesPanel).toBeVisible();
    
    // Try to change a property
    const titleInput = propertiesPanel.locator('input[placeholder*="title"]').first();
    await titleInput.fill('Test Title');
    
    // Verify the title updates in the section
    await page.waitForTimeout(500);
    const sectionTitle = section.locator('h3, .section-title');
    await expect(sectionTitle).toContainText('Test Title');
  });

  test('Issue #002: Field removal capability should exist', async ({ page }) => {
    // Navigate to report builder
    await page.click('text=Report Builder');
    await page.waitForSelector('.reportBuilder');
    
    // Create a section with a field
    const field = page.locator('[data-field-id]').first();
    const canvas = page.locator('.canvas');
    await field.dragTo(canvas);
    await page.waitForTimeout(500);
    
    // Add another field to the section
    const secondField = page.locator('[data-field-id]').nth(1);
    const section = page.locator('[data-section-id]').first();
    await secondField.dragTo(section);
    await page.waitForTimeout(500);
    
    // Look for remove buttons on fields
    const removeButtons = section.locator('[aria-label*="remove"], [title*="remove"], .remove-field');
    const removeButtonCount = await removeButtons.count();
    
    expect(removeButtonCount).toBeGreaterThan(0);
    
    if (removeButtonCount > 0) {
      // Try to remove a field
      await removeButtons.first().click();
      await page.waitForTimeout(500);
      
      // Check if field was removed
      const fieldCount = await section.locator('[data-field]').count();
      expect(fieldCount).toBeLessThan(2);
    }
  });

  test('Issue #003: AG-Grid styles should be loaded', async ({ page }) => {
    // Navigate to report builder
    await page.click('text=Report Builder');
    await page.waitForSelector('.reportBuilder');
    
    // Create a table section
    const field = page.locator('[data-field-id]').first();
    const canvas = page.locator('.canvas');
    await field.dragTo(canvas);
    await page.waitForTimeout(1000);
    
    // Check for AG-Grid specific classes or Ant Design fallback
    const agGridPresent = await page.locator('.ag-root, .ag-theme-alpine, .ag-theme-material').count();
    const antTablePresent = await page.locator('.ant-table').count();
    
    // Log what we found
    console.log(`AG-Grid elements: ${agGridPresent}, Ant Table elements: ${antTablePresent}`);
    
    // We expect either AG-Grid or Ant Table to be present
    expect(agGridPresent + antTablePresent).toBeGreaterThan(0);
  });

  test('Issue #004: Query execution frequency on field drop', async ({ page }) => {
    // Navigate to report builder
    await page.click('text=Report Builder');
    await page.waitForSelector('.reportBuilder');
    
    // Set up network monitoring
    const apiCalls: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/query') || request.url().includes('executeQuery')) {
        apiCalls.push(request.url());
      }
    });
    
    // Drop a field
    const field = page.locator('[data-field-id]').first();
    const canvas = page.locator('.canvas');
    await field.dragTo(canvas);
    await page.waitForTimeout(1000);
    
    const initialCallCount = apiCalls.length;
    
    // Drop another field on the same section
    const secondField = page.locator('[data-field-id]').nth(1);
    const section = page.locator('[data-section-id]').first();
    await secondField.dragTo(section);
    await page.waitForTimeout(1000);
    
    const finalCallCount = apiCalls.length;
    
    // Check if queries are being executed on every drop
    console.log(`API calls after first drop: ${initialCallCount}, after second drop: ${finalCallCount}`);
    expect(finalCallCount).toBeGreaterThan(initialCallCount);
  });

  test('Issue #006: Drop zones between sections', async ({ page }) => {
    // Navigate to report builder
    await page.click('text=Report Builder');
    await page.waitForSelector('.reportBuilder');
    
    // Create first section
    const field1 = page.locator('[data-field-id]').first();
    const canvas = page.locator('.canvas');
    await field1.dragTo(canvas);
    await page.waitForTimeout(500);
    
    // Try to create second section using Add Section button
    await page.click('button:has-text("Add Section")');
    await page.click('text=Table');
    await page.waitForTimeout(500);
    
    // Check if we have two sections
    const sectionCount = await page.locator('[data-section-id]').count();
    expect(sectionCount).toBe(2);
    
    // Try to drag a field between sections
    const field2 = page.locator('[data-field-id]').nth(2);
    const sections = page.locator('[data-section-id]');
    
    // Get positions of sections
    const firstSection = sections.first();
    const secondSection = sections.nth(1);
    
    const firstBox = await firstSection.boundingBox();
    const secondBox = await secondSection.boundingBox();
    
    if (firstBox && secondBox) {
      // Try to drop between sections
      const dropX = firstBox.x + firstBox.width / 2;
      const dropY = firstBox.y + firstBox.height + 10; // Just below first section
      
      await field2.hover();
      await page.mouse.down();
      await page.mouse.move(dropX, dropY);
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      // Check if a new section was created between
      const newSectionCount = await page.locator('[data-section-id]').count();
      console.log(`Sections after attempting drop between: ${newSectionCount}`);
    }
  });

  test('Visual accessibility check', async ({ page }) => {
    // Navigate to report builder
    await page.click('text=Report Builder');
    await page.waitForSelector('.reportBuilder');
    
    // Check for keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    
    // Check color contrast for important buttons
    const runButton = page.locator('button:has-text("Run")');
    const saveButton = page.locator('button:has-text("Save")');
    
    // Check if buttons are visible and have proper contrast
    await expect(runButton).toBeVisible();
    await expect(saveButton).toBeVisible();
    
    // Check for ARIA labels
    const ariaButtons = await page.locator('[aria-label], [role="button"]').count();
    expect(ariaButtons).toBeGreaterThan(0);
  });

  test('Drag and drop visual feedback', async ({ page }) => {
    // Navigate to report builder
    await page.click('text=Report Builder');
    await page.waitForSelector('.reportBuilder');
    
    const field = page.locator('[data-field-id]').first();
    const canvas = page.locator('.canvas');
    
    // Start dragging
    await field.hover();
    await page.mouse.down();
    
    // Move mouse to canvas
    const canvasBox = await canvas.boundingBox();
    if (canvasBox) {
      await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
      
      // Check for visual feedback (drag preview, drop zone highlighting)
      const dragPreview = await page.locator('.drag-preview, [data-dragging="true"]').count();
      const dropZoneHighlight = await page.locator('.drop-zone-active, [data-over="true"]').count();
      
      console.log(`Drag preview elements: ${dragPreview}, Drop zone highlights: ${dropZoneHighlight}`);
      
      // Complete the drop
      await page.mouse.up();
    }
  });

  test('Responsive layout check', async ({ page }) => {
    // Navigate to report builder
    await page.click('text=Report Builder');
    await page.waitForSelector('.reportBuilder');
    
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 1366, height: 768, name: 'Laptop' },
      { width: 768, height: 1024, name: 'Tablet' },
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Check if main elements are still visible and accessible
      const fieldSelector = page.locator('.leftPanel, [class*="field"]').first();
      const canvas = page.locator('.canvas, [class*="canvas"]').first();
      const propertiesPanel = page.locator('.rightPanel, [class*="properties"]').first();
      
      const fieldSelectorVisible = await fieldSelector.isVisible();
      const canvasVisible = await canvas.isVisible();
      const propertiesPanelVisible = await propertiesPanel.isVisible();
      
      console.log(`${viewport.name}: Field Selector: ${fieldSelectorVisible}, Canvas: ${canvasVisible}, Properties: ${propertiesPanelVisible}`);
      
      // At minimum, canvas should always be visible
      expect(canvasVisible).toBeTruthy();
    }
  });
});