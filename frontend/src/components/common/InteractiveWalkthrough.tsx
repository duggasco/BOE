import React, { useState, useEffect, useCallback, useReducer } from 'react';
import Joyride, { type CallBackProps, STATUS, EVENTS, ACTIONS } from 'react-joyride';
import { Button, Card, Progress, Space, Typography, Modal, FloatButton } from 'antd';
import { RocketOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { walkthroughScenarios } from '../../data/walkthroughScenarios';
import type { WalkthroughScenario, WalkthroughState } from '../../types/walkthrough';

const { Title, Text, Paragraph } = Typography;

// Joyride custom styles
const joyrideStyles = {
  options: {
    primaryColor: '#1890ff',
    zIndex: 10000,
    arrowColor: '#fff',
    backgroundColor: '#fff',
    textColor: '#333',
  },
  tooltip: {
    borderRadius: 8,
    fontSize: 14,
  },
  tooltipContainer: {
    textAlign: 'left' as const,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: 600,
  },
  buttonNext: {
    backgroundColor: '#1890ff',
    borderRadius: 4,
  },
  buttonBack: {
    marginRight: 10,
  },
  spotlight: {
    borderRadius: 4,
  },
};

// Helper function to wait for an element to appear in the DOM
const waitForElement = (selector: string, timeout = 5000): Promise<Element | null> => {
  return new Promise((resolve) => {
    // Check if element already exists
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    // Set up MutationObserver to watch for element
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
};

// Session storage keys for preserving tour state
const TOUR_SESSION_KEY = 'walkthrough_session';

// Reducer for managing walkthrough state
type WalkthroughAction =
  | { type: 'START_TOUR'; scenario: WalkthroughScenario }
  | { type: 'STOP_TOUR' }
  | { type: 'PAUSE_TOUR' }
  | { type: 'RESUME_TOUR' }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; stepIndex: number }
  | { type: 'RESET' };

function walkthroughReducer(state: WalkthroughState, action: WalkthroughAction): WalkthroughState {
  switch (action.type) {
    case 'START_TOUR':
      return {
        run: true,
        stepIndex: 0,
        tourActive: true,
        scenario: action.scenario,
      };
    case 'STOP_TOUR':
      return {
        ...state,
        run: false,
        tourActive: false,
      };
    case 'PAUSE_TOUR':
      return {
        ...state,
        run: false,
      };
    case 'RESUME_TOUR':
      return {
        ...state,
        run: true,
      };
    case 'NEXT_STEP':
      return {
        ...state,
        stepIndex: Math.min(state.stepIndex + 1, (state.scenario?.steps.length || 1) - 1),
      };
    case 'PREV_STEP':
      return {
        ...state,
        stepIndex: Math.max(state.stepIndex - 1, 0),
      };
    case 'GO_TO_STEP':
      return {
        ...state,
        stepIndex: action.stepIndex,
      };
    case 'RESET':
      return {
        run: false,
        stepIndex: 0,
        tourActive: false,
        scenario: null,
      };
    default:
      return state;
  }
}

export const InteractiveWalkthrough: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [walkthroughState, dispatch] = useReducer(walkthroughReducer, {
    run: false,
    stepIndex: 0,
    tourActive: false,
    scenario: null,
  });

  // Check if this is the first visit
  useEffect(() => {
    const hasSeenWalkthrough = localStorage.getItem('hasSeenWalkthrough');
    const isFirstVisit = !hasSeenWalkthrough;
    
    if (isFirstVisit) {
      // Show selection modal after a short delay
      const timer = setTimeout(() => {
        setShowSelectionModal(true);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, []); // Run only once on mount

  // Check for tour continuation after navigation
  useEffect(() => {
    const checkTourContinuation = async () => {
      const sessionData = sessionStorage.getItem(TOUR_SESSION_KEY);
      if (sessionData) {
        try {
          const { scenarioId, stepIndex } = JSON.parse(sessionData);
          const scenario = walkthroughScenarios.find(s => s.id === scenarioId);
          
          if (scenario && stepIndex < scenario.steps.length) {
            const currentStep = scenario.steps[stepIndex];
            
            // Wait for the target element to appear
            if (currentStep.target && currentStep.target !== 'body') {
              const element = await waitForElement(currentStep.target);
              if (element) {
                // Element found, resume tour
                dispatch({ type: 'START_TOUR', scenario });
                dispatch({ type: 'GO_TO_STEP', stepIndex });
                // Clear session storage
                sessionStorage.removeItem(TOUR_SESSION_KEY);
              }
            }
          }
        } catch (error) {
          console.error('Error resuming tour:', error);
          sessionStorage.removeItem(TOUR_SESSION_KEY);
        }
      }
    };

    checkTourContinuation();
  }, [location.pathname]); // Check when route changes

  // Handle scenario selection
  const startScenario = useCallback(async (scenario: WalkthroughScenario) => {
    // Mark as seen
    localStorage.setItem('hasSeenWalkthrough', 'true');
    
    // Close selection modal
    setShowSelectionModal(false);
    
    // Check if we need to navigate first
    const firstStep = scenario.steps[0];
    if (firstStep.route && location.pathname !== firstStep.route) {
      // Save tour state to session storage
      sessionStorage.setItem(TOUR_SESSION_KEY, JSON.stringify({
        scenarioId: scenario.id,
        stepIndex: 0,
      }));
      // Navigate to the route
      navigate(firstStep.route);
    } else {
      // Start tour immediately if we're already on the right page
      dispatch({ type: 'START_TOUR', scenario });
    }
  }, [navigate, location.pathname]);

  // Handle Joyride callbacks
  const handleJoyrideCallback = useCallback(async (data: CallBackProps) => {
    const { status, action, index, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      // Tour completed or skipped
      sessionStorage.removeItem(TOUR_SESSION_KEY);
      dispatch({ type: 'RESET' });
      
      if (status === STATUS.FINISHED) {
        Modal.success({
          title: 'Tutorial Complete!',
          content: `Great job completing the ${walkthroughState.scenario?.name} tutorial!`,
        });
      }
    } else if (type === EVENTS.STEP_AFTER && action === ACTIONS.NEXT) {
      // Check if the next step requires navigation
      const nextStepIndex = index + 1;
      const nextStep = walkthroughState.scenario?.steps[nextStepIndex];
      
      if (nextStep?.route && location.pathname !== nextStep.route) {
        // Pause tour for navigation
        dispatch({ type: 'PAUSE_TOUR' });
        
        // Save state to session storage
        sessionStorage.setItem(TOUR_SESSION_KEY, JSON.stringify({
          scenarioId: walkthroughState.scenario?.id,
          stepIndex: nextStepIndex,
        }));
        
        // Navigate to the new route
        navigate(nextStep.route);
      } else if (nextStep) {
        // If the next step is on the same page, wait for its element if needed
        if (nextStep.target && nextStep.target !== 'body') {
          const element = await waitForElement(nextStep.target, 2000);
          if (!element) {
            console.warn(`Target element not found: ${nextStep.target}`);
          }
        }
      }
    } else if (action === ACTIONS.CLOSE) {
      sessionStorage.removeItem(TOUR_SESSION_KEY);
      dispatch({ type: 'STOP_TOUR' });
    }
  }, [walkthroughState.scenario, navigate, location.pathname]);

  // Convert scenario steps to Joyride format
  const joyrideSteps = walkthroughState.scenario?.steps.map((step, index) => ({
    target: step.target,
    content: (
      <div>
        {step.title && <h4 style={{ marginTop: 0, marginBottom: 8 }}>{step.title}</h4>}
        <div>{step.content}</div>
      </div>
    ),
    placement: step.placement || 'bottom',
    disableBeacon: step.disableBeacon || false,
    spotlightClicks: step.spotlightClicks || false,
    styles: step.styles || {},
    // Force showSkipButton for all steps
    showSkipButton: true,
    // Ensure proper button labels based on position
    locale: {
      last: index === (walkthroughState.scenario?.steps.length || 0) - 1 ? 'Complete' : 'Next',
    },
  })) || [];

  return (
    <>
      {/* React Joyride Tour - Use continuous=true to show Next button */}
      <Joyride
        steps={joyrideSteps}
        run={walkthroughState.run}
        stepIndex={walkthroughState.stepIndex}
        continuous={true} // Changed to true to enable Next button
        showProgress={walkthroughState.scenario?.showProgress !== false}
        showSkipButton={walkthroughState.scenario?.showSkipButton !== false}
        callback={handleJoyrideCallback}
        styles={joyrideStyles}
        locale={{
          back: 'Previous',
          close: 'Close',
          last: 'Complete',
          next: 'Next',
          skip: 'Skip Tutorial',
        }}
        floaterProps={{
          disableAnimation: false,
        }}
        spotlightPadding={5}
        disableScrolling={false}
        disableScrollParentFix={true}
        scrollToFirstStep={false}
        debug={false}
      />

      {/* Floating Help Button */}
      <FloatButton.Group
        trigger="hover"
        type="primary"
        style={{ right: 24, bottom: 24 }}
        icon={<QuestionCircleOutlined />}
      >
        <FloatButton
          icon={<RocketOutlined />}
          tooltip="Interactive Tutorials"
          onClick={() => setShowSelectionModal(true)}
        />
      </FloatButton.Group>

      {/* Scenario Selection Modal */}
      <Modal
        title="Choose a Tutorial"
        open={showSelectionModal}
        footer={[
          <Button
            key="dismiss"
            type="link"
            onClick={() => {
              localStorage.setItem('hasSeenWalkthrough', 'true');
              setShowSelectionModal(false);
            }}
          >
            Don't show this again
          </Button>,
          <Button
            key="close"
            onClick={() => setShowSelectionModal(false)}
          >
            Close
          </Button>,
        ]}
        onCancel={() => setShowSelectionModal(false)}
        width={600}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Paragraph>
            Select a tutorial to learn how to use the BOE Replacement System. Each tutorial provides
            step-by-step guidance through key features.
          </Paragraph>

          {walkthroughScenarios.map((scenario) => (
            <Card
              key={scenario.id}
              hoverable
              onClick={() => startScenario(scenario)}
              style={{ cursor: 'pointer' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Title level={4} style={{ margin: 0 }}>
                    {scenario.name}
                  </Title>
                  <Text type="secondary">{scenario.estimatedTime} min</Text>
                </div>
                <Text>{scenario.description}</Text>
                <Progress
                  percent={0}
                  showInfo={false}
                  strokeColor="#1890ff"
                  trailColor="#f0f0f0"
                  size="small"
                />
              </Space>
            </Card>
          ))}
        </Space>
      </Modal>
    </>
  );
};