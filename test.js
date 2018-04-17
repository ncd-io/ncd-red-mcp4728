var comms = require('ncd-red-comm');
var MCP4728 = require('./index.js');

/*
 * Allows use of a USB to I2C converter form ncd.io
 */
var port = '/dev/tty.usbserial-DN03Q7F9';
var serial = new comms.NcdSerial('/dev/tty.usbserial-DN03Q7F9', 115200);
var comm = new comms.NcdSerialI2C(serial, 0);

/*
 * Use the native I2C port on the Raspberry Pi
 */
//var comm = new comms.NcdI2C(1);

var config = {
	OSMode: 1,
	rate: 7,
	mode: 1
};
var dac = new MCP4728(0x60, comm, {
	eeprom_persist_1: true,
	eeprom_persist_2: true,
	eeprom_persist_3: true,
	eeprom_persist_4: true,
});

function testSet(){
	var rand = Math.floor(Math.random() * 4096);
	dac.setAll(rand, true).then((r) => {
		console.log(rand);
		setTimeout(testGet, 500);
	}).catch(console.log);
}

function testGet(){
	dac.get().then((r) => {
		console.log(r);
		setTimeout(testSet, 1000);
	}).catch(console.log);
}

testSet();
