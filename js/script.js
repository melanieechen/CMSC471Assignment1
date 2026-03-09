
// margins and measurements
const margin = { top: 80, right: 60, bottom: 60, left: 100 };
const width = 800 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const tooltip = d3.select('#tooltip');

// global variables 
let usData = [];
let weatherData = [];
let stations = [];
let currentMetric = "TAVG"; 
let activeStation = null;  

// creating the actual SVG 
const svg = d3.select('#vis')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

const mapG = svg.append('g').attr('class', 'map-layer');

const outerSvg = d3.select('#vis svg');

// ----- Detail (line chart) setup -----
const detailMargin = { top: 40, right: 30, bottom: 50, left: 60 };
const detailWidth = 800 - detailMargin.left - detailMargin.right;
const detailHeight = 300 - detailMargin.top - detailMargin.bottom;

const detailSvg = d3.select("#detailVis")
  .append("svg")
  .attr("width", detailWidth + detailMargin.left + detailMargin.right)
  .attr("height", detailHeight + detailMargin.top + detailMargin.bottom);

const detailG = detailSvg.append("g")
  .attr("transform", `translate(${detailMargin.left},${detailMargin.top})`);

const xAxisG = detailG.append("g")
  .attr("transform", `translate(0,${detailHeight})`);

const yAxisG = detailG.append("g");

detailG.append("text")
  .attr("class", "x-label")
  .attr("x", detailWidth / 2)
  .attr("y", detailHeight + 40)
  .attr("text-anchor", "middle")
  .text("Date");

const yLabel = detailG.append("text")
  .attr("class", "y-label")
  .attr("transform", "rotate(-90)")
  .attr("x", -detailHeight / 2)
  .attr("y", -45)
  .attr("text-anchor", "middle")
  .text("TAVG");

const linePath = detailG.append("path")
  .attr("fill", "none")
  .attr("stroke", "steelblue")
  .attr("stroke-width", 2);

const zoom = d3.zoom()
  .scaleExtent([1, 8]) // min/max zoom
  .on('zoom', (event) => {
    mapG.attr('transform', event.transform);
  });

outerSvg.call(zoom);

// Reset button functionality
d3.select('#resetZoom').on('click', () => {
    outerSvg
        .transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
});

// set up USA projection 
const projection = d3.geoAlbersUsa()
    .translate([width / 2, height / 2])
    .scale(1000);

const path = d3.geoPath()
    .projection(projection);

// initializing everything  
function init(){

  Promise.all([
      d3.json("data/geoUS.json"),
      d3.csv("data/weather.csv")
  ])
  .then(([us, weather]) => {

      usData = us;
      weatherData = weather;

      weatherData.forEach(d => {
  // date is like "20170312"
  d.dateObj = d3.timeParse("%Y%m%d")(d.date);

  // numeric fields (empty string => NaN)
  d.TAVG = d.TAVG === "" ? NaN : +d.TAVG;
  d.TMIN = d.TMIN === "" ? NaN : +d.TMIN;
  d.TMAX = d.TMAX === "" ? NaN : +d.TMAX;
  d.PRCP = d.PRCP === "" ? NaN : +d.PRCP;
  d.SNOW = d.SNOW === "" ? NaN : +d.SNOW;
  d.SNWD = d.SNWD === "" ? NaN : +d.SNWD;
  d.AWND = d.AWND === "" ? NaN : +d.AWND;
  d.WSF5 = d.WSF5 === "" ? NaN : +d.WSF5;
  d.WDF5 = d.WDF5 === "" ? NaN : +d.WDF5;
});

      processStations();
      updateMap();
      updateVis();

  })

// dropdown 
d3.selectAll('.weather-metric')
    .on("change", function (event) {
        const selectedValue = d3.select(this).property("value");
        const dropdownId = d3.select(this).property("id");

        console.log("Changed:", dropdownId, "to", selectedValue);

        if (dropdownId === "metricSelect") {
            currentMetric = selectedValue;
        }

        updateVis();

        if (activeStation) {
            renderDetailChart(activeStation, currentMetric);
        }
    });


}

window.addEventListener('load', init);

// processing all the stations onto the map 
function processStations(){

  stations = Array.from(
      d3.group(weatherData, d => d.station),
      ([key, values]) => ({
          station: key,
          state: values[0].state,
          latitude: +values[0].latitude,
          longitude: +values[0].longitude,
          PRCP: d3.mean(values, d => +d.PRCP || 0),
          SNOW: d3.mean(values, d => +d.SNOW || 0),
          TAVG: d3.mean(values.filter(d => d.TAVG !== ""), d => +d.TAVG)
      })
  );

  console.log("Unique stations:", stations.length);

}

// drawing the map 
function updateMap(){
  mapG.selectAll('.states')
      .data(usData.features)
      .join('path')
      .attr('class', 'states')
      .attr('d', path)
      .attr('fill', '#ccc')
      .attr('stroke', '#999');
}


