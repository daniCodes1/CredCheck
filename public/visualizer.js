/*
D3 dashboard built using common data-driven patterns such as data joins,
the .join() aka enter/update/exit workflow, reusable render/update functions,
and basic event handlers for interactivity and linked highlighting.
*/

let latestUserPoint = null;
let dashboardVis = null;

function setLatestUserPoint(point) {
    latestUserPoint = point;

    if (dashboardVis) {
        dashboardVis.updateVis();
    }
}

function getEducationLabel(value) {
    if (value == "1") return "Grad School";
    if (value == "2") return "University";
    if (value == "3") return "High School";
    return "Others";
}

function getRepaymentStatusLabel(status) { // Convert to human-readable values
    if (status === -1 || status === 0) return "Paid on time";
    if (status === 9) return "9+ months late";
    if (status === 1) return "1 month late";
    return `${status} months late`;
}

class CreditDashboardVis {
    constructor(parentElement) {
        this.parentElement = parentElement;
        this.CAD_TO_NT = 23.06;
        this.data = [];
    }

    async initVis() {
        const vis = this;

        vis.container = d3.select(vis.parentElement);
        vis.container.selectAll("*").remove();

        d3.selectAll(".d3-tooltip").remove();

        vis.tooltip = d3.select("body")
            .append("div")
            .attr("class", "d3-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "rgba(0,0,0,0.8)")
            .style("color", "#fff")
            .style("padding", "10px")
            .style("border-radius", "6px");

        try {
            // const rawData = await fetch("http://127.0.0.1:8000/api/data").then(r => r.json());
            const rawData = await fetch("/api/data").then(r => r.json());
            vis.data = rawData.map(d => ({
                AGE: +d.AGE,
                PAY_0: +d.PAY_0,
                LIMIT_BAL_CAD: +d.LIMIT_BAL_CAD,
                EDUCATION: String(d.EDUCATION),
                DEFAULT: String(d["default.payment.next.month"]),
                PAY_TO_BILL_TOTAL: +d.pay_to_bill_total,
                UTIL_MEAN: +d.util_mean
            }));
        } catch (err) {
            console.error("Error loading CSV:", err);
            vis.container.append("p").text("Sorry! Could not load chart data.");
            return;
        }

        // Create the layout
        vis.cardsWrap = vis.container.append("div")
            .attr("class", "viz-cards");

        vis.topGrid = vis.container.append("div")
            .attr("class", "viz-grid");

        vis.heatmapPanel = vis.topGrid.append("div")
            .attr("class", "viz-layout");

        vis.educationPanel = vis.topGrid.append("div")
            .attr("class", "viz-layout");

        vis.bottomGrid = vis.container.append("div")
            .style("display", "grid")
            .style("grid-template-columns", "1fr 1.45fr")
            .style("gap", "22px")
            .style("margin-top", "24px");

        vis.repayPanel = vis.bottomGrid.append("div")
            .attr("class", "viz-layout");

        vis.summaryPanel = vis.bottomGrid.append("div")
            .attr("class", "viz-layout");

        // Heatmap filters
        vis.heatHeader = vis.heatmapPanel.append("div")
            .attr("class", "viz-panel-header");

        const heatTitleBlock = vis.heatHeader.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "6px");

        heatTitleBlock.append("h3")
            .attr("class", "viz-title")
            .text("Age vs Credit Limit Density");
        heatTitleBlock.append("span")
            .attr("class", "tooltip-container")
            .html(`
            <span class="info-icon">ⓘ</span>
            <div class="tooltip-text">
            <strong>Why a heatmap?</strong><br>
            This view aggregates observations into 2D bins to reduce overplotting
            and reveal the distribution across age and credit limit. Bin count is
            encoded with a sequential color scale, which is appropriate for an
            ordered quantitative attribute such as density.
            </div>
            `);

        vis.heatHeader.append("p")
            .attr("class", "viz-subtitle")
            .text("Filters below apply only to this heatmap.");

        vis.heatFilters = vis.heatHeader.append("div")
            .attr("class", "chart-filters heatmap-filters");

        vis.heatFilters.append("label")
            .attr("for", "heatmap-education-filter")
            .text("Education:");

        vis.educationFilter = vis.heatFilters.append("select")
            .attr("id", "heatmap-education-filter");

        vis.educationFilter.selectAll("option")
            .data([
                { value: "all", label: "All" },
                { value: "1", label: "Grad School" },
                { value: "2", label: "University" },
                { value: "3", label: "High School" },
                { value: "4", label: "Others" }
            ])
            .join("option")
            .attr("value", d => d.value)
            .text(d => d.label);

        vis.heatFilters.append("label")
            .attr("for", "heatmap-default-filter")
            .text("Outcome:");

        vis.defaultFilter = vis.heatFilters.append("select")
            .attr("id", "heatmap-default-filter");

        vis.defaultFilter.selectAll("option")
            .data([
                { value: "all", label: "All" },
                { value: "0", label: "Non-default" },
                { value: "1", label: "Default" }
            ])
            .join("option")
            .attr("value", d => d.value)
            .text(d => d.label);

        vis.educationFilter.on("change", () => vis.updateVis());
        vis.defaultFilter.on("change", () => vis.updateVis());

        // Chart titles and info buttons (heatmap was added separately above)
        const eduTitle = vis.educationPanel.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "6px");

