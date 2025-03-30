document.getElementById('fetchButton').addEventListener('click', function () {
  const date = document.getElementById('datePicker').value;
  const currencyCode = document.getElementById('currencySelect').value;
  const amount = parseFloat(document.getElementById('amountInput').value);
  const errorMessage = document.getElementById('errorMessage');
  const resultDiv = document.getElementById('result');
  const loadingMessage = document.getElementById('loadingMessage');

  // Clear previous results
  resultDiv.innerHTML = "";
  errorMessage.textContent = "";
  loadingMessage.style.display = "none";

  // Input validation
  if (!date) {
      errorMessage.textContent = "Please select a date.";
      return;
  }
  if (!currencyCode) {
      errorMessage.textContent = "Please select a currency.";
      return;
  }
  if (isNaN(amount) || amount <= 0) {
      errorMessage.textContent = "Please enter a valid amount.";
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

          if (!Array.isArray(data) || data.length === 0 || !data[0].currencies) {
              throw new Error("No valid currency data available.");
          }

          // Extract currency data
          const currencies = data[0].currencies;
          const selectedCurrency = currencies.find(c => c.code === currencyCode);

          if (!selectedCurrency) {
              throw new Error("Selected currency not found.");
          }

          // Perform conversion to GEL using the correct formula: rate / quantity
          const convertedAmount = (amount * selectedCurrency.rate / selectedCurrency.quantity).toFixed(2);

          // Display result
          resultDiv.innerHTML = `
              <p><strong>${amount} ${currencyCode}</strong> = <strong>${convertedAmount} GEL</strong></p>
              <p>Exchange Rate: <strong>${selectedCurrency.rateFormated}</strong></p>
              <p>Quantity Factor: <strong>${selectedCurrency.quantity}</strong></p>
          `;
          resultDiv.style.display = "block";
      })
      .catch(error => {
          loadingMessage.style.display = "none";
          errorMessage.textContent = `Error: ${error.message}`;
      });
});

// Load currencies when date is selected
document.getElementById('datePicker').addEventListener('change', function () {
  loadCurrencies();
});

function loadCurrencies() {
  const date = document.getElementById('datePicker').value;
  const currencySelect = document.getElementById('currencySelect');
  const errorMessage = document.getElementById('errorMessage');
  const loadingMessage = document.getElementById('loadingMessage');

  // Clear previous errors and loading message
  errorMessage.textContent = "";
  loadingMessage.style.display = "none";

  if (!date) return;

  // Show loading
  currencySelect.innerHTML = `<option value="">Loading...</option>`;

  // Construct API URL
  const apiUrl = `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=${date}`;

  fetch(apiUrl)
      .then(response => {
          if (!response.ok) {
              throw new Error(`API error: ${response.statusText}`);
          }
          return response.json();
      })
      .then(data => {
          if (!Array.isArray(data) || data.length === 0 || !data[0].currencies) {
              throw new Error("No valid currency data available.");
          }

          // Populate dropdown
          currencySelect.innerHTML = `<option value="">Select a currency</option>`;
          data[0].currencies.forEach(currency => {
              const option = document.createElement("option");
              option.value = currency.code;
              option.textContent = `${currency.code} - ${currency.name}`;
              currencySelect.appendChild(option);
          });
      })
      .catch(error => {
          errorMessage.textContent = `Error: ${error.message}`;
      });
}

// Set default date to today and load currencies
window.onload = function () {
  document.getElementById("datePicker").value = new Date().toISOString().split("T")[0];
  loadCurrencies();
};
