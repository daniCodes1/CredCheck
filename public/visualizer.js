let latestUserPoint = null;

function setLatestUserPoint(point) {
    latestUserPoint = point;
}

function getEducationLabel(value) {
    if (value == "1") return "Grad School";
    if (value == "2") return "University";
    if (value == "3") return "High School";
    return "Others";
}

async function renderD3Visualizer() {
    const CAD_TO_NT = 23.06;

    const container = d3.select("#d3-container");
    container.selectAll("*").remove();

    d3.selectAll(".d3-tooltip").remove();

    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "d3-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background", "rgba(0,0,0,0.8)")
        .style("color", "#fff")
        .style("padding", "10px")
        .style("border-radius", "6px");

    let rawData;
    try {
        rawData = await fetch("/api/data").then(r => r.json());
    } catch (err) {
        console.error("Error loading CSV:", err);
        container.append("p").text("Sorry! Could not load chart data.");
        return;
    }

    const data = rawData.map(d => ({
        AGE: +d.AGE,
        LIMIT_BAL_CAD: +d.LIMIT_BAL_CAD,
        EDUCATION: String(d.EDUCATION),
        DEFAULT: String(d["default.payment.next.month"]),
        PAY_TO_BILL_TOTAL: +d.pay_to_bill_total,
        UTIL_MEAN: +d.util_mean
    }));

    const educationFilter = document.getElementById("education-filter");
    const defaultFilter = document.getElementById("default-filter");

    function getFilteredData() {
        const educationValue = educationFilter ? educationFilter.value : "all";
        const defaultValue = defaultFilter ? defaultFilter.value : "all";

        let filtered = data;

        if (educationValue !== "all") {
            filtered = filtered.filter(d => d.EDUCATION == educationValue);
        }

        if (defaultValue !== "all") {
            filtered = filtered.filter(d => d.DEFAULT == defaultValue);
        }

        return filtered;
    }

    function renderDashboard() {
        container.selectAll("*").remove(); // Remove eveyrthing from the viz container (for dropdown selections)

        const filtered = getFilteredData();

        // Unlikely but just an edge case:
        if (filtered.length == 0) {
            container.append("p")
                .style("font-weight", "600")
                .style("color", "#666")
                .text("No matching data for this filter.");
            return;
        }

        const totalClients = filtered.length;
        const defaultCount = filtered.filter(d => d.DEFAULT == "1").length;
        const defaultRate = (defaultCount / totalClients) * 100;
        const avgAge = d3.mean(filtered, d => d.AGE);
        const avgLimitCad = d3.mean(filtered, d => d.LIMIT_BAL_CAD);

        // KPI cards for metrics
        const cards = container.append("div")
            .attr("class", "viz-cards");

        const cardData = [
            { label: "Clients", value: totalClients.toLocaleString() },
            { label: "Default Rate", value: `${defaultRate.toFixed(1)}%` },
            { label: "Average Age", value: avgAge.toFixed(1) },
            { label: "Avg Credit Limit", value: `${d3.format(",.0f")(avgLimitCad)} CAD$` } // use built-in formatter
        ];

        cardData.forEach(card => {
            const c = cards.append("div").attr("class", "viz-card");
            c.append("div").attr("class", "viz-card-value").text(card.value);
            c.append("div").attr("class", "viz-card-label").text(card.label);
        });

        // Layout structure
        const grid = container.append("div")
            .attr("class", "viz-grid");

        const heatmapWrap = grid.append("div").attr("class", "viz-layout");
        const barWrap = grid.append("div").attr("class", "viz-layout");

        heatmapWrap.append("h3").attr("class", "viz-title")
            .text("Age vs Credit Limit Density");

        barWrap.append("h3").attr("class", "viz-title")
            .text("Default Rate by Education");

        // Heatmap section
        const heatMargin = { top: 20, right: 70, bottom: 60, left: 75 };
        const heatWidth = 560 - heatMargin.left - heatMargin.right;
        const heatHeight = 380 - heatMargin.top - heatMargin.bottom;

        // Drawing area for heatmap
        const heatSvg = heatmapWrap
            .append("svg")
            .attr("width", heatWidth + heatMargin.left + heatMargin.right + 35)
            .attr("height", heatHeight + heatMargin.top + heatMargin.bottom);

        const heat = heatSvg.append("g")
            .attr("transform", `translate(${heatMargin.left},${heatMargin.top})`);

        const x = d3.scaleLinear()
            .domain(d3.extent(data, d => d.AGE))
            .nice() // human friendly numbers
            .range([0, heatWidth]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.LIMIT_BAL_CAD)])
            .nice()
            .range([heatHeight, 0]);

        // x axis group, at bottom
        heat.append("g")
            .attr("transform", `translate(0,${heatHeight})`)
            .call(d3.axisBottom(x)); // draw axis

        heat.append("g")
            .call(d3.axisLeft(y).tickFormat(d3.format(",.0f")));

        heat.append("text")
            .attr("x", heatWidth / 2)
            .attr("y", heatHeight + 45)
            .attr("text-anchor", "middle")
            .style("font-weight", "600")
            .text("Age");

        heat.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -heatHeight / 2)
            .attr("y", -50)
            .attr("text-anchor", "middle")
            .style("font-weight", "600")
            .text("Credit Limit (CAD$)");

        // Bin settings
        const ageBins = d3.bin()
            .value(d => d.AGE)
            .domain(x.domain())
            .thresholds(18); // about 18 bins for age

        const limitBins = d3.bin()
            .value(d => d.LIMIT_BAL_CAD)
            .domain(y.domain())
            .thresholds(14);

        // Get the boudnaries of the bins
        const ageBinThresholds = ageBins(filtered).map(bin => bin.x0);
        ageBinThresholds.push(ageBins(filtered)[ageBins(filtered).length - 1].x1);

        const limitBinThresholds = limitBins(filtered).map(bin => bin.x0);
        limitBinThresholds.push(limitBins(filtered)[limitBins(filtered).length - 1].x1);

        // The heatmap cells:
        const bins = [];

        for (let i = 0; i < ageBinThresholds.length - 1; i++) {
            for (let j = 0; j < limitBinThresholds.length - 1; j++) {
                // The boundaries 
                const x0 = ageBinThresholds[i];
                const x1 = ageBinThresholds[i + 1];
                const y0 = limitBinThresholds[j];
                const y1 = limitBinThresholds[j + 1];

                // The data points of that cell ^
                const points = filtered.filter(d =>
                    d.AGE >= x0 && d.AGE < x1 &&
                    d.LIMIT_BAL_CAD >= y0 && d.LIMIT_BAL_CAD < y1
                );

                // Summary info for that cell
                bins.push({
                    x0,
                    x1,
                    y0,
                    y1,
                    count: points.length,
                    defaultRate: points.length
                        ? points.filter(p => p.DEFAULT == "1").length / points.length
                        : 0
                });
            }
        }

        const maxBinCount = d3.max(bins, d => d.count) || 1;

        const color = d3.scaleSequential()
            .domain([0, maxBinCount])
            .interpolator(d3.interpolateYlOrRd);

        // The heat map cells + mouse interactions
        heat.selectAll("rect.heat-cell")
            .data(bins.filter(d => d.count > 0))
            .join("rect")
            .attr("class", "heat-cell")
            .attr("x", d => x(d.x0))
            .attr("y", d => y(d.y1))
            .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
            .attr("height", d => Math.max(0, y(d.y0) - y(d.y1) - 1))
            .attr("fill", d => color(d.count))
            .attr("opacity", 0.9)
            .on("mouseover", function (event, d) {
                d3.select(this)
                    .attr("stroke", "#111")
                    .attr("stroke-width", 1.5);

                tooltip
                    .style("visibility", "visible")
                    .html(`
                        <strong>Clients:</strong> ${d.count.toLocaleString()}<br>
                        <strong>Default Rate:</strong> ${(d.defaultRate * 100).toFixed(1)}%<br>
                        <strong>Age Range:</strong> ${Math.round(d.x0)}–${Math.round(d.x1)}<br>
                        <strong>Credit Limit Range:</strong> ${d3.format(",.0f")(d.y0)}–${d3.format(",.0f")(d.y1)} CAD$

                    `);
            })
            .on("mousemove", function (event) {
                tooltip
                    .style("top", `${event.pageY - 10}px`)
                    .style("left", `${event.pageX + 12}px`);
            })
            .on("mouseout", function () {
                d3.select(this)
                    .attr("stroke", "none");

                tooltip.style("visibility", "hidden");
            });

        // Overlay showing the user's data point if it exists
        if (latestUserPoint) {
            const userLimitCad = latestUserPoint.LIMIT_BAL / CAD_TO_NT;

            heat.append("circle")
                .attr("cx", x(latestUserPoint.AGE))
                .attr("cy", y(userLimitCad))
                .attr("r", 7)
                .style("fill", "#2ec4ff")
                .style("stroke", "#111")
                .style("stroke-width", 2);

            heat.append("text")
                .attr("x", x(latestUserPoint.AGE) + 10)
                .attr("y", y(userLimitCad) - 10)
                .style("font-size", "12px")
                .style("font-weight", "bold")
                .text("You!");
        }

        // Heatmap legend
        const legendHeight = 180;
        const legendWidth = 18;
        const legendX = heatWidth + 30;
        const legendY = 20;

        const defs = heatSvg.append("defs");

        const gradient = defs.append("linearGradient")
            .attr("id", "heatmap-gradient")
            .attr("x1", "0%")
            .attr("y1", "100%")
            .attr("x2", "0%")
            .attr("y2", "0%");

        d3.range(0, 1.01, 0.1).forEach(s => {
            gradient.append("stop")
                .attr("offset", `${s * 100}%`)
                .attr("stop-color", d3.interpolateYlOrRd(s));
        });

        const legendGroup = heatSvg.append("g")
            .attr("transform", `translate(${heatMargin.left + legendX},${heatMargin.top + legendY})`);

        legendGroup.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#heatmap-gradient)");

        const legendScale = d3.scaleLinear()
            .domain([0, maxBinCount])
            .range([legendHeight, 0]);

        const legendAxis = d3.axisRight(legendScale)
            .ticks(5)
            .tickFormat(d3.format(".0f"));

        legendGroup.append("g")
            .attr("transform", `translate(${legendWidth + 6},0)`)
            .call(legendAxis);

        legendGroup.append("text")
            .attr("x", legendWidth / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .style("font-weight", "600")
            .text("Density");

        // Bar chart section
        const educationOrder = ["High School", "University", "Grad School", "Others"];

        // group and compute stats
        const grouped = d3.rollups(
            filtered,
            values => ({
                total: values.length,
                defaults: values.filter(v => v.DEFAULT == "1").length,
                rate: values.filter(v => v.DEFAULT == "1").length / values.length
            }),
            d => getEducationLabel(d.EDUCATION)
        )
            .map(([label, stats]) => ({
                label,
                total: stats.total,
                defaults: stats.defaults,
                rate: stats.rate
            }))
            .sort((a, b) => educationOrder.indexOf(a.label) - educationOrder.indexOf(b.label));

        const barMargin = { top: 20, right: 20, bottom: 70, left: 65 };
        const barWidth = 360 - barMargin.left - barMargin.right;
        const barHeight = 380 - barMargin.top - barMargin.bottom;

        const barSvg = barWrap
            .append("svg")
            .attr("width", barWidth + barMargin.left + barMargin.right)
            .attr("height", barHeight + barMargin.top + barMargin.bottom);

        const bar = barSvg.append("g")
            .attr("transform", `translate(${barMargin.left},${barMargin.top})`);

        // Scaling for discrete categories (Education levels)
        const bx = d3.scaleBand()
            .domain(grouped.map(d => d.label))
            .range([0, barWidth])
            .padding(0.25);

        // Scaling for numerical values (the default rate)
        const by = d3.scaleLinear()
            .domain([0, Math.max(0.1, d3.max(grouped, d => d.rate) || 0)])
            .nice()
            .range([barHeight, 0]);

        // axis groups and titles
        bar.append("g")
            .attr("transform", `translate(0,${barHeight})`)
            .call(d3.axisBottom(bx))
            .selectAll("text")
            .attr("transform", "rotate(-20)")
            .style("text-anchor", "end");

        bar.append("g")
            .call(d3.axisLeft(by).tickFormat(d3.format(".0%")));

        bar.append("text")
            .attr("x", barWidth / 2)
            .attr("y", barHeight + 58)
            .attr("text-anchor", "middle")
            .style("font-weight", "600")
            .text("Education");

        bar.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -barHeight / 2)
            .attr("y", -45)
            .attr("text-anchor", "middle")
            .style("font-weight", "600")
            .text("Default Rate");

        bar.selectAll("rect.bar")
            .data(grouped)
            .join("rect")
            .attr("class", "bar")
            .attr("x", d => bx(d.label))
            .attr("y", d => by(d.rate))
            .attr("width", bx.bandwidth())
            .attr("height", d => barHeight - by(d.rate))
            .attr("fill", "#4d0026")
            .attr("opacity", 0.88)
            .on("mouseover", function (event, d) {
                d3.select(this).attr("opacity", 1);

                tooltip
                    .style("visibility", "visible")
                    .html(`
                        <strong>Total:</strong> ${d.total.toLocaleString()}<br>
                        <strong>Defaults:</strong> ${d.defaults.toLocaleString()}<br>
                        <strong>Education:</strong> ${d.label}<br>
                        <strong>Default Rate:</strong> ${(d.rate * 100).toFixed(1)}%
                
                    `);
            })
            .on("mousemove", function (event) {
                tooltip
                    .style("top", `${event.pageY - 10}px`)
                    .style("left", `${event.pageX + 12}px`);
            })
            .on("mouseout", function () {
                d3.select(this).attr("opacity", 0.88);
                tooltip.style("visibility", "hidden");
            });
    }

    if (educationFilter) {
        educationFilter.onchange = renderDashboard;
    }

    if (defaultFilter) {
        defaultFilter.onchange = renderDashboard;
    }

    renderDashboard();
}