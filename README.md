# homebridge-midi
Midi Plugin For Homebridge: https://github.com/nfarina/homebridge

This plugin presents MIDI notes as switches to Homebridge, and may be useful for getting Homekit events into DAWs, lighting scene controllers, etc. 

Events can be sent bidirectionally. Currently the plugin supports sending notes to MIDI devices based on Homekit commands, and reflecting MIDI status as Homekit characteristics.

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

In that sample, when the Homekit "sleep" is triggered, MIDI note 48 (C3) will be sent to channel 1. And the "Brightness" characteristic of the Homekit device will reflect the latest value seen on channel 1, controller 1 (no scaling occurs; suggest you limit to 100 max).


