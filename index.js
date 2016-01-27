var osc = require("osc");

var Service, Characteristic;

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

var udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 8000
});

udpPort.on("ready", function () {
    var ipAddresses = getIPAddresses();

    console.log("Listening for OSC over UDP.");
    ipAddresses.forEach(function (address) {
        console.log(" OSC listening on host:", address + ":", udpPort.options.localPort);
    });
});

// Listen for incoming OSC bundles. 
udpPort.on("bundle", function (oscBundle) {
    console.log("An OSC bundle just arrived!", oscBundle);
});

// Open the socket. 
udpPort.open();

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-osc", "OSC", OscAccessory);
}

function OscAccessory(log, config) {
    this.log = log;

    this.remoteAddress = config["remoteAddress"] || "255.255.255.255"; // Not really inet broadcast, will detect and use local subnet broadcast in send routine
    this.remotePort = parseInt(config["port"] || 9001);
    this.service = config["service"] || "Switch";
    this.name = config["name"];
    this.messages = config["messages"];
    this.log("OSC Accessory '" + this.name + "' on " + this.remoteAddress + ":" + this.remotePort + this.address + " ID " + this.id);

    this.brightness = 0;
    if (characteristics = config["characteristics"]) {
        characteristics.forEach(function (characteristic) {
            var characteristicPort = characteristic["port"];
            var characteristicType = characteristic["characteristic"];
            var port = characteristic["port"];
            var channel = characteristic["channel"];
            var controller = characteristic["controller"];
            var inPortNumber = InPortNumberFromName(port);
            var inPort = InputForPortNumber(inPortNumber);
            console.log('Adding MIDI input monitor for port ' + inPortNumber + ', channel ' + channel + ', controller ' + controller);
            var newWatch = {
                portNumber: inPortNumber, channel: channel, controller: controller, callback: function (value) {
                    //console.log("Got a value!");
                    if (value != this.brightness) {
                        //console.log("*** Setting brightness to " + value);

                        this.brightness = (value <= 100 ? value : 100);
                        console.log("*** Brightness for " + this.name + " now " + this.brightness)
                    }
                }.bind(this)
            };
            midiWatches.push(newWatch);

        }.bind(this))
    }
}

OscAccessory.prototype = {

    oscRequest: function (remoteAddress, remotePort, messages, callback) {
        // Send an OSC message to, say, SuperCollider 

        var b = (remoteAddress == "255.255.255.255") ? true : false;

        Object.keys(this.messages).forEach(function (address) {
            console.log("Sending to " + address + " on " + remoteAddress + ":" + remotePort + " (broadcast: " + b + ")");
            udpPort.send({
                address: address,
                //broadcast: b,
                args: messages[address]
            }, remoteAddress, remotePort);
            console.log("Sent OSC message");
        })

        callback();
    },

    setPowerState: function (State, callback) {
        var velocity;
        var action;

        if (State) {
            value = 1.0;
        } else {
            value = 0.0;
        }
        this.oscRequest(this.remoteAddress, this.remotePort, this.messages, function (error, response) {
            if (error) {
                this.log('OSC function failed: %s', error.message);
                callback(error);
            } else {
                this.log('OSC function succeeded');
                callback();
            }
        }.bind(this));
    },

    getBrightness: function (callback) {
        this.log("Brightness requested!");
        console.log("Current brightness: " + this.brightness);
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

        // you can OPTIONALLY create an information service if you wish to override
        // the default values for things like serial number, model, etc.
        var informationService = new Service.AccessoryInformation();

        informationService
			.setCharacteristic(Characteristic.Manufacturer, "OSC Manufacturer")
			.setCharacteristic(Characteristic.Model, "OSC Model")
			.setCharacteristic(Characteristic.SerialNumber, "OSC Serial Number");

        if (this.service == "Switch") {
            this._service = new Service.Switch(this.name);

            this._service
				.getCharacteristic(Characteristic.On)
				.on('set', this.setPowerState.bind(this));

            this._service
                .addCharacteristic(Characteristic.Brightness)
                .on('set', this.setBrightness.bind(this))
                .on('get', this.getBrightness.bind(this));

            return [this._service];
        }
    }
};
