# homebridge-osc
OSC Plugin For Homebridge: https://github.com/nfarina/homebridge

This plugin sends and receives OSC commands and may be useful for getting Homekit events into DAWs, lighting scene controllers, etc. 

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install node osc package: npm install homebridge-osc (note that on Raspberry Pi I had to run 'sudo npm install -g --unsafe-perm')
3. Update your configuration file. See the sample below.

# Configuration

Configuration sample:

 ```
{
   "accessories": [
    {
      "accessory": "OSC",
      "adapter": "127.0.0.1",
      "port": 9001,
      "id": 32,
      "name": "grid-sleep",
      "service": "Switch"
    },
    {
      "accessory": "OSC",
      "adapter": "127.0.0.1",
      "port": 9001,
      "id": 34,
      "name": "grid-daylight",
      "service": "Switch"
    },
    {
      "accessory": "OSC",
      "adapter": "127.0.0.1",
      "port": 9001,
      "id":  35,
      "name": "grid-evening",
      "service": "Switch"
    }
  ]
}

```


