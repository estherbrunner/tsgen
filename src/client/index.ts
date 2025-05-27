import { FunctionRequest, FunctionResponse } from '../shared/types';

// API endpoint for the server
const API_URL = 'http://localhost:3000/api/generate';

// Main function to request TypeScript function generation
export async function requestFunctionGeneration(
  prompt: string
): Promise<FunctionResponse> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt } as FunctionRequest),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    return (await response.json()) as FunctionResponse;
  } catch (error) {
    console.error('Error generating function:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    } as FunctionResponse;
  }
}

// Function to display the generated code and results in the UI
export function displayResults(
  results: FunctionResponse,
  targetElement: HTMLElement
): void {
  // Clear previous content
  targetElement.innerHTML = '';

  // Create container
  const container = document.createElement('div');
  container.className = 'results-container';

  // Display status
  const statusElement = document.createElement('div');
  statusElement.className = `status ${results.success ? 'success' : 'error'}`;
  statusElement.textContent = results.success ? 'Success' : 'Error';
  container.appendChild(statusElement);

  if (results.success && results.code) {
    // Display generated code
    const codeContainer = document.createElement('div');
    codeContainer.className = 'code-container';

    const codeHeader = document.createElement('h3');
    codeHeader.textContent = 'Generated Function';
    codeContainer.appendChild(codeHeader);

    const codeElement = document.createElement('pre');
    codeElement.className = 'code';
    codeElement.innerHTML = results.code;
    codeContainer.appendChild(codeElement);

    container.appendChild(codeContainer);

    // Display type check results
    if (results.typeCheckResults) {
      const typeCheckContainer = document.createElement('div');
      typeCheckContainer.className = 'type-check-container';

      const typeCheckHeader = document.createElement('h3');
      typeCheckHeader.textContent = 'Type Check Results';
      typeCheckContainer.appendChild(typeCheckHeader);

      const typeCheckElement = document.createElement('div');
      typeCheckElement.className = results.typeCheckResults.success
        ? 'success'
        : 'error';
      typeCheckElement.textContent =
        results.typeCheckResults.message || 'Type check passed';
      typeCheckContainer.appendChild(typeCheckElement);

      container.appendChild(typeCheckContainer);
    }

    // Display lint results
    if (results.lintResults) {
      const lintContainer = document.createElement('div');
      lintContainer.className = 'lint-container';

      const lintHeader = document.createElement('h3');
      lintHeader.textContent = 'Lint Results';
      lintContainer.appendChild(lintHeader);

      const lintElement = document.createElement('ul');
      if (results.lintResults.issues.length === 0) {
        const noIssues = document.createElement('li');
        noIssues.className = 'success';
        noIssues.textContent = 'No linting issues found';
        lintElement.appendChild(noIssues);
      } else {
        results.lintResults.issues.forEach(issue => {
          const issueElement = document.createElement('li');
          issueElement.className =
            issue.severity === 'error' ? 'error' : 'warning';
          issueElement.textContent = `${issue.message} (line ${issue.line})`;
          lintElement.appendChild(issueElement);
        });
      }
      lintContainer.appendChild(lintElement);

      container.appendChild(lintContainer);
    }

    // Display test results
    if (results.testResults) {
      const testContainer = document.createElement('div');
      testContainer.className = 'test-container';

      const testHeader = document.createElement('h3');
      testHeader.textContent = results.testResults.label || 'Test Results';
      testContainer.appendChild(testHeader);

      // Test summary
      const testSummary = document.createElement('div');
      testSummary.className = 'test-summary';

      const passedTests = results.testResults.tests.filter(
        test => test.status === 'passed'
      ).length;
      const totalTests = results.testResults.tests.length;
      const hasWarnings = results.testResults.hasWarnings;

      let summaryText = `${passedTests}/${totalTests} tests passed`;
      if (hasWarnings) {
        summaryText += ' (with warnings)';
      }
      summaryText += ` in ${results.testResults.totalExecutionTime}ms`;

      testSummary.textContent = summaryText;
      testSummary.className = `test-summary ${results.testResults.success ? 'success' : 'error'}`;
      testContainer.appendChild(testSummary);

      // Warning banner for linter warnings
      if (hasWarnings && results.testResults.linterWarnings) {
        const warningBanner = document.createElement('div');
        warningBanner.className = 'warning-banner';
        warningBanner.innerHTML = `
          <strong>⚠️ Code Quality Warnings:</strong>
          <ul>
            ${results.testResults.linterWarnings
              .map(
                warning => `<li>${warning.message} (line ${warning.line})</li>`
              )
              .join('')}
          </ul>
        `;
        testContainer.appendChild(warningBanner);
      }

      // Individual test results
      const testList = document.createElement('ul');
      testList.className = 'test-list';

      results.testResults.tests.forEach(test => {
        const testItem = document.createElement('li');
        testItem.className = `test-item ${test.status}`;

        const testStatus = document.createElement('span');
        testStatus.className = `test-status ${test.status}`;
        testStatus.textContent = test.status.toUpperCase();

        const testMessage = document.createElement('span');
        testMessage.className = 'test-message';
        testMessage.textContent = test.description;

        const testTime = document.createElement('span');
        testTime.className = 'test-time';
        testTime.textContent = `${test.executionTime}ms`;

        testItem.appendChild(testStatus);
        testItem.appendChild(testMessage);
        testItem.appendChild(testTime);

        testList.appendChild(testItem);
      });

      testContainer.appendChild(testList);
      container.appendChild(testContainer);
    }
  } else if (results.error) {
    // Display error
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = results.error;
    container.appendChild(errorElement);
  }

  // Append the container to the target element
  targetElement.appendChild(container);
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Form submission
  const form = document.getElementById(
    'function-generator-form'
  ) as HTMLFormElement;
  const generateButton = document.getElementById(
    'generate-button'
  ) as HTMLButtonElement;
  const resultsContainer = document.getElementById(
    'results-container'
  ) as HTMLElement;

  if (form && generateButton && resultsContainer) {
    form.addEventListener('submit', async event => {
      event.preventDefault();

      // Get form values
      const promptInput = document.getElementById(
        'prompt-input'
      ) as HTMLTextAreaElement;

      const prompt = promptInput?.value.trim() || '';

      if (!prompt) {
        alert('Please enter a function description');
        return;
      }

      // Disable button and show loading state
      generateButton.disabled = true;
      generateButton.textContent = 'Generating...';

      // Display a waiting message
      resultsContainer.innerHTML = `
        <div class="status loading">
          <div class="loading-spinner"></div>
          Processing your request... This may take a few seconds.
        </div>
      `;

      try {
        // Call the API
        const results = await requestFunctionGeneration(prompt);

        // Display results
        displayResults(results, resultsContainer);
      } catch (error) {
        console.error('Error:', error);

        // Show error message
        resultsContainer.innerHTML = `
          <div class="status error">
            Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}
          </div>
        `;
      } finally {
        // Reset button
        generateButton.disabled = false;
        generateButton.textContent = 'Generate Function';
      }
    });
  }
});
