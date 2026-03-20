const form = document.getElementById("prediction-form");
const outputText = document.getElementById("prediction-output");
const resultContainer = document.getElementById("result-container");
const loading = document.getElementById("loading-indicator");
const button = document.getElementById("btn-predict");

const CAD_TO_NT = 23.06; // Conversion rate for CAD TO NT$ (used in dataset)

// TODO consider separating page-specific JS to avoid needing DOM existence checks and other safeguards
if (form) {
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

    // Removed for now, this only works when the visualizer is on the same page.
    // Will reintroduce if user input is persisted across pages somewhere
    // setLatestUserPoint({
    //   AGE: payload.AGE,
    //   LIMIT_BAL: payload.LIMIT_BAL
    // });
    // renderD3Visualizer(); // Update chart immediately with the user's point/where they are 

    loading.classList.remove("hidden");
    button.disabled = true;
    // FOR LOCAL TESTING PURPOSES ONLY - IGNORE
    // const r = await fetch("http://127.0.0.1:8000/api/predict", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(payload),
    // });

    const r = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    loading.classList.add("hidden");
    button.disabled = false;
    console.log("Full Payload Sent:", payload);
    console.log("Prediction Response:", data);
    const probability = data.default_probability;
    const percent = probability * 100;

    let riskLabel = "";
    if (percent < 10) {
      riskLabel = "Low risk";
    } else if (percent < 30) {
      riskLabel = "Moderate risk";
    } else {
      riskLabel = "High risk";
    }

    document.getElementById("prediction-output").textContent = `${percent.toFixed(2)}%`;
    document.getElementById("prediction-label").textContent = riskLabel;
    resultContainer.classList.remove("hidden");
  });
}

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

function showPage(pageId) {
  const target = document.getElementById(pageId);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
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

// Load the visualizations 
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".page").forEach(p => {
    p.style.display = "block";
    p.classList.add("active");
  });

});

function showDatasetPanel(panelId, event) {
  const panels = document.querySelectorAll('.dataset-panel');
  const chips = document.querySelectorAll('.dataset-btn');

  panels.forEach(panel => panel.classList.remove('active'));
  chips.forEach(chip => chip.classList.remove('active'));

  const selectedPanel = document.getElementById(panelId);
  if (selectedPanel) {
    selectedPanel.classList.add('active');
  }

  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
}

function toggleFeatureInfo(infoId, event) {
  const infos = document.querySelectorAll('.feature-info');
  const cards = document.querySelectorAll('.feature-card');

  infos.forEach(info => info.classList.remove('active'));
  cards.forEach(card => card.classList.remove('active'));

  const selectedInfo = document.getElementById(infoId);
  if (selectedInfo) {
    selectedInfo.classList.add('active');
  }

  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
}

// Dynamically set labels for the last 3 months in the form
function formatMonthYear(date) {
  return date.toLocaleString("en-CA", {
    month: "short",
    year: "numeric",
  });
}

function getPreviousMonth(baseDate, monthsBack) {
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() - monthsBack);
  return d;
}

function setRepaymentMonthLabels() {
  const label0 = document.getElementById("pay-label-0");
  if (!label0) return; // Don't continue if this page does not contain the repayment labels
  const today = new Date();
  document.getElementById("pay-label-0").textContent = formatMonthYear(getPreviousMonth(today, 1));
  document.getElementById("pay-label-2").textContent = formatMonthYear(getPreviousMonth(today, 2));
  document.getElementById("pay-label-3").textContent = formatMonthYear(getPreviousMonth(today, 3));
}

document.addEventListener("DOMContentLoaded", setRepaymentMonthLabels);