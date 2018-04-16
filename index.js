module.exports = class MCP4725{
	constructor(addr, comm, config){
		if(typeof config != 'object') config = {};
		this.config = Object.assign({
			vr_1: 1,
			pd_1: 0,
			gx_1: 0,
			eeprom_persist_1: false,
			eeprom_startup_1: false,
			eeprom_vr_1: 1,
			eeprom_pd_1: 0,
			eeprom_gx_1: 0,
			eeprom_dac_1: 2048,

			vr_2: 1,
			pd_2: 0,
			gx_2: 0,
			eeprom_persist_2: false,
			eeprom_startup_2: false,
			eeprom_vr_2: 1,
			eeprom_pd_2: 0,
			eeprom_gx_2: 0,
			eeprom_dac_2: 2048,

			vr_3: 1,
			pd_3: 0,
			gx_3: 0,
			eeprom_persist_3: false,
			eeprom_startup_3: false,
			eeprom_vr_3: 1,
			eeprom_pd_3: 0,
			eeprom_gx_3: 0,
			eeprom_dac_3: 2048,

			vr_4: 1,
			pd_4: 0,
			gx_4: 0,
			eeprom_persist_4: false,
			eeprom_startup_4: false,
			eeprom_vr_4: 1,
			eeprom_pd_4: 0,
			eeprom_gx_4: 0,
			eeprom_dac_4: 2048
		}, config);
		for(var i=1;i<5;i++){
			if(this.config["eeprom_persist_"+i]) this.config.startup = false;
			if(this.config["vr_"+i]) this.config["gx_"+i] = 0;
			if(this.config["eeprom_vr_"+i]) this.config["eeprom_gx_"+i] = 0;
		}
		this.comm = comm;
		this.addr = addr;
		this.initialized = false;
		this.status = {};
		this.raw = [];
		this.settable = ["channel_1", "channel_2", "channel_3", "channel_4", "all"];
		this.init();
	}
	init(){
		this.get().then((status) => {
			var promises = [];
			for(var i=1;i<5;i++){
				if(!this.config["eeprom_startup_"+i]) continue;
				var expected = this.buildCommand(
					this.config["eeprom_vr_"+i],
					this.config["eeprom_pd_"+i],
					this.config["eeprom_gx_"+i],
					this.config["eeprom_dac_"+i]);
				if(status["channel_"+i].eeprom.raw != ((expected[0] << 8) | expected[1])){
					promises.push(this.set(i, this.config["eeprom_dac_"+i], this.config["eeprom_vr_"+i], this.config["eeprom_pd_"+i], this.config["eeprom_gx_"+i], true));
				}
			}
			if(promises.length == 0){
				this.initialized = true;
				return;
			}
			Promise.all(promises).then(() => {
				this.initialized = true;
			}).catch((err) => {
				console.log(err);
				this.initialized = false;
			})
		}).catch((err) => {
			console.log(err);
			this.initialized = false;
		})
	}
	getBitsLow(v,b,l){
		var m = ((1 << l) - 1) << (b-l);
		return (v & m) >> (b-l);
	}
	parseStatus(status){
		for(var i=0;i<4;i+=1){
			var ch = i*6;
			var channel = status.slice(ch, ch+6)
			this.status["channel_"+(i+1)] = {
				ch: this.getBitsLow(channel[0], 6, 2),
				vr: this.getBitsLow(channel[1], 8, 1),
				pd: this.getBitsLow(channel[1], 7, 2),
				gx: this.getBitsLow(channel[1], 5, 1),
				dac: (this.getBitsLow(channel[1], 4, 4) << 8) | channel[2],
				raw: [channel[1], channel[2]],
				eeprom: {
					vr: this.getBitsLow(channel[4], 8, 1),
					pd: this.getBitsLow(channel[4], 7, 2),
					gx: this.getBitsLow(channel[4], 5, 1),
					dac: (this.getBitsLow(channel[4], 4, 4) << 8) | channel[5],
					raw: (channel[4] << 8) | channel[5]
				}
			};
		}
		return this.status;
	}
	buildCommand(vr, pd, gx, dac){
		return [
			(vr << 7) | (pd << 5) | (gx << 4) | (dac >> 8),
			(dac & 255)
		];
	}
	get(){
		return new Promise((fulfill, reject) => {
			this.comm.readBytes(this.addr, 24).then((r) => {
				this.initialized = true;
				fulfill(this.parseStatus(r));
			}).catch((err) => {
				this.initialized = false;
				reject(err);
			});
		});
	}
	set(dac, val, nostat){
		var _dac = this;
		return new Promise((fulfill, reject) => {
			var reg = 64;
			var promises = [];
			if(dac < 1){
				var cmd = reg;
				for(var i=0;i<4;i++){
					promises.push(_dac.set(i+1, val, true));
				}
			}else if(dac < 5){
				reg |= ((dac - 1) << 1);
				if(this.config["eeprom_persist_"+dac]) reg |= 24;
				var bytes = _dac.buildCommand(this.config["vr_"+dac], this.config["pd_"+dac], this.config["gx_"+dac], val);
				promises.push(_dac.comm.writeBytes(_dac.addr, reg, ...bytes));
			}else{
				reject('Invalid DAC channel: '+dac);
				return;
			}
			Promise.all(promises).then(() => {
				if(nostat){
					fulfill();
					return;
				}
				_dac.get().then((status) => {
					_dac.initialized = true;
					fulfill(status);
				}).catch((err) => {
					this.initialized = false;
					reject(err);
				});
			}).catch((err) => {
				this.initialized = false;
				reject(err);
			});

		});
	}
}
