(function(){

var batchRender = false;

Editor.polymerElement({
	properties: {
		scale: {
			type: Number,
			value: 1
		}
	},
	ready: function(){
		this._t = {sx: 1, sy: 1, tx: 0, ty: 0};
		this.$.template.addEventListener("dom-change", this.domChange.bind(this));
	},
	addNode: function(e) {
		var b = graph.querySelector("#canvas").getBoundingClientRect();
		var pos = e.pos || [0, 0];
		pos[0] -= b.left;
		pos[1] -= b.top;
		pos[0] /= this._t.sx;
		pos[1] /= this._t.sy;
		e.pos = pos;
		this._addNode(e);
	},
	resize: function(w, h) {
		if (w && h) {
			this.style.width = w;
			this.style.height = h;
		}
	},
	setTransform: function( sx, sy, tx, ty ){
		tx = Math.round(tx + 0.5 * this.offsetWidth * (sx - 1));
		ty = Math.round(ty + 0.5 * this.offsetHeight * (sy - 1));
		this._t.sx = sx;
		this._t.sy = sy;
		this._t.tx = tx;
		this._t.ty = ty;
		// sx = 1, sy = 1, tx = 0, ty = 0;
		this.$.canvas.style.transform = "matrix(" +
			sx + ", 0, 0, " +
			sy + ", " +
			tx + ", " +
			ty + ")";
		this.scale = sx;
	},
	attached: function() {
		this._attachedDeferred();
	},
	_attachedDeferred: function() {
		if (!document.contains(this) || !this.offsetParent) {
			setTimeout(function(){
				this._attachedDeferred();
			}.bind(this), 100);
			return;
		}

		this.shader = new ShaderGraph.GraphShader();

		this.graph = this.shader.fragmentGraph;
		//this.graph = this.shader.vertexGraph;

		this.updateGraph();

		console.log('Graph editor ready');

		if (this.onReady) {
			this.onReady();
		}
	},
	loadGraph: function(graph) {
		batchRender = true;
		var nodes = graph.nodes || [];
		var ids = []
		for (var i = 0; i < nodes.length; i++) {
			var id = this._addNode(nodes[i]);
			ids.push(id);
		}
		var links = graph.links || [];
		for (var i = 0; i < links.length; i++) {
			var portA = this._splitPort(links[i][0]);
			var portB = this._splitPort(links[i][1]);
			this.connect(ids[portA[0]], portA[1], ids[portB[0]], portB[1]);
		}
		batchRender = false;
		this.updateGraph();
	},
	clearGraph: function() {
		batchRender = true;
		var nodes = this.graph.nodes.slice(0);
		for (var i = 0; i < nodes.length; i++) {
			var node = nodes[i];
			this.removeNode(node.id);
		}
		batchRender = false;
		this.updateGraph();
	},
	updateGraph: function() {
		this.updateShader();
		this._updateNodes();
		this._updateLinks();
	},
	_updateNodes: function() {
		var nodes = [];

		this.graph.nodes.forEach(function(node) {
			var extra;

			switch (node.constructor.type) {
				case 'value':
				case 'vec2':
				case 'vec3':
				case 'vec4':
					if (node.value.length > 1) {
						extra = [];
						for (var i = 0; i < node.value.length; i++) {
							extra.push(
								{
									value: node.value[i],
								}
							);
						}
					} else {
						extra = [
							{
								value: node.value,
							}
						];
					}
					break;
			}

			var inputs = node.getInputPorts().map(function(key){
				return {
					key: key,
					connected: node.inputPortIsConnected(key),
					dataType: node.getInputVariableTypes(key)
				}
			});

			var outputs = node.getOutputPorts().map(function(key){
				return {
					key: key,
					connected: node.outputPortIsConnected(key),
					dataType: node.getOutputTypes(key)
				}
			});

			nodes[node.id] = {
				id: node.id,
				pos: node.position,
				type: node.constructor.type,
				inputs: inputs,
				outputs: outputs,
				extra: extra,
				updateData: this.updateData.bind(this),
				clickHandler: this.nodeClick.bind(this),
				portClickHandler: this.portClick.bind(this)
			};
		}, this);

		this.nodes = nodes;
	},
	_updateLinks: function() {
		var nodes = this.nodes;
		var missing = false;

		var links = [];

		this.graph.links.forEach(function(link) {
			var ela = this.querySelector('shader-port[node="' + link.fromNode.id + '"][port="' + link.fromPortKey + '"]');
			var elb = this.querySelector('shader-port[node="' + link.toNode.id + '"][port="' + link.toPortKey + '"]');
			if (ela && elb) {
				var nodeA = link.fromNode;
				var nodeB = link.toNode;
				links[link.id] = {
					id: link.id,
					nodeA: link.fromNode.id,
					portA: link.fromPortKey,
					posA: [
						nodeA.position[0] + ela.offsetLeft + ela.offsetWidth - 2,
						nodeA.position[1] + ela.offsetTop + 0.5 * ela.offsetHeight + 2
					],
					nodeB: link.toNode.id,
					portB: link.toPortKey,
					posB: [
						nodeB.position[0] + elb.offsetLeft + 4,
						nodeB.position[1] + elb.offsetTop + 0.5 * elb.offsetHeight + 2
					],
					clickHandler: this.wireClick.bind(this),
					dataType: ela.dataType
				};
			} else {
				missing = true;
			}

		}, this);

		this.links = links;

		if (missing) {
			setTimeout(function() { this._updateLinks(); }.bind(this), 100);
		}
	},
	_isMainNode: function(type) {
		return type === "fragColor" || type === "position";
	},
	nodeTypes: function(){
		var types = Object.keys(ShaderGraph.Node.classes).sort().filter(function(type){
			// Should not list the main node
			return !this._isMainNode(type);
		}, this);
		return types.map(function (type) {
			return { type: type };
		});
	},
	updateShader: function(){
		// window._times = (window._times || 0) + 1, console.log(window._times);
		if (this.shader && this.onShaderUpdate) {
			this.onShaderUpdate(this.shader);
		}

		return this.shader
	},
	_addNode: function(options, extra){
		var data = extra || {};
		if (typeof options === "string") {
			data.type = options;
		} else if (typeof options === "object") {
			for(var i in options) {
				data[i] = options[i];
			}
		} else {
			console.warn("Couldn't create node with options='" + options + "' and extra='" + extra + "'");
			return;
		}
		if (this._isMainNode(data.type)) {
			// Find the main node
			var mainNode = this.graph.nodes.find(function(node){
				return this._isMainNode(node.constructor.type);
			}, this);
			// Only update its data
			if (mainNode) {
				this.updateData(mainNode.id, {
					position: data.pos
				});
				return mainNode.id;
			}
		}
		if (typeof data.id !== "undefined") {
			data.id = parseInt(data.id);
		}
		if (typeof data.value === "undefined") {
			switch (data.type){
				case 'value':
					data.value = 0;
					break;
				case 'vec2':
					data.value = [0,0];
					break;
				case 'vec3':
					data.value = [0,0,0];
					break;
				case 'vec4':
					data.value = [0,0,0,1];
					break;
			}
		}

		// Add nodes that are not main nodes
		var node = new ShaderGraph.Node.classes[data.type]({
			id: data.id,
			position: data.pos
		});
		this.graph.addNode(node);
		switch (data.type){
			case 'value':
				var v = parseFloat(data.value);
				node.value = isNaN(v) ? 0 : v;
				break;
			case 'vec2':
			case 'vec3':
			case 'vec4':
				node.value = data.value.map(function(comp){
					var v = parseFloat(comp);
					return isNaN(v) ? 0 : v;
				});
				break;
		}

		if (!batchRender) {
			this.updateGraph();
		}

		// If there is a temporary link attach it to the new node
		if (this._tempWire) {
			var nodeA = this._tempWire.nodeA;
			var portA = this._tempWire.portA;
			var nodeB = node.id;
			if (this._tempWire.elementA.type === "out") {
				var portB = ShaderGraph.Node.classes[data.type].prototype.getInputPorts()[0];
				this.connect(nodeB, portB, nodeA, portA);
				// this.connect(nodeA, portA, nodeB, portB);
			} else if (this._tempWire.elementA.type === "in") {
				var portB = ShaderGraph.Node.classes[data.type].prototype.getOutputPorts()[0];
				this.connect(nodeB, portB, nodeA, portA);
			}
			this.clearTempWire();
		}

		return node.id;
	},
	removeNode: function(id){
		id = parseInt(id);

		var nodeToRemove = this.graph.nodes.find(function(node){
			return node.id === id;
		});
		if(!nodeToRemove || this._isMainNode(nodeToRemove.constructor.type)){
			return false;
		}

		// Remove the links connected
		this.graph.links.filter(function(link){
			return link.fromNode.id == id || link.toNode.id == id;
		}).forEach(function(link){
			var nA = link.fromNode;
			if(!nA) throw new Error('couldnt find node ' + link.fromNode.id);
			var nB = link.toNode;
			if(!nB) throw new Error('couldnt find node ' + link.toNode.id);

			nA.disconnect(link.fromPortKey, nB, link.toPortKey);
		}, this);

		var node = this.graph.getNodeById(id);
		if(!node) throw new Error('couldnt find node ' + id);
		this.graph.removeNode(node);

		if (!batchRender) {
			this.updateGraph();
		}

		return true;
	},
	updateData: function(id, data){
		if (!data) {
			return;
		}
		if (data.value && data.value.length === 1) {
			data.value = data.value[0];
		}
		var node = this.graph.nodes.find(function(node){
			return node.id === id;
		});
		if(node){
			for(var key in data){
				node[key] = data[key];
			}
			this.updateShader();
		}
	},
	_splitPort: function(port) {
		var string = port.toString();
		if (string.indexOf('.') === -1) {
			return [port, 0];
		}
		var split = string.split('.');
		return [parseInt(split[0]), parseInt(split[1])];
	},
	_getExistingConnections: function(node, port) {
		var existing = [];
		this.links.forEach(function(link) {
			if (link.nodeB === node && link.portB === port) {
				existing.push(link);
			}
		}, this);
		return existing;
	},
	connect: function(nodeA, portA, nodeB, portB){
		if(arguments.length === 2) {
			var portA = this._splitPort(arguments[0]);
			var portB = this._splitPort(arguments[1]);

			nodeA = portA[0];
			portA = portA[1];

			nodeB = portB[0];
			portB = portB[1];
		} else {
			nodeA = Number(nodeA);
			nodeB = Number(nodeB);
		}

		var nA = this.graph.getNodeById(nodeA);
		var nB = this.graph.getNodeById(nodeB);
		if(!nA) throw new Error('couldnt find node ' + nodeA);
		if(!nB) throw new Error('couldnt find node ' + nodeB);

		if(typeof portA === "number") {
			portA = nA.getOutputPorts()[portA];
			if(typeof portA === "undefined") {
				console.warn("Output port A undefined");
				return false;
			}
		}

		if(typeof portB === "number") {
			portB = nB.getInputPorts()[portB];
			if(typeof portB === "undefined") {
				console.warn("Input port B undefined");
				return false;
			}
		}

		var link;

		if(!nB.canConnect(portB, nA, portA)){
			if (!nA.canConnect(portA, nB, portB)) {
				console.warn(nB.errorMessage);
				return false;
			} else {
				// make the connetion in opposite direction
				link = {
					id: nA.connect(portA, nB, portB),
					nodeA: nodeB,
					nodeB: nodeA,
					portA: portB,
					portB: portA
				};
			}
		} else {
			// make the connetion as is
			link = {
				id: nB.connect(portB, nA, portA),
				nodeA: nodeA,
				nodeB: nodeB,
				portA: portA,
				portB: portB
			};
		}

		// disconnect existing connections to the same input port
		var existing = this._getExistingConnections(link.nodeB, link.portB);
		for (var i = 0; i < existing.length; i++) {
			var info = existing[i];
			this.disconnect(info.nodeA, info.portA, info.nodeB, info.portB);
		}

		if (!batchRender) {
			this.updateGraph();
		}

		return true;
	},
	disconnect: function(nodeA, portA, nodeB, portB){
		nodeA = Number(nodeA);
		nodeB = Number(nodeB);

		// Test it!
		var nA = this.graph.getNodeById(nodeA);
		var nB = this.graph.getNodeById(nodeB);
		nB.disconnect(portB, nA, portA);

		// Delete any other invalid links
		/*
		var invalidConnections = this.graph.links.filter(function(link){
			return !link.isValid();
		}).forEach(function(link){
			console.log('removing', link)
			var connToRemove = this.graph.links.find(function(connData){
				return (
					connData.fromNode === link.fromNode &&
					connData.toNode === link.toNode &&
					connData.fromPortKey === link.fromPortKey &&
					connData.toPortKey === link.toPortKey
				);
			});
		});
		*/

		if (!batchRender) {
			this.updateGraph();
		}
	},
	updateSelectRect: function( left, top, width, height ) {
		if (!left || !top || !width || !height) {
			this.clearSelection();
			return;
		}

		var els = this.querySelectorAll("shader-node");

		// Apply the local transformation to the selection rect
		left -= this._t.tx - 0.5 * this.offsetWidth * (this._t.sx - 1);
		left /= this._t.sx;
		width /= this._t.sx;

		top -= this._t.ty - 0.5 * this.offsetHeight * (this._t.sy - 1);
		top /= this._t.sy;
		height /= this._t.sy;

		var right = left + width;
		var bottom = top + height;

		// Find and mark as selected all the nodes insersecting the selection rect
		this.selection = [];
		for (var i = 0; i < els.length; i++) {
			var el = els[i];
			var selected = el.offsetLeft <= right &&
				left <= el.offsetLeft + el.offsetWidth &&
				el.offsetTop <= bottom &&
				top <= el.offsetTop + el.offsetHeight;
			el.selected = selected;
			if (selected) {
				this.selection.push(el);
			}
		}
	},
	clearSelection: function() {
		this.selection = [];
		var els = this.querySelectorAll("shader-node");

		// Deselect all nodes if selection rect is undefined
		for (var i = 0; i < els.length; i++) {
			els[i].selected = false;
		}
	},
	removeSelection: function() {
		if (this.selection) {
			this.selection.forEach(function(el){
				this.removeNode(el.id);
			}, this);
		}
	},
	isInSelection: function(el) {
		return this.selection && this.selection.indexOf(el) !== -1;
	},
	addToSelection: function(el) {
		if (!this.selection) {
			this.selection = [];
		}
		if (!this.isInSelection(el)) {
			el.selected = true;
			this.selection.push(el)
		}
	},
	toggleSelection: function(el) {
		if (!this.selection) {
			this.selection = [];
		}
		if (!this.isInSelection(el)) {
			this.addToSelection(el);
		} else {
			this.selection.splice(this.selection.indexOf(el), 1);
			el.selected = false;
		}
	},
	domChange: function(event){
	},
	portClick: function(e, elp) {
		e.stopPropagation();

		// Clear temp wire before creating a new one
		this.clearTempWire();
		if (this.onConnectionStarted) {
			this.onConnectionStarted(e);
		}

		// Create a new temp wire
		var wire = document.createElement("shader-wire");
		wire.id = "temp";
		wire.W.classList.add("dragging");

		var eln = elp.parentNode.parentNode.parentNode;

		var elc;
		if (elp.type == "in") {
			wire.B.pos = [
				eln.offsetLeft + elp.offsetLeft + 4,
				eln.offsetTop + elp.offsetTop + 0.5 * elp.offsetHeight + 2
			];
			elc = wire.A;
		} else {
			wire.A.pos = [
				eln.offsetLeft + elp.offsetLeft + elp.offsetWidth - 2,
				eln.offsetTop + elp.offsetTop + 0.5 * elp.offsetHeight + 2
			];
			elc = wire.B;
		}
		elc.classList.add("dragging");

		var bounds = this.getBoundingClientRect();

		elc.pos = [
			((e.clientX - bounds.left) + 0.5 * this.offsetWidth * (this._t.sx - 1) - this._t.tx) / this._t.sx,
			((e.clientY - bounds.top) + 0.5 * this.offsetHeight * (this._t.sx - 1) - this._t.ty) / this._t.sy
		];

		Polymer.dom(this.$.canvas).appendChild(wire);

		elp.dragged = true;

		// Find posible connectors to drop temp wire
		var filterType = elp.type === "in" ? "out" : "in";
		var nodeA = elp.node;
		var portA = elp.port;
		var nA = this.graph.getNodeById(nodeA);

		var ports = [];
		Array.prototype.forEach.call(this.querySelectorAll("shader-port"), function(port) {
			if (port.type === filterType) {
				var nodeB = port.node;
				var portB = port.port;
				var nB = this.graph.getNodeById(nodeB);
				if (nA.canConnect(portA, nB, portB) || nB.canConnect(portB, nA, portA)) {
					ports.push({
						element: port,
						node: port.node,
						port: port.port
					});
				}
			}
		}, this);

		// Start dragging the temp wire
		var nodeB;
		var portB;
		var targetPort;
		Editor.UI._DomUtils.startDrag("default", e, function( e, dx, dy ) {
			var pos = [
				((e.clientX - bounds.left) + 0.5 * this.offsetWidth * (this._t.sx - 1) - this._t.tx) / this._t.sx,
				((e.clientY - bounds.top) + 0.5 * this.offsetHeight * (this._t.sx - 1) - this._t.ty) / this._t.sy
			];
			nodeB = undefined;
			portB = undefined;
			// Snap connector to ports
			targetPort = null;
			ports.forEach(function(info) {
				var port = info.element;
				var n = port.parentNode.parentNode.parentNode;
				var ppos;
				if (filterType === "in") {
					ppos = [
						n.offsetLeft + port.offsetLeft + 4,
						n.offsetTop + port.offsetTop + 0.5 * port.offsetHeight + 2
					];
				} else {
					ppos = [
						n.offsetLeft + port.offsetLeft + port.offsetWidth - 2,
						n.offsetTop + port.offsetTop + 0.5 * port.offsetHeight + 2
					];
				}
				if (pos[0] > ppos[0] - 20 &&
						pos[0] < ppos[0] + 20 &&
						pos[1] > n.offsetTop + port.offsetTop &&
						pos[1] < n.offsetTop + port.offsetTop + port.offsetHeight) {
					pos = ppos;
					nodeB = info.node;
					portB = info.port;
					targetPort = port;
					port.dragged = true;
				} else {
					port.dragged = false;
				}
			});
			elc.pos = pos;
		}.bind(this), function( e ) {
			this._tempWire = {
				elementA: elp,
				elementB: targetPort,
				wire: wire,
				nodeA: nodeA,
				portA: portA,
				nodeB: nodeB,
				portB: portB
			};
			if (targetPort) {
				this.clearTempWire();
				this.connect(nodeA, portA, nodeB, portB);
			} else {
				if (this.onConnectionReleased) {
					this.onConnectionReleased(e);
				} else {
					// If onConnectionReleased is not defined abort temp connection
					this.clearTempWire();
				}
			}
		}.bind(this));
	},
	clearTempWire: function() {
		if (this._tempWire) {
			this._tempWire.elementA.dragged = false;
			if (this._tempWire.elementB) {
				this._tempWire.elementB.dragged = false;
			}
			this.$.canvas.removeChild(this._tempWire.wire);
			this._tempWire = null;
		}
	},
	wireClick: function(e, el) {
		var link = this.links[el.id];
		this.disconnect(link.nodeA, link.portA, link.nodeB, link.portB);
		el.parentNode.removeChild(el);
	},
	nodeClick: function(e, el, capture) {
		if (3 === e.which || 2 === e.which) {
			return;
		}
		var isDraggable = e.target.classList.contains("draggable");
		if (capture) {
			this.bringToFront(el);
			if (e.shiftKey) {
				this.toggleSelection(el);
			} else {
				if (!this.isInSelection(el) || !isDraggable) {
					this.clearSelection();
					this.addToSelection(el);
				}
			}
		} else {
			if (isDraggable) {
				e.stopPropagation();
				Editor.UI._DomUtils.startDrag("move", e, function( e, dx, dy ) {
					this.selection.forEach(function(el){
						var pos = el.pos;
						pos[0] += dx / this.scale;
						pos[1] += dy / this.scale;
						el.set("pos.*", pos.slice(0));

						Array.prototype.forEach.call(el.outputs, function(output) {
							var elp = this.querySelector('shader-port[node="' + el.id + '"][port="' + output.key + '"]');
							var elc = this.querySelector('.connector[node-a="' + el.id + '"][port-a="' + output.key + '"]');
							if (elp && elc) {
								elc.pos = [
									el.offsetLeft + elp.offsetLeft + elp.offsetWidth - 2,
									el.offsetTop + elp.offsetTop + 0.5 * elp.offsetHeight + 2
								];
							}
						}, this);

						Array.prototype.forEach.call(el.inputs, function(input) {
							var elp = this.querySelector('shader-port[node="' + el.id + '"][port="' + input.key + '"]');
							var elc = this.querySelector('.connector[node-b="' + el.id + '"][port-b="' + input.key + '"]');
							if (elp && elc) {
								elc.pos = [
									el.offsetLeft + elp.offsetLeft + 4,
									el.offsetTop + elp.offsetTop + 0.5 * elp.offsetHeight + 2
								];
							}
						}, this);

					}, this);

				}.bind(this), function( e ) {
					this.style.cursor = "default";
				}.bind(this));
			}
		}
	},
	bringToFront: function(el) {
		if (!this.topz) {
			this.topz = 10;
		}
		el.style.zIndex = ++this.topz;
	},
	_onGraphSelected: function(e) {
		switch (e.target.selected) {
			case 0:
				this.graph = this.shader.vertexGraph;
				break;
			case 1:
				this.graph = this.shader.fragmentGraph;
				break;
		}
		this.updateGraph();
	}
});

})();
