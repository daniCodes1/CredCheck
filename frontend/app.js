const form = document.getElementById("prediction-form");
const outputText = document.getElementById("prediction-output");
const resultContainer = document.getElementById("result-container");

const CAD_TO_NT = 23.06; // Conversion rate for CAD TO NT$ (used in dataset)

// TODO implement page switching logic from the navbar links
// TODO make the repayment status user-friendly, dropdown (instead of a code like 0 or 1)

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const d = new FormData(form);
  const user_payload = {}; // Payload object containing limit_bal, age, 
  for (const [k, v] of d.entries()) {
    let val = Number(v);
    // Convert all currency inputs 
    if (k === "LIMIT_BAL" || k === "BILL_INPUT" || k === "PAY_INPUT") {
      val = val * CAD_TO_NT;
    }
    user_payload[k] = val;
  }

  const payload = {
    ...user_payload,
    SEX: 1, // Still placeholder
    MARRIAGE: 1, // Still placeholder
    PAY_4: user_payload.PAY_3, // Older history will use the earliest month provided by user 
    PAY_5: user_payload.PAY_3,
    PAY_6: user_payload.PAY_3,
    BILL_AMT1: user_payload.BILL_INPUT, BILL_AMT2: user_payload.BILL_INPUT,
    BILL_AMT3: user_payload.BILL_INPUT, BILL_AMT4: user_payload.BILL_INPUT,
    BILL_AMT5: user_payload.BILL_INPUT, BILL_AMT6: user_payload.BILL_INPUT,

    PAY_AMT1: user_payload.PAY_INPUT, PAY_AMT2: user_payload.PAY_INPUT,
    PAY_AMT3: user_payload.PAY_INPUT, PAY_AMT4: user_payload.PAY_INPUT,
    PAY_AMT5: user_payload.PAY_INPUT, PAY_AMT6: user_payload.PAY_INPUT

  };

  // const payload_for_testing = { // hard coded for low probability of default, for testing purposes
  //   ...user_payload,
  //   SEX: 1,
  //   MARRIAGE: 1,
  //   PAY_4: -1, PAY_5: -1, PAY_6: -1,
  //   BILL_AMT1: 5000, BILL_AMT2: 5000, BILL_AMT3: 5000,
  //   BILL_AMT4: 5000, BILL_AMT5: 5000, BILL_AMT6: 5000,
  //   PAY_AMT1: 5000, PAY_AMT2: 5000, PAY_AMT3: 5000,
  //   PAY_AMT4: 5000, PAY_AMT5: 5000, PAY_AMT6: 5000
  // };

  const r = await fetch("http://127.0.0.1:8000/predict", { // TODO replace with actual API endpoint
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await r.json();
  console.log("Full Payload Sent:", payload);
  console.log("Prediction Response:", data);
  document.getElementById("prediction-output").textContent = `${(data.default_probability * 100).toFixed(2)}%`;

});

// Show/hide chart logic
function showChart(chartId) {
  const charts = document.querySelectorAll('.charts');
  const buttons = document.querySelectorAll('.menu-btn');

  charts.forEach(chart => {
    chart.classList.remove('active');
    chart.style.display = 'none';
  });

  buttons.forEach(b => b.classList.remove('active'));

  const selectedChart = document.getElementById(chartId);
  if (selectedChart) {
    selectedChart.style.display = 'block';
    setTimeout(() => { // To help the CSS transition work
      selectedChart.classList.add('active');
    }, 20);
  }
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
}

function toggleStep(stepId) {
  const allContents = document.querySelectorAll('.node-content');
  const target = document.getElementById(stepId);
  const isAlreadyActive = target.classList.contains('active');

  allContents.forEach(content => content.classList.remove('active'));
  if (!isAlreadyActive) {
    target.classList.add('active');
  }
}