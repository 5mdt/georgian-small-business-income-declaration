document.getElementById('fetchButton').addEventListener('click', function () {
  const date = document.getElementById('datePicker').value;
  const errorMessage = document.getElementById('errorMessage');
  const resultDiv = document.getElementById('result');
  const loadingMessage = document.getElementById('loadingMessage');

  // Clear previous results and hide the loading message
  resultDiv.style.display = 'none';
  errorMessage.textContent = '';
  loadingMessage.style.display = 'none';

  // Validate the selected date
  if (!date) {
      errorMessage.textContent = 'Please select a date.';
      return;
  }

  // Show loading message
  loadingMessage.style.display = 'block';

  // Construct the API URL
  const apiUrl = `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=${date}`;

  // Fetch data from the API
  fetch(apiUrl)
      .then(response => {
          if (!response.ok) {
              throw new Error('Failed to fetch data.');
          }
          return response.json();
      })
      .then(data => {
          loadingMessage.style.display = 'none'; // Hide loading message after fetch is done

          // Validate if data is valid
          if (data && Array.isArray(data) && data.length > 0) {
              // Format data for better readability
              resultDiv.textContent = JSON.stringify(data, null, 2);
              resultDiv.style.display = 'block';
          } else {
              throw new Error('No valid data received from the API.');
          }
      })
      .catch(error => {
          loadingMessage.style.display = 'none'; // Hide loading message if error occurs
          errorMessage.textContent = `Error: ${error.message}`;
      });
});

// Set the default date to today
window.onload = function() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('datePicker').value = today;
};
