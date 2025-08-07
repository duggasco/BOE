import { ReactNode } from 'react';

export interface WalkthroughStep {
  target: string; // CSS selector for the target element
  content: ReactNode | string; // Content to display in the tooltip
  title?: string; // Optional title for the step
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto' | 'center'; // Tooltip placement
  disableBeacon?: boolean; // Disable the beacon (pulsing dot)
  spotlightClicks?: boolean; // Allow clicking on the highlighted element
  styles?: any; // Custom styles for the step
  route?: string; // Optional route to navigate to before this step
}

export interface WalkthroughScenario {
  id: string;
  name: string;
  description: string;
  estimatedTime: number; // in minutes
  steps: WalkthroughStep[];
  showProgress?: boolean; // Whether to show progress bar
  showSkipButton?: boolean; // Whether to show skip button
}

export interface WalkthroughState {
  run: boolean;
  stepIndex: number;
  tourActive: boolean;
  scenario: WalkthroughScenario | null;
}

export type { };  // This ensures the file is treated as a module