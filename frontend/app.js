const form = document.getElementById("prediction-form");
const outputText = document.getElementById("prediction-output");
const resultContainer = document.getElementById("result-container");

const CAD_TO_NT = 23.06; // Conversion rate for CAD TO NT$ (NT is used in dataset)

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const d = new FormData(form);
  const user_payload = {}; // Payload object containing limit_bal, age, 

  for (const [k, v] of d.entries()) {
    let val = Number(v);
    if (k === "LIMIT_BAL") {
      val = val * CAD_TO_NT;
    }
    user_payload[k] = val;
  }

  const payload = {
    ...user_payload, // Numeric fields directly from user input
    // TODO make dynamic, more user input fields and better handling of other fields
    SEX: 1,
    MARRIAGE: 1,
    PAY_4: 0, PAY_5: 0, PAY_6: 0,
    BILL_AMT1: 0, BILL_AMT2: 0, BILL_AMT3: 0,
    BILL_AMT4: 0, BILL_AMT5: 0, BILL_AMT6: 0,
    PAY_AMT1: 0, PAY_AMT2: 0, PAY_AMT3: 0,
    PAY_AMT4: 0, PAY_AMT5: 0, PAY_AMT6: 0
  };

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
  document.getElementById("prediction-output").textContent = `Predicted Probability of Default: ${data.probability.toFixed(4) * 100}%`;
});
