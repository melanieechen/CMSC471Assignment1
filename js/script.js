
// margins and measurements
const margin = { top: 80, right: 60, bottom: 60, left: 100 };
const width = 800 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const tooltip = d3.select('#tooltip');

// global variables 
let usData = [];
let weatherData = [];
let stations = [];

// creating the actual SVG 
const svg = d3.select('#vis')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

const mapG = svg.append('g').attr('class', 'map-layer');

const outerSvg = d3.select('#vis svg');

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

      processStations();
      updateMap();
      updateVis();

  })
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

// drawing the stations as circles onto the map 
function updateVis(){

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
              .transition()
              .attr('r', 3),

          // update
          update => update
              .transition()
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
}
