document.getElementById('fetchButton').addEventListener('click', function () {
  const date = document.getElementById('datePicker').value;
  const errorMessage = document.getElementById('errorMessage');
  const resultDiv = document.getElementById('result');
  const loadingMessage = document.getElementById('loadingMessage');

  // Clear previous results
  resultDiv.innerHTML = "";
  errorMessage.textContent = "";
  loadingMessage.style.display = "none";

  // Validate input date
  if (!date) {
      errorMessage.textContent = "Please select a date.";
      return;
  }

  // Show loading message
  loadingMessage.style.display = "block";

  // Construct API URL
  const apiUrl = `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=${date}`;

  // Fetch data
  fetch(apiUrl)
      .then(response => {
          if (!response.ok) {
              throw new Error(`API error: ${response.statusText}`);
          }
          return response.json();
      })
      .then(data => {
          loadingMessage.style.display = "none";

          // Validate response
          if (!Array.isArray(data) || data.length === 0 || !data[0].currencies) {
              throw new Error("No valid currency data available.");
          }

          // Extract currency data
          const currencies = data[0].currencies;

          // Generate table
          const table = document.createElement("table");
          table.innerHTML = `
              <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Rate</th>
                  <th>Difference</th>
              </tr>
          `;

          currencies.forEach(currency => {
              const row = document.createElement("tr");
              row.innerHTML = `
                  <td>${currency.code}</td>
                  <td>${currency.name}</td>
                  <td>${currency.rateFormated}</td>
                  <td>${currency.diffFormated}</td>
              `;
              table.appendChild(row);
          });

          // Display results
          resultDiv.appendChild(table);
          resultDiv.style.display = "block";
      })
      .catch(error => {
          loadingMessage.style.display = "none";
          errorMessage.textContent = `Error: ${error.message}`;
      });
});

// Set default date to today
window.onload = function() {
  document.getElementById("datePicker").value = new Date().toISOString().split("T")[0];
};
