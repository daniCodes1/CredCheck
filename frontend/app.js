const form = document.getElementById("f");
const out = document.getElementById("out");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fd = new FormData(form);
  const payload = {};
  for (const [k, v] of fd.entries()) payload[k] = Number(v);

  const r = await fetch("http://127.0.0.1:8000/predict", { // to be replaced with actual API endpoint
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await r.json();
  const pct = (data.default_probability * 100).toFixed(1);
  out.textContent = `Default probability: ${pct}% (label=${data.predicted_label})`;
});
