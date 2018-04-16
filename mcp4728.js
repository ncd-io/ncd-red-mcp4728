"use strict";

const MCP4728 = require("./index.js");
const comm = require("ncd-red-comm");

process.on('unhandledRejection', error => {
  console.log('unhandledRejection', error);
});


module.exports = function(RED){
	var sensor_pool = {};
	var loaded = [];

	//ensureDependencies(['node-red-contrib-aws', 'fail']);

	function NcdI2cDeviceNode(config){
		RED.nodes.createNode(this, config);
		this.addr = parseInt(config.addr);
		if(typeof sensor_pool[this.id] != 'undefined'){
			//Redeployment
			delete(sensor_pool[this.id]);
		}

		this.sensor = new MCP4728(this.addr, RED.nodes.getNode(config.connection).i2c, config);
		sensor_pool[this.id] = {
			sensor: this.sensor,
			node: this
		}
		var node = this;
		var last_status = false;

		function device_status(){
			if(!node.sensor.initialized){
				node.status({fill:"red",shape:"ring",text:"disconnected"});
				return false;
			}
			node.status({fill:"green",shape:"dot",text:"connected"});
			return true;
		}

		function send_payload(_status, force){
			if(!force && JSON.stringify(_status) == last_status) return;
			var msg = [],
				dev_status = {topic: 'device_status', payload: {
					channel_1: _status.channel_1.dac,
					channel_2: _status.channel_2.dac,
					channel_3: _status.channel_3.dac,
					channel_4: _status.channel_4.dac,
				}};

			if(config.output_all){
				var old_status = last_status ? JSON.parse(last_status) : false;
				for(var i in _status){
					if(!force && old_status && _status[i].dac == old_status[i].dac){
						msg.push(null);
					}else msg.push({topic: i, payload: _status[i].dac})
				}
				msg.push(dev_status);
			}else{
				msg = dev_status;
			}
			last_status = JSON.stringify(_status);
			node.send(msg);
		}

		function get_status(force){
			clearTimeout(sensor_pool[node.id].timeout);
			if(device_status(node)){
				node.sensor.get().then((res) => {
					send_payload(res, force);
				}).catch((err) => {
					node.send({error: err});
				});
			}else{
				clearTimeout(sensor_pool[node.id].timeout);
				node.sensor.init();
				sensor_pool[node.id].timeout = setTimeout(() => {
					if(typeof sensor_pool[node.id] != 'undefined'){
						get_status(force);
					}
				}, 3000);
			}
		}

		node.on('input', (msg) => {
			clearTimeout(sensor_pool[node.id].timeout);
			if(msg.topic != 'get_status'){
				if(typeof node.sensor.settable != 'undefined' && node.sensor.settable.indexOf(msg.topic) > -1){
					var topic = msg.topic == "all" ? 0 : msg.topic.substr(-1)*1;
					node.sensor.set(topic, msg.payload).then().catch((err) => {
						console.log(err);
					}).then(() => {
						get_status(true)
					});
				}
			}else{
				get_status(true);
			}
		});

		node.on('close', (removed, done) => {
			if(removed){
				delete(sensor_pool[node.id]);
			}
			done();
		});

		get_status(true);
	}
	RED.nodes.registerType("ncd-mcp4728", NcdI2cDeviceNode)
}