function updateLegend(colorScale) {
    const legendWidth = 300;
    const legendHeight = 15;
    
    d3.select("#legend-svg").selectAll("*").remove();
    
    // draw legend
    const svg = d3.select("#legend-svg")
        .append("svg")
        .attr("width", legendWidth + 40)
        .attr("height", legendHeight + 30)
        .append("g")
        .attr("transform", "translate(20,10)");

    // create gradient
    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "linear-gradient");

    linearGradient.selectAll("stop")
        .data(d3.range(0, 1.1, 0.1))
        .enter().append("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d => colorScale(colorScale.domain()[1] + d * (colorScale.domain()[0] - colorScale.domain()[1])));

    svg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#linear-gradient)");

    // add min and max labels
    const extent = d3.extent(stations, d => d[currentMetric]);
    const unit = currentMetric.includes("T") ? "°F" : "in";
    
    svg.append("text")
        .attr("x", 0)
        .attr("y", legendHeight + 15)
        .style("font-size", "12px")
        .text(`${extent[0].toFixed(1)} ${unit}`);

    svg.append("text")
        .attr("x", legendWidth)
        .attr("y", legendHeight + 15)
        .attr("text-anchor", "end")
        .style("font-size", "12px")
        .text(`${extent[1].toFixed(1)} ${unit}`);

}


// drawing the stations as circles onto the map 
function updateVis(){
  const colorScale = d3.scaleSequential()
    .domain(d3.extent(stations, d => d[currentMetric]))
    .interpolator(currentMetric.includes("T") ? d3.interpolateRdYlBu : d3.interpolateBlues);
  
  if (currentMetric.includes("T")) {
    colorScale.domain([d3.max(stations, d => d[currentMetric]), d3.min(stations, d => d[currentMetric])]);
  }

  mapG.selectAll('.stations')
      .data(stations, d => d.station)
      .join(
          // enter
          enter => enter.append('circle')
              .attr('class', 'stations')
              .attr('cx', d => {
                  const coords = projection([d.longitude, d.latitude]);
                  return coords ? coords[0] : null;
              })
              .attr('cy', d => {
                  const coords = projection([d.longitude, d.latitude]);
                  return coords ? coords[1] : null;
              })
              .attr('r', 0)
              .attr('fill', 'blue')
              .attr('opacity', 0.5)
              .on('mouseenter', (event, d) => {
                  // highlight the circle a bit
                  d3.select(event.currentTarget)
                    .attr('stroke', '#000')
                    .attr('stroke-width', 1.5)
                    .attr('opacity', 0.9);

                  tooltip
                    .style('opacity', 1)
                    .html(`
                      <div><strong>${d.station}</strong> (${d.state})</div>
                      <div>Avg PRCP: ${Number.isFinite(d.PRCP) ? d.PRCP.toFixed(2) : 'N/A'} in</div>
                      <div>Avg SNOW: ${Number.isFinite(d.SNOW) ? d.SNOW.toFixed(2) : 'N/A'} in</div>
                      <div>Avg TAVG: ${Number.isFinite(d.TAVG) ? d.TAVG.toFixed(1) : 'N/A'} °F</div>
                    `);
              })
              .on('mousemove', (event) => {
                  tooltip
                    .style('left', (event.pageX + 12) + 'px')
                    .style('top', (event.pageY + 12) + 'px');
              })
              .on('mouseleave', (event) => {
                  d3.select(event.currentTarget)
                    .attr('stroke', null)
                    .attr('stroke-width', null)
                    .attr('opacity', 0.5);

                  tooltip.style('opacity', 0);
              })
              .on('click', (event, d) => {
                activeStation = d.station; 
                renderDetailChart(d.station, "TAVG"); // default metric
                })
              .transition()
              .attr('r', 3)
              .attr('fill', d => colorScale(d[currentMetric])),

          // update
          update => update
              .transition()
              .attr('fill', d => colorScale(d[currentMetric]))
              .attr('cx', d => {
                  const coords = projection([d.longitude, d.latitude]);
                  return coords ? coords[0] : null;
              })
              .attr('cy', d => {
                  const coords = projection([d.longitude, d.latitude]);
                  return coords ? coords[1] : null;
              }),

          // exit
          exit => exit
              .transition()
              .attr('r', 0)
              .remove()
      );
      updateLegend(colorScale);
}


function renderDetailChart(stationName, metric = "TAVG") {
  // Filter rows for this station
  let series = weatherData
    .filter(d => d.station === stationName && d.dateObj)
    .map(d => ({ date: d.dateObj, value: d[metric] }))
    .filter(d => Number.isFinite(d.value))
    .sort((a, b) => a.date - b.date);

  d3.select("#detailTitle")
    .html(`<h4>${stationName} — ${metric} over time</h4>`);

  // If no usable data, clear and show message
  if (series.length === 0) {
    linePath.attr("d", null);
    xAxisG.call(d3.axisBottom(d3.scaleTime().range([0, detailWidth])));
    yAxisG.call(d3.axisLeft(d3.scaleLinear().range([detailHeight, 0])));
    yLabel.text(metric);
    detailG.selectAll(".no-data").data([null]).join("text")
      .attr("class", "no-data")
      .attr("x", detailWidth / 2)
      .attr("y", detailHeight / 2)
      .attr("text-anchor", "middle")
      .text("No data available for this station/metric.");
    return;
  } else {
    detailG.selectAll(".no-data").remove();
  }

  const x = d3.scaleTime()
    .domain(d3.extent(series, d => d.date))
    .range([0, detailWidth]);

  const y = d3.scaleLinear()
    .domain(d3.extent(series, d => d.value))
    .nice()
    .range([detailHeight, 0]);

  const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.value));

  xAxisG.transition().duration(600).call(d3.axisBottom(x));
  yAxisG.transition().duration(600).call(d3.axisLeft(y));
  yLabel.text(metric);

  linePath
    .datum(series)
    .transition()
    .duration(600)
    .attr("d", line);
}
