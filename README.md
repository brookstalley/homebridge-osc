# homebridge-osc
OSC Plugin For Homebridge: https://github.com/nfarina/homebridge

This plugin sends and receives OSC commands and may be useful for getting Homekit events into DAWs, lighting scene controllers, etc. 

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-osc
3. Update your configuration file. See the sample below.

# Configuration

Configuration sample:

 ```
    {
       "accessories": [
			{
			  "accessory": "Midi",
			  "name": "sleep",
			  "port": "AudioBox 22VSL MIDI Out",
			  "channel": 1,
			  "note": 48,
			  "service": "Switch",
			  "characteristics": [
				{
				  "characteristic": "Brightness",
				  "port": "AudioBox 22VSL MIDI In 2",
				  "channel": 1,
				  "controller": 1
				}
			  ]
			},
			{
			  "accessory": "Midi",
			  "name": "wake",
			  "port": "AudioBox 22VSL MIDI Out",
			  "channel": 1,
			  "note": 49,
			  "service": "Switch",
			  "characteristics": [
				{
				  "characteristic": "Brightness",
				  "port": "AudioBox 22VSL MIDI In 2",
				  "channel": 1,
				  "controller": 2
				}
			  ]
			}
      ]
    }

```


