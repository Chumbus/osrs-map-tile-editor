'use strict';

import "../../js/leaflet.js";
import "../../js/layers.js";
import "../../js/plugins/leaflet.fullscreen.js";
import "../../js/plugins/leaflet.mapSelector.js";
import "../../js/plugins/leaflet.zoom.js";
import "../../js/plugins/leaflet.plane.js";
import "../../js/plugins/leaflet.position.js";
import "../../js/plugins/leaflet.displays.js";
import "../../js/plugins/leaflet.urllayers.js";
import "../../js/plugins/leaflet.rect.js";
import "../../js/plugins/leaflet.clickcopy.js";
import "../../js/plugins/leaflet.maplabels.js";
import "../../js/plugins/leaflet.tilemarkers.js";
import "../../js/plugins/leaflet.mapicons.js";
import "../../js/plugins/leaflet.overworldlabels.js";

void function (global) {
    let runescape_map = global.runescape_map = L.gameMap('map', {

        maxBounds: [[-1000, -1000], [12800 + 1000, 12800 + 1000]],
        maxBoundsViscosity: 0.5,

        customZoomControl: true,
        fullscreenControl: true,
        planeControl: true,
        positionControl: true,
        messageBox: true,
        tileMarkers: true,
        initialMapId: -1,
        plane: 0,
        x: 3200,
        y: 3200,
        minPlane: 0,
        maxPlane: 3,
        minZoom: -4,
        maxZoom: 8,
        doubleClickZoom: false,
        showMapBorder: true,
        enableUrlLocation: true
    });

    L.tileLayer.main('tiles/{zoom}/{plane}_{x}_{y}.png', {
        minZoom: -4,
        maxNativeZoom: 4,
        maxZoom: 8,
    }).addTo(runescape_map).bringToBack();

    let grid = L.grid({
        bounds: [[0, 0], [12800, 6400]],
    });

    let dungeonLabels = L.maplabelGroup({
        API_KEY: "AIzaSyBrYT0-aS9VpW2Aenm-pJ2UCUhih8cZ4g8",
        SHEET_ID: "1859HuKw5dXqmfakFd6e6kQ_PEXQA02namB4aNVQ0qpY",
    });

    let mapIcons = L.mapIconLayer();
    let overworldLabels = L.overworldLabelLayer();

    L.control.layers.urlParam({}, {
        "map-icons": mapIcons,
        "area-labels": overworldLabels,
        "dungeon-labels": dungeonLabels,
        "grid": grid,
    }, {
        collapsed: true,
        position: 'bottomright'
    }).addTo(runescape_map);

}
(this || window);
