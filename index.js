var osc = require("osc"); var Service, Characteristic; var udpPorts = []; process.on('uncaughtException', function (er) {
    console.error(er.stack)
    process.exit(1)
})
var getIPAddresses = function () {
    var os = require("os"),
        interfaces = os.networkInterfaces(),
        ipAddresses = [];
    for (var deviceName in interfaces) {
        var addresses = interfaces[deviceName];
        for (var i = 0; i < addresses.length; i++) {
            var addressInfo = addresses[i];
            if (addressInfo.family === "IPv4" && !addressInfo.internal) {
                ipAddresses.push(addressInfo.address);
            }
        }
    }
    return ipAddresses;
}
function getUdpPort(localAddress, localPort) {
    udpPorts.forEach(function (port) {
        if (port.localAddress == localAddress && port.localPort == localPort) {
            return port;
        }
    });
    var newPort = new osc.UDPPort({
        localAddress: localAddress,
        localPort: localPort
    });
    newPort.on("ready", function () {
        var ipAddresses = getIPAddresses();
        ipAddresses.forEach(function (ipAddress) {
            console.log(" OSC listening on host:", ipAddress + ":", localPort);
        });
    });
    newPort.on("message", function (message) {
        //this.log("Got OSC message");
    }.bind(this));
    // Listen for incoming OSC bundles.
    newPort.on("bundle", function (oscBundle) {
        //this.log("Got OSC bundle");
        var packets = oscBundle["packets"];
        packets.forEach(function (packet) {
            var address = packet["address"];
            this.log("Address: " + address + ", my address: " + this.address);
            var args = packet["args"];
            if (address == this.address) {
                this.log("OSC packet for " + this.name + " with args " + args.join(","));
                // If we're a multiswitch, need to configure the current values of each switch
                for (var i = 0; i < args.length; i++) {
                    if (parseInt(args[i]) > 0) {
                        newValue = true;
                    } else {
                        newValue = false;
                    }
                    this.services[i].getCharacteristic(Characteristic.On).setValue(newValue, undefined, "fromSetPowerState");
                }
            }
            if (this.hsb) {
                if (address == this.address + "/hue") {
                    this.log("Setting hue...");
                    var value = parseFloat(args[0]);
                    this.services[0].getCharacteristic(Characteristic.Hue).setValue(value * 360, undefined);
                }
                if (address == this.address + "/saturation") {
                    this.log("Setting saturation...");
                    var value = parseFloat(args[0]);
                    this.services[0].getCharacteristic(Characteristic.Saturation).setValue(value, undefined);
                }
                if (address == this.address + "/intensity") {
                    this.log("Setting brightness...");
                    var value = parseFloat(args[0]);
                    this.services[0].getCharacteristic(Characteristic.Brightness).setValue(value, undefined);
                }
            }
        }.bind(this));
    }.bind(this));
    // Open the socket.
    newPort.open();
    udpPorts.push(newPort);
    return newPort;
}
module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-osc", "OSC", OscAccessory);
}
function OscAccessory(log, config) {
    this.log = log;
    this.name = config["name"];
    this.accessoryType = config["service"] || "unknown";
    this.remoteAddress = config["remoteAddress"] || "255.255.255.255"; // Not really inet broadcast, will detect and use local subnet broadcast in send routine
    this.remotePort = parseInt(config["port"] || 9001);
    this.localAddress = config["localAddress"] || "0.0.0.0";
    this.localPort = config["localPort"] || false;
    this.address = config["address"];
    if (this.localPort) {
        myGetUdpPort = getUdpPort.bind(this);
        this.udpPort = myGetUdpPort(this.localAddress, this.localPort);
    }
    switch (this.accessoryType) {
        case "Multiswitch":
            this.switches = config["switches"];
            break;
        case "Lightbulb":
            this.hsb = config["hsb"] || false;
        case "Switch":
            break;
        default:
            throw new Error("Unknown homebridge-osc accessory type");
    }
    this.log("OSC Accessory " + this.name + "(" + this.accessoryType + ") on " + this.remoteAddress + ":" + this.remotePort + this.address);
}
OscAccessory.prototype = {
    sendOSC: function (args, characteristic) {
        characteristic = characteristic || false;
        var broadcast = (this.remoteAddress == "255.255.255.255") ? true : false;
        var toAddress;
        if (characteristic) {
            toAddress = this.address + "/" + characteristic;
        } else {
            toAddress = this.address;
        }
        this.udpPort.send({
            address: toAddress,
            //broadcast: broadcast,
            args: args
        }, this.remoteAddress, this.remotePort);
    },
    setPowerState: function (targetService, state, callback, context) {
        var myContext = "fromSetPowerState";
        
        if (context == myContext) {
            // It came from us, so don't get stuck in a loop
            if (callback) { callback(); }
            return;
        }
        if (state) {
            value = 100;
        } else {
            value = 0;
        }
        switch (this.accessoryType) {
            case "Multiswitch":
                var args = [];
                this.services.forEach(function (service) {
                    // If this is our switch, add 1 to the OSC output, otherwise add 0 and set to off, supplying the context
                    // so it doesn't trigger an OSC message (we'll send 0 here) or endless loop (which is bad form).
                    if (targetService.subtype == service.subtype) {
                        args.push(1);
                    } else {
                        args.push(0);
                        service.getCharacteristic(Characteristic.On).setValue(false, undefined, myContext);
                    }
                }
                );
                
                this.sendOSC(args, false);
                callback();
                break;
            case "Lightbulb":
                // Todo: Implement
                callback();
                break;
            default:
                throw new Error("Unknown homebrdige-osc accessory type '" + this.accessoryType + "' in setPowerState");
        }
    },
    getHue: function (targetService, callback) {
        this.log("Hue requested; current hue: " + this.hue);
        callback(null, this.hue);
    },
    setHue: function (targetService, value, callback, context) {
        var myContext = "fromHue";
        if (context == myContext) {
            // It came from us, so don't get stuck in a loop
            if (callback) { callback(); }
            return;
        }
        this.log("Setting hue to " + value);
        this.services[0].getCharacteristic(Characteristic.Hue).setValue(value, undefined, myContext);
        // Need to map hue to 0.0 - 1.0 range
        var oscHue = (value / 360.0);
        this.sendOSC([oscHue],"hue");
        callback();
    },
    getSaturation: function (targetService, callback) {
        this.log("Saturation requested; current saturation: " + this.saturation);
        callback(null, this.saturation);
    },
    setSaturation: function (targetService, value, callback, context) {
        var myContext = "fromSaturation";
        this.log("setSaturation called");
        if (context == myContext) {
            // It came from us, so don't get stuck in a loop
            this.log("From my context");
            if (callback) { callback(); }
            return;
        }
        this.log("Setting saturation to " + value);
        this.services[0].getCharacteristic(Characteristic.Saturation).setValue(value, undefined, myContext);
        this.sendOSC([value],"saturation");
        callback();
    },
    getBrightness: function (targetService, callback) {
        this.log("Brightness requested; current brightness: " + this.brightness);
        callback(null, this.brightness);
    },
    setBrightness: function (targetService, value, callback, context) {
        var myContext = "fromBrightness";
        if (context == myContext) {
            // It came from us, so don't get stuck in a loop
            if (callback) { callback(); }
            return;
        }
        this.log("Setting brightness to " + value);
        this.services[0].getCharacteristic(Characteristic.Brightness).setValue(value, undefined, myContext);
        this.sendOSC([value],"intensity");
        callback();
    },
    identify: function (callback) {
        this.log("Identify requested!");
        callback(); // success
    },
    getServices: function () {
        var self = this;
        this.services = [];
        // you can OPTIONALLY create an information service if you wish to override
        // the default values for things like serial number, model, etc.
        var informationService = new Service.AccessoryInformation();
        informationService
			.setCharacteristic(Characteristic.Manufacturer, "OSC Manufacturer")
			.setCharacteristic(Characteristic.Model, "OSC Model")
			.setCharacteristic(Characteristic.SerialNumber, "OSC Serial Number");
        //this.services.push(informationService);
        switch (this.accessoryType) {
            case "Switch":
                this._service = new Service.Switch(this.name);
                this._service
				    .getCharacteristic(Characteristic.On)
				    .on('set', this.setPowerState.bind(this));
                this._service
                    .addCharacteristic(Characteristic.Brightness)
                    .on('set', this.setBrightness.bind(this))
                    .on('get', this.getBrightness.bind(this));
                this.services.push(this._service);
                break;
            case "Multiswitch":
                // Multiple switches in a radio button style
                // Turning one on will turn the others off. Switches are sent as args to the specified address in the order
                // they appear in the config file. If switches = ["alpha", "beta"], selecting alpha will send "/osc 1.0 0"; selecting
                // beta will sent "/osc 0 1.0"
                this.log("Adding multiswitch to " + this.name);
                for (var i = 0; i < this.switches.length; i++) {
                    var switchName = this.switches[i];
                    var service = new Service.Switch(switchName, switchName);
                    // Bind a copy of the setPowerState function that sets "this" to the accessory and the first parameter
                    // to the particular service that it is being called for.
                    var mySetPowerState = this.setPowerState.bind(this, service);
                    service.getCharacteristic(Characteristic.On).on('set', mySetPowerState);
                    this.services.push(service);
                    this.log("Added switch " + switchName + " to " + this.name)
                }
                break;
            case "Lightbulb":
                // A light bulb, or something that looks like one. Optionally with HSB.
                this.log("Adding lightbulb to " + this.name);
                var service = new Service.Lightbulb(this.name);
                var mySetPowerState = this.setPowerState.bind(this, service);
                service.getCharacteristic(Characteristic.On).on('set', mySetPowerState);
                if (this.hsb) {
                    this.hue = 0;
                    this.saturation = 0;
                    this.brightness = 0;
                    service
                        .addCharacteristic(Characteristic.Hue)
                        .on('set', this.setHue.bind(this,service))
                        .on('get', this.getHue.bind(this, service));
                    service
                        .addCharacteristic(Characteristic.Saturation)
                        .on('set', this.setSaturation.bind(this, service))
                        .on('get', this.getSaturation.bind(this, service));
                    service
                        .addCharacteristic(Characteristic.Brightness)
                        .on('set', this.setBrightness.bind(this, service))
                        .on('get', this.getBrightness.bind(this, service));
                }
                this.services.push(service);
                this.log("Added lightbulb to " + this.name)
                break;
            default:
                throw new Error("Unknown homebridge-osc accessory type in getServices");
        }
        return this.services;
    }
};
