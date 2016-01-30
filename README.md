# homebridge-osc
OSC Plugin For Homebridge: https://github.com/nfarina/homebridge

This plugin sends and receives OSC commands and may be useful for getting Homekit events into DAWs, lighting scene controllers, etc. 

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install node osc package: npm install homebridge-osc (note that on Raspberry Pi I had to run 'sudo npm install -g --unsafe-perm')
3. Update your configuration file. See the sample below.

*** Raspberry Pi notes:
1. If errors with serialport, try sudo npm install -g --unsafe-perm serialport


# Configuration

At present, this plugin only supports the "multiswitch" service type, which groups a number of virtual switches in radio-button style (turn one on, the others turn off). This is designed to switch scenes on a lighting controller, but can probably be used for other purposes. 

The "address" field is the OSC address to be sent and received on. For the multiswitch type, each of the switches' state is sent as an argument to that address, and any OSC messages recevied on that address are used to set Homekit switch statuses. This enables bidirectional Homekit /  OSC integration with all systems having the correct current state.

In the below example, using a Homekit application to turn the "Daytime" switch on will send the OSC message "/0/grid-switch/x 0 0 100 0 0 0 0 0" via UDP to 10.0.0.9:9001

If the message "/0/grid-switch/x 0 0 0 0 0 0 100 0" is received on any local IP address, port 8000, Homekit state will be updated to reflect that the "Bedtime" switch is on and all others are off.

Configuration sample:

 ```
{
  "accessories": [
    {
      "accessory": "OSC",
      "name": "Grid Select",
      "localAddress": "0.0.0.0",
      "localPort":  8000,
      "remoteAddress": "10.0.0.9",
      "remotePort": 9001,
      "address": "/0/grid-switch/x",
      "service": "Multiswitch",
      "switches": [
        "Sleep",
        "Wake",
        "Daytime",
        "Evening",
        "Evening2",
        "Movie",
        "Bedtime",
        "Blacklight"
      ]
    }
  ]
}

```


