var osc = require("osc");

var Service, Characteristic;

var udpPorts = [];

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
};

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

    // Listen for incoming OSC bundles. 
    newPort.on("bundle", function (oscBundle) {
        var packets = oscBundle["packets"];

        packets.forEach(function (packet) {
            var address = packet["address"];
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
        }.bind(this));
    }.bind(this));

    // Open the socket. 
    newPort.open();

    udpPorts.push(newPort);
    return newPort;
}

//debugging helper only
//inspects an object and prints its properties (also inherited properties) 
var iterate = function nextIteration(myObject, path) {
    // this function iterates over all properties of an object and print them to the console
    // when finding objects it goes one level  deeper
    var name;
    if (!path) {
        console.log("---iterating--------------------")
    }
    for (name in myObject) {
        if (typeof myObject[name] !== 'function') {
            if (typeof myObject[name] !== 'object') {
                console.log((path || "") + name + ': ' + myObject[name]);
            } else {
                nextIteration(myObject[name], path ? path + name + "." : name + ".");
            }
        } else {
            console.log((path || "") + name + ': (function)');
        }
    }
    if (!path) {
        console.log("================================");
    }
};

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-osc", "OSC", OscAccessory);
}

function OscAccessory(log, config) {
    this.log = log;

    this.name = config["name"];
    this.accessoryType = config["service"] || "Switch";

    this.remoteAddress = config["remoteAddress"] || "255.255.255.255"; // Not really inet broadcast, will detect and use local subnet broadcast in send routine
    this.remotePort = parseInt(config["port"] || 9001);
    this.localAddress = config["localAddress"] || "0.0.0.0";
    this.localPort = config["localPort"] || 9001;
    this.address = config["address"];

    myGetUdpPort = getUdpPort.bind(this);
    this.udpPort = myGetUdpPort(this.localAddress, this.localPort);

    switch (this.accessoryType) {
        case "Multiswitch":
            this.switches = config["switches"];
            break;
        case "Switch":
            break;
        default:
            throw new Error("Unknown homebridge-osc accessory type");
    }

    this.log("OSC Accessory " + this.name + "(" + this.accessoryType + ") on " + this.remoteAddress + ":" + this.remotePort + this.address);
}

OscAccessory.prototype = {

    setPowerState: function (targetService, state, callback, context) {
        self = this;
        var myContext = "fromSetPowerState";
        
        if (context == myContext) {
            // It came from us, so don't get stuck in a loop
            if (callback) {
                callback();
            }
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
                var broadcast = (this.remoteAddress == "255.255.255.255") ? true : false;
                //this.log("Sending to " + this.address + " on " + this.remoteAddress + ":" + this.remotePort + " (broadcast: " + broadcast + "):");

                this.udpPort.send({
                    address: this.address,
                    //broadcast: broadcast,
                    args: args
                }, this.remoteAddress, this.remotePort);

                callback();
                break;

            case "Switch":
                // Obsolete code from single-switch accessory sending multiple messages. Might still come in handy. So here it is.
                this.oscRequest(this.messages, function (error, response) {
                    if (error) {
                        this.log('OSC function failed: %s', error.message);
                        callback(error);
                    } else {
                        this.log('OSC function succeeded');
                        callback();
                    }
                }.bind(this));
                callback();
                break;
            default:
                throw new Error("Unknown homebrdige-osc accessory type in setPowerState");
        }

    },

    getBrightness: function (callback) {
        this.log("Brightness requested!");
        this.log("Current brightness: " + this.brightness);
        callback(null, this.brightness);
    },

    setBrightness: function (value, callback) {
        this.log("Setting brightness to " + value);
        this._service.setCharacteristic(Characteristic.Brightness, value);
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
            default:
                throw new Error("Unknown homebridge-osc accessory type in getServices");
        }
        return this.services;
    }
};
