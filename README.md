# homecontrol homematic to homie
Publishes homematic devices from the CCU to mqtt using the homie convention.

[![works with MQTT Homie](https://homieiot.github.io/img/works-with-homie.png)](https://homieiot.github.io/)


__`hc-hm2homie` is part of:__

[![homie-homecontrol](https://avatars.githubusercontent.com/u/96332925?s=28&v=4)](https://github.com/homie-homecontrol) <span style="font-size:32px; font-weight: 700;">homie-homecontrol</span>  &nbsp;[link](https://github.com/homie-homecontrol)

# Docker image
```
docker pull ghcr.io/homie-homecontrol/hc-hm2homie:latest
```
See below for a usage example with docker compose.

# Configuration - Environment variables

All configuration is handled via environment variables.
## General config
`HCHM2H_CTRL_ID`

* id of homie device created for the controller .

`HCHM2H_CTRL_NAME`

* name of homie device created for the controller.

## MQTT Broker config

`HCHM2H_MQTT_URL`

* the connection address of the mqtt broker. This can be a `mqtt://` protocol address or `ws://` | `wss://` address depending on you scenario. If no port is specified defaults will be assumed. (mqtt: 1883, ws: 80, wss: 443)

`HCHM2H_MQTT_USERNAME`

* Username for the MQTT connection. If the MQTT broker is unsecured this can be left empty.

`HCHM2H_MQTT_PASSWORD`

* Password for the MQTT connection. If the MQTT broker is unsecured this can be left empty.

`HCHM2H_MQTT_TOPIC_ROOT`

* MQTT topic under which all homie devices are published. By convention this defaults to `homie`, however for your testing or developing reasons this can be changed here as not to disturb productive usage.


## Homematic/CCU config

`HCHM2H_CCU_HOST`

* host or ip of ccu

`HCHM2H_CCU_PORT`

* port of ccu

`HCHM2H_CCU_INTERFACES`

* comma seperated list of ccu interfaces to use, must be one or several of: `bidcos-wired`, `bidcos-rf`, `hmip-rf`, `virt`, `cuxd`
* **Note**: currently only `bidcos-rf` and `hmip-rf` are supported. 

`HCHM2H_CCU_CALLBACK_HOST`

* Communication between CCU and hc-hm2homie works in a way that the CCU actually also opens a connection up back to hc-hm2homie. If you run this in a container without host networking make sure to set this to the IP of the system where the container is running on and als open/bind the port specified in `CCU_CALLBACK_PORT` to conainter.

`HCHM2H_CCU_CALLBACK_BIND_HOST`

* This is the IP/hostname to bind the listening socket of hc-hm2homie to. Will default to '0.0.0.0'. 

`CCU_CALLBACK_PORT`

* The port to listen to for connection from the CCU. Defaults to 9125.

`HCHM2H_CCU_CALLBACK_ID`

* Every client connection needs its own ID. If you connect with multiple hc-hm2homie containers to the same CCU make sure to set these IDs different on each container.


# Example docker-compose config

You can use the ready made example in the `example` folder.
* clone this repo
* `cd hc-hm2homie/examples`
* adjust your CCU connection info in the file `docker-compose.yaml`
* `docker-compose up`

```yaml
services:
    mqtt:
        image: eclipse-mosquitto:latest
        restart: "always"
        deploy:
            resources:
                limits:
                    memory: 125M
        hostname: mqtt
        ports: 
            - "1883:1883"
        volumes:
            - ./mqtt/config/mosquitto.conf:/mosquitto/config/mosquitto.conf
            - ./mqtt/data:/mosquitto/data
            - ./mqtt/log:/mosquitto/log
    hm2homie:
        image: ghcr.io/homie-homecontrol/hc-hm2homie:latest
        restart: "always"
        depends_on:
            - mqtt
        ports: 
            - "9125:9125"
        deploy:
            resources:
                limits:
                    memory: 1000M
        # network_mode: host
        environment: 
            HCHM2H_CTRL_ID: hc-hm2homie-ctrl1
            HCHM2H_CTRL_NAME: Homematic to homie interface controller
            HCHM2H_CCU_HOST: <CCU host or IP>
            HCHM2H_CCU_INTERFACES: <bidcos-rf, hmip-rf>
            HCHM2H_CCU_CALLBACK_HOST: <Hostname or IP of system where container is runnning>
            HCHM2H_CCU_CALLBACK_PORT: "9125"
            HCHM2H_CCU_CALLBACK_ID: "HCHM2H"
            HCHM2H_MQTT_URL: "mqtt://mqtt"
            HCHM2H_MQTT_TOPIC_ROOT: homie


```