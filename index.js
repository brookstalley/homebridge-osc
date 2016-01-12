var Service, Characteristic;

var midi = require("midi");
var midiOutputs = [];
var midiInputs = [];
var midiWatches = [];

// Midi -- return port number or throw error if not found
function OutPortNumberFromName(portName) {
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

// Midi -- return port number or throw error if not found
function InPortNumberFromName(portName) {
    var inp = new midi.input();
    for (var i = 0; i < inp.getPortCount() ; i++) {
        console.log('Checking port ' + i + '(' + inp.getPortName(i) + ')');
        if (inp.getPortName(i) == portName) {
            console.log("Got output #" + i + " for port " + portName);
            return i;
        }
    }
    throw new Error("Couldn't find MIDI port '" + portName + "'");
}

function InputForPortNumber(portNumber) {
    if (typeof midiInputs[portNumber] == 'undefined') {
        console.log("Adding output #" + portNumber);
        midiInputs[portNumber] = new midi.input();
        midiInputs[portNumber].on('message', function (deltaTime, message) {
            MidiInput(portNumber, deltaTime, message);
        });
        midiInputs[portNumber].openPort(portNumber);

    }
    return midiInputs[portNumber];
}

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-midi", "Midi", MidiAccessory);
}

function MidiInput(portNumber, deltaTime, message) {
    // The message is an array of numbers corresponding to the MIDI bytes:
    //   [status, data1, data2]
    // https://www.cs.cf.ac.uk/Dave/Multimedia/node158.html has some helpful
    // information interpreting the messages.
    //console.log('p: ' + port + ', m:' + message + ' d:' + deltaTime);
    messageType = message[0];
    controller = message[1];
    value = message[2];
    //console.log("Got input for port " + portNumber + ", message " + messageType);
    if (messageType >= 176 && messageType < 192) {
        channel = messageType - 175;
        controller = controller + 1;
        //console.log("Got input for port " + portNumber + ", channel " + channel + ", controller " + controller + " (" + value + ")");
        midiWatches.forEach(function (watch) {

            if (portNumber == watch.portNumber && channel == watch.channel && controller == watch.controller) {
                //console.log("Triggered watch for port " + portNumber + ", channel " + channel + ", controller " + controller + " (" + value + ")");
                watch.callback(value);
            } else {
                //console.log("No match for watch port " + watch.portNumber + ", channel " + watch.channel + ", controller " + watch.controller);
            }
        })
    }

}

function MidiAccessory(log, config) {
    this.log = log;

    this.outPortNumber = OutPortNumberFromName(config["port"]);
    this.channel = parseInt(config["channel"] || 1);
    this.note = config["note"];
    this.log("  port " + this.outPortNumber + ", channel " + this.channel + ", note " + this.note);
    this.service = config["service"] || "Switch";
    this.name = config["name"];
    this.brightness = 0;
    if (characteristics = config["characteristics"] ) {
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

MidiAccessory.prototype = {

    midiRequest: function (outPortNumber, action, channel, note, velocity, callback) {
        if (action == 'noteon') {
            byteOne = 144 + (channel - 1);
        } else if (action == 'noteoff') {
            byteOne = 128 + (channel - 1);
        } else {
            throw new Error("Unrecognized MIDI action");
        }
        var bytes = [byteOne, note, velocity];
        OutputForPortNumber(outPortNumber).sendMessage(bytes);
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
        this.midiRequest(this.outPortNumber, action, this.channel, this.note, velocity, function (error, response) {
            if (error) {
                this.log('Midi function failed: %s', error.message);
                callback(error);
            } else {
                this.log('Midi function succeeded');
                callback();
            }
        }.bind(this));
    },

    getBrightness: function(callback) {
        this.log("Brightness requested!");
        console.log("Current brightness: " + this.brightness);
        callback(null, this.brightness);
    },

    setBrightness: function(value, callback) {
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
			.setCharacteristic(Characteristic.Manufacturer, "Midi Manufacturer")
			.setCharacteristic(Characteristic.Model, "Midi Model")
			.setCharacteristic(Characteristic.SerialNumber, "Midi Serial Number");

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
