import "../leaflet.js";

(function (factory) {
    var L;
    if (typeof define === "function" && define.amd) {
        define(["leaflet"], factory);
    } else if (typeof module !== "undefined") {
        L = require("leaflet");
        module.exports = factory(L);
    } else {
        if (typeof window.L === "undefined") {
            throw new Error("Leaflet must be loaded first");
        }
        factory(window.L);
    }
})(function (L) {

    let MapIconLayer = L.LayerGroup.extend({
        options: {
            iconsUrl: 'https://maps.runescape.wiki/osrs/data/iconLists/MainIcons.json',
            locationsUrl: 'https://maps.runescape.wiki/osrs/data/overlayMaps/MainMapIconLoc.json',
            minZoom: -1,
        },

        initialize: function (options) {
            L.LayerGroup.prototype.initialize.call(this, [], options);
            L.setOptions(this, options);
            this._iconDefs = null;
            this._iconCache = {};
            this._planeGroups = {};  // plane → L.LayerGroup of markers
            this._activePlane = null;
            this._loaded = false;
        },

        onAdd: function (map) {
            this._map = map;
            L.LayerGroup.prototype.onAdd.call(this, map);

            if (!this._loaded) {
                this._loadData();
            } else {
                this._showPlane(map.getPlane());
            }

            map.on('zoomend', this._onZoomChange, this);
            map.on('planechange', this._onPlaneChange, this);
        },

        onRemove: function (map) {
            map.off('zoomend', this._onZoomChange, this);
            map.off('planechange', this._onPlaneChange, this);
            // Remove whichever plane group is active
            if (this._activePlane != null && this._planeGroups[this._activePlane]) {
                this.removeLayer(this._planeGroups[this._activePlane]);
            }
            this._activePlane = null;
            L.LayerGroup.prototype.onRemove.call(this, map);
        },

        _loadData: function () {
            Promise.all([
                fetch(this.options.iconsUrl).then(r => r.json()),
                fetch(this.options.locationsUrl).then(r => r.json()),
            ]).then(([iconDefs, locations]) => {
                this._iconDefs = iconDefs;
                this._loaded = true;
                this._buildMarkers(locations);
                if (this._map) {
                    this._showPlane(this._map.getPlane());
                }
            }).catch(e => {
                console.error('Failed to load map icons:', e);
            });
        },

        _getIcon: function (type) {
            if (this._iconCache[type]) return this._iconCache[type];

            let def = this._iconDefs.icons[type] || this._iconDefs.icons['IconNotFound'];
            if (!def) return null;

            let icon = L.icon({
                iconUrl: this._iconDefs.folder + def.filename,
                iconSize: [def.width, def.height],
                iconAnchor: [Math.floor(def.width / 2), Math.floor(def.height / 2)],
                popupAnchor: [0, -Math.floor(def.height / 2)],
            });

            this._iconCache[type] = icon;
            return icon;
        },

        _buildMarkers: function (locations) {
            for (let feature of locations.features) {
                let props = feature.properties;
                let coords = feature.geometry.coordinates;
                let x = coords[0], y = coords[1], z = coords[2] || 0;

                let icon = this._getIcon(props.icon);
                if (!icon) continue;

                let name = '';
                if (this._iconDefs.icons[props.icon]) {
                    name = this._iconDefs.icons[props.icon].name;
                }

                let marker = L.marker([y + 0.5, x + 0.5], {
                    icon: icon,
                    interactive: true,
                    keyboard: false,
                });

                if (name) {
                    marker.bindTooltip(name, {
                        direction: 'top',
                        offset: [0, -10],
                        className: 'mapicon-tooltip',
                    });
                }

                if (!this._planeGroups[z]) {
                    this._planeGroups[z] = L.layerGroup();
                }
                this._planeGroups[z].addLayer(marker);
            }
        },

        _showPlane: function (plane) {
            if (this._activePlane === plane) return;

            // Remove old plane group
            if (this._activePlane != null && this._planeGroups[this._activePlane]) {
                this.removeLayer(this._planeGroups[this._activePlane]);
            }

            this._activePlane = plane;

            // Add new plane group if zoom is sufficient
            if (this._map && this._map.getZoom() >= this.options.minZoom) {
                if (this._planeGroups[plane]) {
                    this.addLayer(this._planeGroups[plane]);
                }
            }
        },

        _onPlaneChange: function (e) {
            this._showPlane(e.newPlane);
        },

        _onZoomChange: function () {
            if (!this._map) return;
            let show = this._map.getZoom() >= this.options.minZoom;
            let plane = this._map.getPlane();
            let group = this._planeGroups[plane];
            if (!group) return;

            if (show && !this.hasLayer(group)) {
                this.addLayer(group);
            } else if (!show && this.hasLayer(group)) {
                this.removeLayer(group);
            }
        },
    });

    L.mapIconLayer = function (options) {
        return new MapIconLayer(options);
    };
});