        eduTitle.append("h3")
            .attr("class", "viz-title")
            .text("Default Rate by Education");

        eduTitle.append("span")
            .attr("class", "tooltip-container")
            .html(`
            <span class="info-icon">ⓘ</span>
            <div class="tooltip-text">
            <strong>Why a bar chart?</strong><br>
            Bar charts compare categorical groups using length on a common scale,
            which is one of the most accurate visual encodings for comparing
            magnitudes across categories.
            </div>
            `);

        const repayTitle = vis.repayPanel.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "6px");

        repayTitle.append("h3")
            .attr("class", "viz-title")
            .text("Default Rate by Repayment Status (PAY_0)");

        repayTitle.append("span")
            .attr("class", "tooltip-container")
            .html(`
        <span class="info-icon">ⓘ</span>
        <div class="tooltip-text">
        <strong>About this view</strong><br>
        Bars support comparison across categorical repayment groups because
        length on a common scale makes differences in default rate easy to judge.
        Hover interaction adds linked highlighting across views, so the selected
        group is emphasized while others are de-emphasized. The chart focuses on
        a single attribute to reduce cognitive load and keep comparisons clear.
        </div>
`);

        const summaryTitle = vis.summaryPanel.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "6px");

        summaryTitle.append("h3")
            .attr("class", "viz-title")
            .text("Repayment Groups with Lowest / Highest Avg Credit Utilization");

        summaryTitle.append("span")
            .attr("class", "tooltip-container")
            .html(`
            <span class="info-icon">ⓘ</span>
            <div class="tooltip-text">
            <strong>Why small multiples?</strong><br>
            Small multiples repeat the same encoding across subsets, supporting
            side-by-side comparison while keeping scales and structure consistent.
            This makes differences between low and high utilization groups easier to see.
            </div>
            `);

        // Heatmap svg
        vis.heatMargin = { top: 20, right: 70, bottom: 60, left: 75 };
        vis.heatWidth = 560 - vis.heatMargin.left - vis.heatMargin.right;
        vis.heatHeight = 380 - vis.heatMargin.top - vis.heatMargin.bottom;

        vis.heatmapChartWrap = vis.heatmapPanel.append("div")
            .attr("class", "heatmap-chart-area");

        vis.heatSvg = vis.heatmapChartWrap.append("svg")
            .attr("width", vis.heatWidth + vis.heatMargin.left + vis.heatMargin.right + 35)
            .attr("height", vis.heatHeight + vis.heatMargin.top + vis.heatMargin.bottom);

        vis.heat = vis.heatSvg.append("g")
            .attr("transform", `translate(${vis.heatMargin.left},${vis.heatMargin.top})`);

        vis.heatXAxisGroup = vis.heat.append("g")
            .attr("transform", `translate(0,${vis.heatHeight})`);

        vis.heatYAxisGroup = vis.heat.append("g");

        vis.heatCellGroup = vis.heat.append("g");
        vis.heatUserGroup = vis.heat.append("g");

        vis.heat.append("text")
            .attr("x", vis.heatWidth / 2)
            .attr("y", vis.heatHeight + 45)
            .attr("text-anchor", "middle")
            .style("font-weight", "600")
            .text("Age");

        vis.heat.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -vis.heatHeight / 2)
            .attr("y", -50)
            .attr("text-anchor", "middle")
            .style("font-weight", "600")
            .text("Credit Limit (CAD$)");

        // Heatmap legend (bottom to up)
        const defs = vis.heatSvg.append("defs");

        const gradient = defs.append("linearGradient")
            .attr("id", "heatmap-gradient")
            .attr("x1", "0%")
            .attr("y1", "100%")
            .attr("x2", "0%")
            .attr("y2", "0%");

        // 10 steps in the gradient 
        d3.range(0, 1.01, 0.1).forEach(s => {
            gradient.append("stop")
                .attr("offset", `${s * 100}%`)
                .attr("stop-color", d3.interpolateYlOrRd(s)); // Scale is: Yellow, orange, red
        });

        const legendHeight = 180;
        const legendWidth = 18;
        const legendX = vis.heatWidth + 30;
        const legendY = 20;

        vis.legendScale = d3.scaleLinear()
            .range([legendHeight, 0]);

        vis.legendGroup = vis.heatSvg.append("g")
            .attr("transform", `translate(${vis.heatMargin.left + legendX},${vis.heatMargin.top + legendY})`);

        vis.legendGroup.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#heatmap-gradient)");

        vis.legendAxisGroup = vis.legendGroup.append("g")
            .attr("transform", `translate(${legendWidth + 6},0)`);

        vis.legendGroup.append("text")
            .attr("x", legendWidth / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .style("font-weight", "600")
            .text("Density");

        // Education panel
        vis.barMargin = { top: 20, right: 20, bottom: 70, left: 65 };
        vis.barWidth = 360 - vis.barMargin.left - vis.barMargin.right;
        vis.barHeight = 380 - vis.barMargin.top - vis.barMargin.bottom;

        vis.barSvg = vis.educationPanel.append("svg")
            .attr("width", vis.barWidth + vis.barMargin.left + vis.barMargin.right)
            .attr("height", vis.barHeight + vis.barMargin.top + vis.barMargin.bottom);

        vis.bar = vis.barSvg.append("g")
            .attr("transform", `translate(${vis.barMargin.left},${vis.barMargin.top})`);

        vis.barXAxisGroup = vis.bar.append("g")
            .attr("transform", `translate(0,${vis.barHeight})`);

        vis.barYAxisGroup = vis.bar.append("g");

        vis.barMarksGroup = vis.bar.append("g");

        vis.bar.append("text")
            .attr("x", vis.barWidth / 2)
            .attr("y", vis.barHeight + 58)
            .attr("text-anchor", "middle")
            .style("font-weight", "600")
            .text("Education");

        vis.bar.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -vis.barHeight / 2)
            .attr("y", -45)
            .attr("text-anchor", "middle")
            .style("font-weight", "600")
            .text("Default Rate");

        // Repayment chart
        vis.repayMargin = { top: 20, right: 20, bottom: 60, left: 65 };
        vis.repayWidth = 360 - vis.repayMargin.left - vis.repayMargin.right;
        vis.repayHeight = 320 - vis.repayMargin.top - vis.repayMargin.bottom;

        vis.repaySvg = vis.repayPanel.append("svg")
            .attr("width", vis.repayWidth + vis.repayMargin.left + vis.repayMargin.right)
            .attr("height", vis.repayHeight + vis.repayMargin.top + vis.repayMargin.bottom);

        vis.repay = vis.repaySvg.append("g")
            .attr("transform", `translate(${vis.repayMargin.left},${vis.repayMargin.top})`);

        vis.repayXAxisGroup = vis.repay.append("g")
            .attr("transform", `translate(0,${vis.repayHeight})`);

        vis.repayYAxisGroup = vis.repay.append("g");

        vis.repayMarksGroup = vis.repay.append("g");

        vis.repay.append("text")
            .attr("x", vis.repayWidth / 2)
            .attr("y", vis.repayHeight + 42)
            .attr("text-anchor", "middle")
            .style("font-weight", "600")
            .text("Repayment Status (PAY_0)");

        vis.repay.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -vis.repayHeight / 2)
            .attr("y", -45)
            .attr("text-anchor", "middle")
            .style("font-weight", "600")
            .text("Default Rate");

        // Summary mini chart
        vis.miniGrid = vis.summaryPanel.append("div")
            .style("display", "grid")
            .style("grid-template-columns", "1fr 1fr")
            .style("gap", "18px");

        vis.lowWrap = vis.miniGrid.append("div");
        vis.highWrap = vis.miniGrid.append("div");

        vis.lowWrap.append("h4")
            .style("margin", "0 0 6px 0")
            .style("color", "#2c3e50")
            .text("Lowest Avg Utilization");

        vis.highWrap.append("h4")
            .style("margin", "0 0 6px 0")
            .style("color", "#2c3e50")
            .text("Highest Avg Utilization");

        vis.initMiniChart("low");
        vis.initMiniChart("high");

        vis.updateVis();
    }

    initMiniChart(type) {
        const vis = this;

        const margin = { top: 20, right: 12, bottom: 55, left: 55 };
        const width = 250 - margin.left - margin.right;
        const height = 260 - margin.top - margin.bottom;

        const wrap = type === "low" ? vis.lowWrap : vis.highWrap;

        const svg = wrap.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        g.append("g")
            .attr("class", `${type}-x-axis`)
            .attr("transform", `translate(0,${height})`);

        g.append("g")
            .attr("class", `${type}-y-axis`);

        g.append("g").attr("class", `${type}-stem-group`);
        g.append("g").attr("class", `${type}-dot-group`);
        g.append("g").attr("class", `${type}-label-group`);

        g.append("text")
            .attr("x", width / 2)
            .attr("y", height + 38)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .style("font-weight", "600")
            .text("PAY_0");

        g.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -38)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .style("font-weight", "600")
            .text("Default Rate");

        // Final chart configuration for the specified chart type 
        vis[`${type}Mini`] = { svg, g, width, height, margin };
    }


    // Update visualization state
    // Most charts follow the same pattern: compute summary statistics from the data,
    // store them in objects (such as counts, rates, averages), then update scales and pass
    // the results to renderVis() to draw the charts.
    updateVis() {
        const vis = this;

        if (!vis.data.length) return;

        // Heatmap filtered data
        const educationValue = vis.educationFilter.node().value;
        const defaultValue = vis.defaultFilter.node().value;

        vis.heatmapFilteredData = vis.data.filter(d => {
            const matchesEducation = educationValue === "all" || d.EDUCATION == educationValue;
            const matchesDefault = defaultValue === "all" || d.DEFAULT == defaultValue;
            return matchesEducation && matchesDefault;
        });

        //Data for KPI
        vis.cardData = [
            { label: "Clients", value: vis.data.length.toLocaleString() },
            { label: "Default Rate", value: `${((vis.data.filter(d => d.DEFAULT == "1").length / vis.data.length) * 100).toFixed(1)}%` },
            { label: "Average Age", value: d3.mean(vis.data, d => d.AGE).toFixed(1) },
            { label: "Avg Credit Limit", value: `${d3.format(",.0f")(d3.mean(vis.data, d => d.LIMIT_BAL_CAD))} CAD$` }
        ];

        // Heatmap scales and bins
        vis.x = d3.scaleLinear()
            .domain(d3.extent(vis.data, d => d.AGE))
            .nice()
            .range([0, vis.heatWidth]);

        vis.y = d3.scaleLinear()
            .domain([0, d3.max(vis.data, d => d.LIMIT_BAL_CAD)])
            .nice()
            .range([vis.heatHeight, 0]);

        vis.heatBins = [];

        if (vis.heatmapFilteredData.length > 0) {
            const ageBins = d3.bin()
                .value(d => d.AGE)
                .domain(vis.x.domain())
                .thresholds(18);

            const limitBins = d3.bin()
                .value(d => d.LIMIT_BAL_CAD)
                .domain(vis.y.domain())
                .thresholds(14);

            const ageBinned = ageBins(vis.heatmapFilteredData);
            const limitBinned = limitBins(vis.heatmapFilteredData);

            const ageThresholds = ageBinned.map(bin => bin.x0);
            ageThresholds.push(ageBinned[ageBinned.length - 1].x1);

            const limitThresholds = limitBinned.map(bin => bin.x0);
            limitThresholds.push(limitBinned[limitBinned.length - 1].x1);

            for (let i = 0; i < ageThresholds.length - 1; i++) {
                for (let j = 0; j < limitThresholds.length - 1; j++) {
                    const x0 = ageThresholds[i];
                    const x1 = ageThresholds[i + 1];
                    const y0 = limitThresholds[j];
                    const y1 = limitThresholds[j + 1];

                    // Get the data points that belong to this heat map cell
                    const points = vis.heatmapFilteredData.filter(d =>
                        d.AGE >= x0 && d.AGE < x1 &&
                        d.LIMIT_BAL_CAD >= y0 && d.LIMIT_BAL_CAD < y1
                    );
                    // For each cell: get the boudnaries, the count, default rates
                    vis.heatBins.push({
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
        }

        // For the max/min density for the colour scale
        vis.maxBinCount = d3.max(vis.heatBins, d => d.count) || 1;

        vis.heatColor = d3.scaleSequential()
            .domain([0, vis.maxBinCount])
            .interpolator(d3.interpolateYlOrRd);

        // vis.legendScale.domain([0, vis.maxBinCount]);
        const legendMax = Math.ceil(vis.maxBinCount / 100) * 100;
        vis.legendScale.domain([0, legendMax]);

        const educationOrder = ["High School", "University", "Grad School", "Others"];

        // For each education group, get: total # of clients, default count, and the rate, and
        // then turn it into an object to be used
        vis.educationGrouped = d3.rollups(
            vis.data,
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

        // Scales (categorical for education)
        vis.bx = d3.scaleBand()
            .domain(vis.educationGrouped.map(d => d.label))
            .range([0, vis.barWidth])
            .padding(0.25);

        vis.by = d3.scaleLinear()
            .domain([0, Math.max(0.1, d3.max(vis.educationGrouped, d => d.rate) || 0)])
            .nice()
            .range([vis.barHeight, 0]);

        // Repayment stats
        // Loop over possible repayment statuses and compute summary values for each group
        const repaymentOrder = d3.range(-2, 9);

        vis.repaymentStats = repaymentOrder.map(status => {
            const values = vis.data.filter(d => d.PAY_0 === status);
            const total = values.length;
            const defaults = values.filter(v => v.DEFAULT == "1").length;
            const avgUtil = total ? d3.mean(values, v => v.UTIL_MEAN) : null;

            return {
                status,
                total,
                defaults,
                avgUtil,
                rate: total ? defaults / total : 0
            };
        }).filter(d => d.total > 0 && Number.isFinite(d.avgUtil));

        vis.rx = d3.scaleBand()
            .domain(vis.repaymentStats.map(d => d.status))
            .range([0, vis.repayWidth])
            .padding(0.2);

        vis.ry = d3.scaleLinear()
            .domain([0, Math.max(0.1, d3.max(vis.repaymentStats, d => d.rate) || 0)])
            .nice()
            .range([vis.repayHeight, 0]);

        const sortedByUtil = [...vis.repaymentStats].sort((a, b) => a.avgUtil - b.avgUtil); // prevent JS sorting lexicographically
        const topN = Math.min(4, vis.repaymentStats.length);

        vis.lowestUtilStats = sortedByUtil.slice(0, topN);
        vis.highestUtilStats = sortedByUtil.slice(-topN);

        vis.updateMiniScales("low", vis.lowestUtilStats);
        vis.updateMiniScales("high", vis.highestUtilStats);

        vis.renderVis();
    }

    // Scales for each selected mini chart 
    updateMiniScales(type, chartData) {
        const vis = this;
        const mini = vis[`${type}Mini`];

        mini.x = d3.scaleBand()
            .domain(chartData.map(d => d.status))
            .range([0, mini.width])
            .padding(0.35);

        mini.y = d3.scaleLinear()
            .domain([0, Math.max(0.8, d3.max(chartData, d => d.rate) || 0)])
            .nice()
            .range([mini.height, 0]);
    }

    renderVis() {
        const vis = this;

        vis.renderCards();
        vis.renderHeatmap();
        vis.renderEducationChart();
        vis.renderRepaymentChart();
        vis.renderMiniChart("low", vis.lowestUtilStats);
        vis.renderMiniChart("high", vis.highestUtilStats);
    }

    renderCards() {
        const vis = this;

        const cards = vis.cardsWrap.selectAll(".viz-card")
            .data(vis.cardData)
            .join("div")
            .attr("class", "viz-card");

        cards.selectAll(".viz-card-value")
            .data(d => [d])
            .join("div")
            .attr("class", "viz-card-value")
            .text(d => d.value);

        cards.selectAll(".viz-card-label")
            .data(d => [d])
            .join("div")
            .attr("class", "viz-card-label")
            .text(d => d.label);
    }

    renderHeatmap() {
        const vis = this;

        vis.heatXAxisGroup.call(d3.axisBottom(vis.x));
        vis.heatYAxisGroup.call(d3.axisLeft(vis.y).tickFormat(d3.format(",.0f")));
        // vis.legendAxisGroup.call(d3.axisRight(vis.legendScale).ticks(6).tickFormat(d3.format(".0f")));
        vis.legendAxisGroup.call(
            d3.axisRight(vis.legendScale)
                .ticks(6)
                .tickSize(0)
                .tickPadding(3)
                .tickFormat(d3.format(".0f"))
        );

        vis.legendAxisGroup.select(".domain").remove();

        const noData = vis.heatmapChartWrap.selectAll(".heatmap-empty-message")
            .data(vis.heatmapFilteredData.length === 0 ? [1] : []) // bind one item when no data so join() creates the "no data" message            
            .join("p")
            .attr("class", "heatmap-empty-message")
            .style("font-weight", "600")
            .style("color", "#666")
            .text("No matching data for this heatmap filter");

        if (vis.heatmapFilteredData.length === 0) {
            vis.heatCellGroup.selectAll(".heat-cell").remove();
            vis.heatUserGroup.selectAll("*").remove();
            return;
        } else {
            noData.remove(); // And then continue on
        }

        vis.heatCellGroup.selectAll(".heat-cell")
            .data(vis.heatBins.filter(d => d.count > 0), d => `${d.x0}-${d.x1}-${d.y0}-${d.y1}`)
            .join("rect")
            .attr("class", "heat-cell")
            .attr("x", d => vis.x(d.x0))
            .attr("y", d => vis.y(d.y1))
            .attr("width", d => Math.max(0, vis.x(d.x1) - vis.x(d.x0) - 1))
            .attr("height", d => Math.max(0, vis.y(d.y0) - vis.y(d.y1) - 1))
            .attr("fill", d => vis.heatColor(d.count))
            .attr("opacity", 0.9)
            .on("mouseover", function (event, d) {
                d3.select(this)
                    .attr("stroke", "#111")
                    .attr("stroke-width", 1.5);

                vis.showTooltip(`
                    <strong>Clients:</strong> ${d.count.toLocaleString()}<br>
                    <strong>Default Rate:</strong> ${(d.defaultRate * 100).toFixed(1)}%<br>
                    <strong>Age Range:</strong> ${Math.round(d.x0)}–${Math.round(d.x1)}<br>
                    <strong>Credit Limit Range:</strong> ${d3.format(",.0f")(d.y0)}–${d3.format(",.0f")(d.y1)} CAD$
                `);
            })
            .on("mousemove", event => vis.moveTooltip(event))
            .on("mouseout", function () {
                d3.select(this).attr("stroke", "none");
                vis.hideTooltip();
            });

        vis.renderUserPoint();
    }

    // Render a point to show where the user is, provided they submitted a prediction request already
    renderUserPoint() {
        const vis = this;

        vis.heatUserGroup.selectAll("*").remove();

        if (!latestUserPoint) return;
        if (!vis.heatmapFilteredData.length) return;

        const userLimitCad = latestUserPoint.LIMIT_BAL / vis.CAD_TO_NT;

        vis.heatUserGroup.append("circle")
            .attr("cx", vis.x(latestUserPoint.AGE))
            .attr("cy", vis.y(userLimitCad))
            .attr("r", 7)
            .style("fill", "#2ec4ff")
            .style("stroke", "#111")
            .style("stroke-width", 2);

        vis.heatUserGroup.append("text")
            .attr("x", vis.x(latestUserPoint.AGE) + 10)
            .attr("y", vis.y(userLimitCad) - 10)
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .style("fill", "#2ec4ff")
            .style("stroke", "white")
            .style("stroke-width", 3)
            .style("paint-order", "stroke")
            .text("You!");
    }

    renderEducationChart() {
        const vis = this;

        vis.barXAxisGroup
            .call(d3.axisBottom(vis.bx))
            .selectAll("text")
            .attr("transform", "rotate(-20)")
            .style("text-anchor", "end");

        vis.barYAxisGroup.call(d3.axisLeft(vis.by).tickFormat(d3.format(".0%")));

        vis.barMarksGroup.selectAll(".bar")
            .data(vis.educationGrouped, d => d.label)
            .join("rect")
            .attr("class", "bar")
            .attr("x", d => vis.bx(d.label))
            .attr("y", d => vis.by(d.rate))
            .attr("width", vis.bx.bandwidth())
            .attr("height", d => vis.barHeight - vis.by(d.rate))
            .attr("fill", "#4d0026")
            .attr("opacity", 0.88)
            .on("mouseover", function (event, d) {
                d3.select(this).attr("opacity", 1);

                vis.showTooltip(`
                    <strong>Total:</strong> ${d.total.toLocaleString()}<br>
                    <strong>Defaults:</strong> ${d.defaults.toLocaleString()}<br>
                    <strong>Education:</strong> ${d.label}<br>
                    <strong>Default Rate:</strong> ${(d.rate * 100).toFixed(1)}%
                `);
            })
            .on("mousemove", event => vis.moveTooltip(event))
            .on("mouseout", function () {
                d3.select(this).attr("opacity", 0.88);
                vis.hideTooltip();
            });
    }

    renderRepaymentChart() {
        const vis = this;

        vis.repayXAxisGroup.call(d3.axisBottom(vis.rx));
        vis.repayYAxisGroup.call(d3.axisLeft(vis.ry).tickFormat(d3.format(".0%")));

        vis.repayMarksGroup.selectAll(".repay-bar")
            .data(vis.repaymentStats, d => d.status)
            .join("rect")
            .attr("class", "repay-bar")
            .attr("x", d => vis.rx(d.status))
            .attr("y", d => vis.ry(d.rate))
            .attr("width", vis.rx.bandwidth())
            .attr("height", d => vis.repayHeight - vis.ry(d.rate))
            .attr("fill", "#4d0026")
            .attr("opacity", 0.88)
            .style("cursor", "pointer")
            .on("mouseover", function (event, d) {
                vis.highlightStatus(d.status);

                vis.showTooltip(`
                    <strong>PAY_0:</strong> ${getRepaymentStatusLabel(d.status)}<br>
                    <strong>Clients:</strong> ${d.total.toLocaleString()}<br>
                    <strong>Defaults:</strong> ${d.defaults.toLocaleString()}<br>
                    <strong>Default Rate:</strong> ${(d.rate * 100).toFixed(1)}%<br>
                    <strong>Avg Utilization:</strong> ${(d.avgUtil * 100).toFixed(1)}%
                `);
            })
            .on("mousemove", event => vis.moveTooltip(event))
            .on("mouseout", () => {
                vis.resetLinkedState();
                vis.hideTooltip();
            });
    }

    renderMiniChart(type, chartData) {
        const vis = this;
        const mini = vis[`${type}Mini`]; // get the mini chart config made previously

        mini.g.select(`.${type}-x-axis`)
            .call(d3.axisBottom(mini.x));

        mini.g.select(`.${type}-y-axis`)
            .call(d3.axisLeft(mini.y).ticks(5).tickFormat(d3.format(".0%")));
        // Draw the vertical stem line for each status
        mini.g.select(`.${type}-stem-group`)
            .selectAll(`.${type}-stem`)
            .data(chartData, d => d.status)
            .join("line")
            .attr("class", `${type}-stem`)
            .attr("x1", d => mini.x(d.status) + mini.x.bandwidth() / 2)
            .attr("x2", d => mini.x(d.status) + mini.x.bandwidth() / 2) // Line is vertical
            .attr("y1", mini.height) // Start
            .attr("y2", d => mini.y(d.rate)) // End
            .attr("stroke", "#cbd5e1")
            .attr("stroke-width", 2);

        // Draw one dot per repayment group, positioned at default rate
        mini.g.select(`.${type}-dot-group`)
            .selectAll(`.${type}-dot`)
            .data(chartData, d => d.status)
            .join("circle")
            .attr("class", `${type}-dot summary-dot`)
            .attr("cx", d => mini.x(d.status) + mini.x.bandwidth() / 2)
            .attr("cy", d => mini.y(d.rate))
            .attr("r", 7)
            .attr("fill", "#0ea5a4")
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .style("cursor", "pointer")
            .on("mouseover", (event, d) => {
                vis.highlightStatus(d.status);

                vis.showTooltip(`
                    <strong>PAY_0:</strong> ${getRepaymentStatusLabel(d.status)}<br>
                    <strong>Avg Utilization:</strong> ${(d.avgUtil * 100).toFixed(1)}%<br>
                    <strong>Default Rate:</strong> ${(d.rate * 100).toFixed(1)}%<br>
                    <strong>Clients:</strong> ${d.total.toLocaleString()}
                `);
            })
            .on("mousemove", event => vis.moveTooltip(event))
            .on("mouseout", () => {
                vis.resetLinkedState();
                vis.hideTooltip();
            });

        // Draw the text labels above each dot 
        mini.g.select(`.${type}-label-group`)
            .selectAll(`.${type}-rate-label`)
            .data(chartData, d => d.status)
            .join("text")
            .attr("class", `${type}-rate-label`)
            .attr("x", d => mini.x(d.status) + mini.x.bandwidth() / 2)
            .attr("y", d => mini.y(d.rate) - 16)
            .attr("text-anchor", "middle")
            .each(function (d) {
                const text = d3.select(this);
                text.selectAll("*").remove();

                // Average utilization
                text.append("tspan")
                    .attr("x", mini.x(d.status) + mini.x.bandwidth() / 2)
                    .attr("dy", "0em")
                    .style("font-size", "9px")
                    .style("font-weight", "500")
                    .style("fill", "#64748b")
                    .text(`${(d.avgUtil * 100).toFixed(0)}%`);
                // For explanation purposes 
                text.append("tspan")
                    .attr("x", mini.x(d.status) + mini.x.bandwidth() / 2)
                    .attr("dy", "0.9em")
                    .style("font-size", "9px")
                    .style("font-weight", "500")
                    .style("fill", "#64748b")
                    .text(" credit used");
            });
    }

    // Undo linked highlighting when moouse moves away from the dot
    resetLinkedState() {
        const vis = this;

        vis.repayMarksGroup.selectAll(".repay-bar")
            .attr("opacity", 0.88)
            .attr("stroke", "none");

        vis.summaryPanel.selectAll(".summary-dot")
            .attr("opacity", 1)
            .attr("r", 7)
            .attr("stroke", "white")
            .attr("stroke-width", 2);
    }

    // Used when users hover over either the repayment chart or a summary dot in any mini chart
    highlightStatus(status) {
        const vis = this;

        vis.repayMarksGroup.selectAll(".repay-bar")
            .attr("opacity", d => d.status === status ? 1 : 0.22)
            .attr("stroke", d => d.status === status ? "#111" : "none")
            .attr("stroke-width", d => d.status === status ? 1.5 : 0);

        vis.summaryPanel.selectAll(".summary-dot")
            .attr("opacity", d => d.status === status ? 1 : 0.2)
            .attr("r", d => d.status === status ? 9 : 7)
            .attr("stroke", d => d.status === status ? "#111" : "white")
            .attr("stroke-width", d => d.status === status ? 2.2 : 2);
    }

    // Tooltip helpers
    showTooltip(html) {
        this.tooltip
            .style("visibility", "visible")
            .html(html);
    }

    moveTooltip(event) {
        this.tooltip
            .style("top", `${event.pageY - 10}px`)
            .style("left", `${event.pageX + 12}px`);
    }

    hideTooltip() {
        this.tooltip.style("visibility", "hidden");
    }
}

async function renderD3Visualizer() {
    if (!dashboardVis) {
        dashboardVis = new CreditDashboardVis("#d3-container");
        await dashboardVis.initVis();
    } else {
        dashboardVis.updateVis();
    }
}

