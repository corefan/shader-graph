(function(){

Editor.polymerElement({
	attached: function() {
		var self = this;
	},
	properties: {
		id: String,
		inputs: {
			type: Object,
			value: function(){return [];}
		},
		outputs: {
			type: Object,
			value: function(){return [];}
		},
		extra: {
			type: Object,
			value: function(){return [];}
		},
		updateNodeData: Object,
		removeNode: Object,
		pos: {
			type: Array,
			value: function() { return [0,0]; },
			observer: "_pos"
		},
		selected: {
			type: Boolean,
			value: function() { return false; },
			observer: "_selected"
		}
	},
	observers: [
		'_onValueChange(extra.*)'
	],
	_onValueChange: function() {
		if (this.extra) {
			var value = this.extra.map(function(item) {
				return parseFloat(item.value);
			});
			if (this.updateNodeData) {
				this.updateNodeData(parseFloat(this.id), {
					value: value
				});
			}
		}
	},
	_onRemoveNode: function(){
		this.removeNode(parseFloat(this.id));
	},
	_pos: function(pos) {
		if (pos) {
			this.style.left = pos[0];
			this.style.top = pos[1];
		}
	},
	_selected: function(selected){
		if (selected) {
			this.classList.add("selected");
		} else {
			this.classList.remove("selected");
		}
	}
});

})();
