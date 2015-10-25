var Node = require('./Node');
var OperatorNode = require('./OperatorNode');
var Utils = require('../Utils');

module.exports = AddNode;

function AddNode(options){
	options = options || {};
	OperatorNode.call(this, options);
}
AddNode.prototype = Object.create(OperatorNode.prototype);
AddNode.prototype.constructor = AddNode;

Node.registerClass('add', AddNode);