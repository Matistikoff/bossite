(function () {
  "use strict";

  // One fixed photo per country; city names map to their respective countries.
  var photos = {
    SK: "../assets/images/thumbnails/16_Zuberec_BA/nadhera.webp",
    UA: "photos/ukrajina.JPEG",
    BA: "photos/bosnaAHercegovina.jpeg",
    ME: "photos/ciernaHora.jpeg",
    MK: "photos/macedonsko.jpeg",
    MY: "photos/malajzia.jpeg",
    PL: "photos/polsko.jpeg",
    IT: "photos/talliansko.jpeg",
    CZ: "photos/praha.jpeg",
    AE: "photos/abudabi.jpeg",
    US: "photos/USA.jpeg",
    HR: "photos/chorvatsok.jpeg",
    IE: "photos/dublin.jpeg",
    RS: "photos/srbsko.jpeg",
    ID: "photos/indonezia.jpeg",
    DE: "photos/nemecko.jpeg",
    SG: "photos/singapur.jpeg",
    XK: "photos/kosovo.jpeg",
    SI: "photos/slovinsko.jpeg",
    AT: "photos/rakusko.jpeg",
    AL: "photos/albansko.jpeg",
    GR: "photos/grecko.jpeg"
  };
  var namespace = "http://www.w3.org/2000/svg";
  var attempts = 0;

  function svgElement(name, attributes, parent) {
    var element = document.createElementNS(namespace, name);
    Object.keys(attributes).forEach(function (key) {
      element.setAttribute(key, attributes[key]);
    });
    if (parent) parent.appendChild(element);
    return element;
  }

  function attach(viewer) {
    var overlay = svgElement("svg", { "aria-hidden": "true" });
    overlay.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden";
    viewer.root.dom.appendChild(overlay);
    var defs = svgElement("defs", {}, overlay);
    var countries = Object.keys(photos).map(function (id) {
      var clipId = "country-photo-clip-" + id;
      var clip = svgElement("clipPath", { id: clipId, clipPathUnits: "userSpaceOnUse" }, defs);
      var outline = svgElement("path", {}, clip);
      var group = svgElement("g", { "data-country-photo": id, visibility: "hidden" }, overlay);
      var clipped = svgElement("g", { "clip-path": "url(#" + clipId + ")" }, group);
      var image = svgElement("image", { preserveAspectRatio: "xMidYMid slice", href: photos[id] }, clipped);
      var border = svgElement("path", { fill: "none", stroke: "#fff", "stroke-opacity": "0.65", "stroke-width": "1", "vector-effect": "non-scaling-stroke" }, group);
      var country = { id: id, group: group, outline: outline, image: image, border: border, loaded: false, previousPath: null };
      // Load independently: a missing photo keeps that country's normal fill.
      var preload = new Image();
      preload.onload = function () { country.loaded = true; };
      preload.src = photos[id];
      return country;
    });
    var lastStep = null;
    var revealed = new Set();

    function render() {
      if (document.hidden) return;
      if (viewer.step !== lastStep) {
        lastStep = viewer.step;
        revealed.clear();
        viewer.data.slice(0, Math.max(0, viewer.step + 1)).forEach(function (entry) {
          entry.places.forEach(function (id) { revealed.add(id); });
        });
      }
      var geoPath = viewer.polygonSeries.geoPath();
      countries.forEach(function (country) {
        var item = viewer.polygonSeries.getDataItemById(country.id);
        var polygon = item && item.get("mapPolygon");
        var geometry = polygon && polygon.get("geometry");
        if (!country.loaded || !revealed.has(country.id) || !geometry || !geoPath || !polygon.isVisibleDeep()) {
          country.group.setAttribute("visibility", "hidden");
          return;
        }
        // Reuse the map's projection, including clipping on the globe's far side.
        var path = geoPath(geometry);
        var bounds = geoPath.bounds(geometry);
        var width = bounds[1][0] - bounds[0][0];
        var height = bounds[1][1] - bounds[0][1];
        if (!path || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
          country.group.setAttribute("visibility", "hidden");
          return;
        }
        country.group.setAttribute("visibility", "visible");
        var origin = polygon.toGlobal({ x: 0, y: 0 });
        var xAxis = polygon.toGlobal({ x: 1, y: 0 });
        var yAxis = polygon.toGlobal({ x: 0, y: 1 });
        country.group.setAttribute("transform", "matrix(" + [xAxis.x - origin.x, xAxis.y - origin.y,
          yAxis.x - origin.x, yAxis.y - origin.y, origin.x, origin.y].join(" ") + ")");
        if (path !== country.previousPath) {
          country.outline.setAttribute("d", path);
          country.border.setAttribute("d", path);
          country.image.setAttribute("x", bounds[0][0]);
          country.image.setAttribute("y", bounds[0][1]);
          country.image.setAttribute("width", width);
          country.image.setAttribute("height", height);
          country.previousPath = path;
        }
      });
    }

    var frame;
    function tick() {
      if (viewer.root.isDisposed()) { overlay.remove(); return; }
      render();
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    window.addEventListener("pagehide", function () { cancelAnimationFrame(frame); });
    window.addEventListener("pageshow", function (event) {
      if (event.persisted) frame = requestAnimationFrame(tick);
    });
  }

  var timer = setInterval(function () {
    var viewer = window.VP;
    if (viewer && viewer.polygonSeries && viewer.polygonSeries.geoPath()) {
      clearInterval(timer);
      attach(viewer);
    } else if (++attempts >= 600) {
      clearInterval(timer);
    }
  }, 100);
})();
