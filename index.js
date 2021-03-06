(function (root, factory) {
    // https://github.com/umdjs/umd/blob/master/templates/returnExports.js
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but only CommonJS-like environments that support module.exports, like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.MapboxglLayerGroups = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const GROUP_PREFIX = "$";
    const GROUP_SEP = "/";

    /**
     * A plugin to manage layer groups in Mapbox GL JS
     * @exports MapboxglLayerGroups 
     * @author Cyrille Pontvieux <cyrille@enialis.net>
     */
    class MapboxglLayerGroups {
        static get GROUP_PREFIX() { return GROUP_PREFIX; }
        static get GROUP_SEP() { return GROUP_SEP; }

        /**
         * Create a MapboxglLayerGroups object bound to the map.
         * @param {Map} map
         */
        constructor(map) {
            this.map = map;
        }

        /**
         * Add a layer group to the map.
         *
         * @param {string} groupId The id of the new group (use `group/sub-group` format to create a sub group)
         * @param {Array<Object>} layers The Mapbox style spec layers of the new group
         * @param {string} beforeId The id of an existing layer or group to insert the new layers group before. If this argument is omitted, the layers group will be appended to the end of the layers array.
         */
        addGroup(groupId, layers, beforeId) {
            groupId = this._normalizeGroupId(groupId);
            let beforeLayerId = this._normalizeBeforeId(beforeId);
            layers.forEach(layer => {
                this._addLayerToGroup(groupId, layer, beforeLayerId, true);
            });
        }

        /**
         * Create a group id from a list of group names.
         * @returns {string} group id
         */
        createGroupId(...groups) {
            return GROUP_PREFIX + groups.join(GROUP_SEP);
        }

        /**
         * Add a single layer to an existing layer group.
         *
         * @param {string} groupId The id of group
         * @param {Object} layer The Mapbox style spec layer
         * @param {string} beforeId The id of an existing layer to insert the new layer before. If this argument is omitted, the layer will be appended to the end of the layers group.
         */
        addLayerToGroup(groupId, layer, beforeId) {
            this._addLayerToGroup(this._normalizeGroupId(groupId), layer, beforeId, false);
        }

        /**
         * Add a single layer to an existing layer group.
         *
         * @private
         * @param {string} groupId The id of group
         * @param {Object} layer The Mapbox style spec layer
         * @param {string} beforeId The id of an existing layer to insert the new layer before. If this argument is omitted, the layer will be appended to the end of the layers group.
         * @param {boolean} true to ignore beforeId check, false otherwise
         */
        _addLayerToGroup(groupId, layer, beforeId, ignoreBeforeIdCheck) {
            if (!ignoreBeforeIdCheck && beforeId && (!this._isLayer(beforeId) || !this.getLayerGroupIds(beforeId).includes(groupId))) {
                throw new Error('beforeId must be a layer id within the same group');
            } else if (!ignoreBeforeIdCheck && !beforeId) {
                beforeId = this._getLayerIdFromIndex(this._getGroupLastLayerIndex(groupId) + 1);
            }
            let groups = new Set(layer.metadata && layer.metadata.groups || []);
            groups.add(groupId.split(GROUP_SEP).reduce((previousPart, part) => {
                groups.add(previousPart);
                return previousPart + GROUP_SEP + part;
            }));
            let groupedLayer = Object.assign(
                {},
                layer,
                {
                    metadata: Object.assign(
                        {},
                        layer.metadata || {},
                        {
                            groups: [...groups],
                        }
                    )
                }
            );
            this.map.addLayer(groupedLayer, beforeId);
        }

        _getGroupIdsFromLayer(layer) {
            return layer.metadata && layer.metadata.groups || [];
        }

        /**
         * Remove a layer group and all of its layers from the map.
         *
         * @param {string} groupId The id of the group to be removed.
         */
        removeGroup(groupId) {
            groupId = this._normalizeGroupId(groupId);
            this.map.getStyle().layers.filter(layer => this._getGroupIdsFromLayer(layer).includes(groupId)).forEach(layer => {
                this.map.removeLayer(layer.id);
            });
        }

        /**
         * Remove a layer group and all of its layers from the map.
         *
         * @param {string} groupId The id of the group to be moved.
         * @param {string} beforeId The id of an existing layer or group to insert the new layers group before. If this argument is omitted, the layer will be appended to the end of the layers array.
         */
        moveGroup(groupId, beforeId) {
            groupId = this._normalizeGroupId(groupId);
            let beforeLayerId = this._normalizeBeforeId(beforeId);
            this.map.getStyle().layers.filter(layer => this._getGroupIdsFromLayer(layer).includes(groupId)).forEach(layer => {
                this.map.moveLayer(layer.id, beforeLayerId);
            });
        }

        /**
         * Get the id of the first layer in a group.
         *
         * @param {string} groupId The id of the group.
         * @returns {string}
         */
        getGroupFirstLayerId(groupId) {
            return this._getLayerIdFromIndex(this._getGroupFirstLayerIndex(this._normalizeGroupId(groupId)));
        }

        /**
         * Get the id of the last layer in a group.
         *
         * @param {string} groupId The id of the group.
         * @returns {string}
         */
        getGroupLastLayerId(groupId) {
            return this._getLayerIdFromIndex(this._getGroupLastLayerIndex(this._normalizeGroupId(groupId)));
        }

        _getGroupFirstLayerIndex(groupId) {
            return this.map.getStyle().layers.findIndex(layer => this._getGroupIdsFromLayer(layer).includes(groupId));
        }

        _getGroupLastLayerIndex(groupId) {
            let reverseLayers = this.map.getStyle().layers.slice().reverse();
            let reverseIndex = reverseLayers.findIndex(layer => this._getGroupIdsFromLayer(layer).includes(groupId));
            if (reverseIndex >= 0) {
                return reverseLayers.length - 1 - reverseIndex;
            }
        }

        _getLayerIdFromIndex(index) {
            let layer = this.map.getStyle().layers[index];
            return layer && layer.id || undefined;
        }

        /**
         * Get an array of group ids for a specified layer id.
         * @param {string} id The layer id.
         * @returns {array} array of strings
         */
        getLayerGroupIds(id) {
            return this._getGroupIdsFromLayer(this.map.getLayer(id));
        }

        /**
         * List all layers that belongs to the group id.
         * @param {string} groupId group id to test.
         * @returns {array} array of layers
         */
        getLayersInGroup(groupId) {
            groupId = this._normalizeGroupId(groupId);
            return this.map.getStyle().layers.filter(layer => this._getGroupIdsFromLayer(layer).includes(groupId));
        }

        _isLayer(id) {
            return !!this.map.getLayer(id);
        }

        _normalizeGroupId(groupId) {
            if (groupId && groupId[0] !== GROUP_PREFIX) {
                return GROUP_PREFIX + groupId;
            } else {
                return groupId;
            }
        }

        _getFirstParentGroup(groupIds) {
            return groupIds.splice().sort((left, right) => left.split(GROUP_SEP).length - right.split(GROUP_SEP).length)[0];
        }

        _normalizeBeforeId(beforeId) {
            if (beforeId) {
                let beforeLayer = this.map.getLayer(beforeId);
                let beforeGroupId = beforeLayer ? this._getFirstParentGroup(this._getGroupIdsFromLayer(beforeLayer)) : this._normalizeGroupId(beforeId);
                if (beforeGroupId) {
                    return this.getGroupFirstLayerId(beforeGroupId);
                } else {
                    return beforeId;
                }
            } else {
                return beforeId;
            }
        }
    };

    return MapboxglLayerGroups;
}));
