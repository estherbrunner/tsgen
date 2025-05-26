import { FunctionRequest, FunctionResponse } from '../shared/types';

// API endpoint for the server
const API_URL = 'http://localhost:3000/api/generate';

// Main function to request TypeScript function generation
export async function requestFunctionGeneration(
  prompt: string,
  options: FunctionRequest['options'] = {},
  testCases: string[] = []
): Promise<FunctionResponse> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        options,
        testCases,
      } as FunctionRequest),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    return await response.json() as FunctionResponse;
  } catch (error) {
    console.error('Error generating function:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    } as FunctionResponse;
  }
}

// Function to display the generated code and results in the UI
export function displayResults(results: FunctionResponse, targetElement: HTMLElement): void {
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
    codeElement.textContent = results.code;
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
      typeCheckElement.className = results.typeCheckResults.success ? 'success' : 'error';
      typeCheckElement.textContent = results.typeCheckResults.message || 'Type check passed';
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
          issueElement.className = 'error';
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
      testHeader.textContent = 'Test Results';
      testContainer.appendChild(testHeader);
      
      const testElement = document.createElement('ul');
      results.testResults.tests.forEach(test => {
        const testItem = document.createElement('li');
        testItem.className = test.passed ? 'success' : 'error';
        testItem.textContent = `${test.name}: ${test.passed ? 'Passed' : 'Failed'} - ${test.message}`;
        testElement.appendChild(testItem);
      });
      testContainer.appendChild(testElement);
      
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
  // Tab switching functionality
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      if (!tabId) return;
      
      // Update active tab
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active content
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      const targetContent = document.getElementById(tabId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });

  // Update complexity level display
  const complexityInput = document.getElementById('complexity-level') as HTMLInputElement;
  const complexityDisplay = document.getElementById('complexity-display');
  if (complexityInput && complexityDisplay) {
    complexityInput.addEventListener('input', () => {
      complexityDisplay.textContent = complexityInput.value;
    });
  }

  // Form submission
  const form = document.getElementById('function-generator-form') as HTMLFormElement;
  const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
  const resultsContainer = document.getElementById('results-container') as HTMLElement;

  if (form && generateButton && resultsContainer) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      // Get form values
      const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
      const includeJSDocInput = document.getElementById('include-jsdoc') as HTMLInputElement;
      const strictTypesInput = document.getElementById('strict-types') as HTMLInputElement;
      const functionalStyleInput = document.getElementById('functional-style') as HTMLInputElement;
      const targetVersionInput = document.getElementById('target-version') as HTMLSelectElement;
      const complexityLevelInput = document.getElementById('complexity-level') as HTMLInputElement;
      const testCasesInput = document.getElementById('test-cases') as HTMLTextAreaElement;
      
      const prompt = promptInput?.value.trim() || '';
      const includeJSDoc = includeJSDocInput?.checked || false;
      const strictTypes = strictTypesInput?.checked || false;
      const functionalStyle = functionalStyleInput?.checked || false;
      const targetVersion = (targetVersionInput?.value || 'latest') as 'latest' | 'ES5' | 'ES6' | 'ES2016' | 'ES2017' | 'ES2018' | 'ES2019' | 'ES2020' | 'ES2021' | 'ES2022';
      const complexityLevel = parseInt(complexityLevelInput?.value || '3') as 1 | 2 | 3 | 4 | 5;
      const testCasesText = testCasesInput?.value.trim() || '';
      
      if (!prompt) return;
      
      // Parse test cases (one per line)
      const testCases = testCasesText ? testCasesText.split('\n').filter(line => line.trim()) : [];
      
      // Create options object
      const options = {
        includeJSDoc,
        strictTypes,
        functionalStyle,
        targetVersion,
        complexityLevel
      };
      
      // Disable button and show loading state
      generateButton.disabled = true;
      generateButton.textContent = 'Generating...';
      
      // Display a waiting message
      resultsContainer.innerHTML = `
        <div class="status">
          Processing your request... This may take a few seconds.
        </div>
      `;
      
      try {
        // Call the API
        const results = await requestFunctionGeneration(prompt, options, testCases);
        
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