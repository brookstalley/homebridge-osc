# homebridge-midi
Midi Plugin For Homebridge: https://github.com/nfarina/homebridge

This plugin presents MIDI notes as switches to Homebridge, and may be useful for getting Homekit events into DAWs, lighting scene controllers, etc. 

Notes are automatically turned off one second after being sent.

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-midi
3. Update your configuration file. See the sample below.

# Configuration

Configuration sample:

 ```
    {
       "accessories": [
			{
				"accessory": "Midi",
				"name": "note-c1",
				"port": "AudioBox 22VSL MIDI Out",
				"channel": 1,
				"note": 48,
				"service": "Switch"
			},
			{
				"accessory": "Midi",
				"name": "note-cs1",
				"port": "AudioBox 22VSL MIDI Out",
				"channel": 1,
				"note": 49,
				"service": "Switch"
			},
      ]
    }

```


