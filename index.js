var Service, Characteristic;

var midi = require("midi");
var midiOutputs = [];

// Midi -- return port number or throw error if not found
function PortNumberFromName(portName) {
    var out = new midi.output();
    for (var i = 0; i < out.getPortCount() ; i++) {
        if (out.getPortName(i) == portName) {
            //console.log("Got output #" + i + " for port " + portName);
            return i;
        }
    }
    throw new Error("Couldn't find MIDI port '" + portName + "'");
}

function OutputForPortNumber(portNumber) {
    if (typeof midiOutputs[portNumber] == 'undefined') {
        midiOutputs[portNumber] = new midi.output();
        midiOutputs[portNumber].openPort(portNumber);
        //console.log("Adding output #" + portNumber);
    }
    return midiOutputs[portNumber];
}

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-midi", "Midi", MidiAccessory);
}

function MidiAccessory(log, config) {
    this.log = log;

    this.portNumber = PortNumberFromName(config["port"]);
    this.channel = parseInt(config["channel"] || 1);
    this.note = config["note"];
    this.log("  port " + this.portNumber + ", channel " + this.channel + ", note " + this.note);
    this.service = config["service"] || "Switch";
    this.name = config["name"];
}

MidiAccessory.prototype = {

    midiRequest: function (portNumber, action, channel, note, velocity, callback) {
        if (action == 'noteon') {
            byteOne = 144 + (channel - 1);
        } else if (action == 'noteoff') {
            byteOne = 128 + (channel - 1);
        } else {
            throw new Error("Unrecognized MIDI action");
        }
        var bytes = [byteOne, note, velocity];
        OutputForPortNumber(portNumber).sendMessage(bytes);
        this.log("Sent MIDI message " + bytes);
        callback();
    },

    setPowerState: function (State, callback) {
        var velocity;
        var action;

        if (State) {
            action = 'noteon';
            velocity = 127;
            // Make it turn back off in a second since we're just emitting the event
            setTimeout(function () {
                this._service.setCharacteristic(Characteristic.On, false);
            }.bind(this), 1000);

        } else {
            action = 'noteoff';
            velocity = 0;
        }
        this.midiRequest(this.portNumber, action, this.channel, this.note, velocity, function (error, response) {
            if (error) {
                this.log('Midi function failed: %s', error.message);
                callback(error);
            } else {
                this.log('Midi function succeeded');
                callback();
            }
        }.bind(this));
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
			.setCharacteristic(Characteristic.Manufacturer, "Midi Manufacturer")
			.setCharacteristic(Characteristic.Model, "Midi Model")
			.setCharacteristic(Characteristic.SerialNumber, "Midi Serial Number");

        if (this.service == "Switch") {
            this._service = new Service.Switch(this.name);

            this._service
				.getCharacteristic(Characteristic.On)
				.on('set', this.setPowerState.bind(this));

            return [this._service];
        }
    }
};
