import { ThermostatNode, WeatherNode } from "hc-node-homie-smarthome";
import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo } from "../../ccu/CCU";
import { CCU_CH_TYPE_CLIMATECONTROL_RT_TRANSCEIVER, CCU_CH_TYPE_THERMALCONTROL_TRANSMIT, Channel } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";
import { log } from "./logging";
import { getIndexFromChannelAddress } from "../../ccu";
import { ThermostatMode } from "hc-node-homie-smarthome/model";

export function HMThermalControlToNode(device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) {
    if (channels.length === 1) {
        createWeatherNode(device, channels[0], conn);
        createThermalControlNode(device, channels[0], conn);
    } else {
        channels.forEach(channel => {
            const channelIndex = getIndexFromChannelAddress(channel.definition.ADDRESS);
            createWeatherNode(device, channel, conn, channelIndex);
            createThermalControlNode(device, channel, conn, channelIndex);
        })
    }
}


function createWeatherNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo, index?: string) {
    if (channel.definition.TYPE !== CCU_CH_TYPE_CLIMATECONTROL_RT_TRANSCEIVER) { return; }

    const thermostatChannel_Param_Temperature = 'ACTUAL_TEMPERATURE';

    const weatherNode = device.add(new WeatherNode(device, index ? { id: `weather-${index}`, name: `Weather ${index}` } : undefined, { temperature: true, humidity: false, tempUnit: 'C', pressure: false }));
    weatherNode.temperature = channel.readings[thermostatChannel_Param_Temperature].value;

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(weatherNode.onDestroy$)).subscribe(
        {
            next: message => {
                if (channel.definition.TYPE === CCU_CH_TYPE_CLIMATECONTROL_RT_TRANSCEIVER) {
                    if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_Temperature) {
                        weatherNode.temperature = message.value;
                    }
                }
            },
            error: (err) => {
                log.error(`Error process hm message for [${weatherNode.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )

}


function createThermalControlNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo, index?: string) {

    const thermostatChannel_Param_SetTemperature = 'SET_TEMPERATURE';
    const thermostatChannel_Param_WindowOpen = 'WINDOW_OPEN_REPORTING';
    const thermostatChannel_Param_Valve = 'VALVE_STATE';
    const thermostatChannel_Param_Boost_State = 'BOOST_STATE';
    const thermostatChannel_Param_Control_Mode = 'CONTROL_MODE';

    const hasValve = channel.definition.TYPE === CCU_CH_TYPE_CLIMATECONTROL_RT_TRANSCEIVER && !!channel.readings[thermostatChannel_Param_Valve];
    const hasWindowOpen = channel.definition.TYPE === CCU_CH_TYPE_THERMALCONTROL_TRANSMIT && !!channel.readings[thermostatChannel_Param_WindowOpen];

    const node = device.add(new ThermostatNode(device, index ? { id: `thermostat-${index}`, name: `Thermostat ${index}` } : undefined, {
        boost_state: true, mode: true, modes: ['auto', 'manual', 'party', 'boost'], tempUnit: 'C',
        valve: hasValve,
        windowopen:hasWindowOpen 
    }));
    node.setTemperature = channel.readings[thermostatChannel_Param_SetTemperature].value;
    if (hasValve) {
        node.valve = channel.readings[thermostatChannel_Param_Valve].value;
    }
    if (hasWindowOpen) {
        node.windowopen = channel.readings[thermostatChannel_Param_WindowOpen].value;
    }
    node.boostState = channel.readings[thermostatChannel_Param_Boost_State].value;
    node.opMode = getMode(channel.readings[thermostatChannel_Param_Control_Mode].value);


    // homie -> hm eventstream
    node.propSetTemperature.onSetMessage$.pipe(takeUntil(node.propSetTemperature.onDestroy$)).subscribe(
        {
            next: event => {

                log.verbose(`${node.propSetTemperature.pointer}: setting value to ${event.value} --> ${event.valueStr} --> ${typeof event.valueStr}`)
                conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { [thermostatChannel_Param_SetTemperature]: event.valueStr }).then(() => {
                    event.property.value = event.valueStr;
                }).catch((err) => {
                    log.error(`${node.propSetTemperature.pointer}: error setting value to ${event.valueStr} -- ${typeof event.valueStr}`, err)
                })

            },
            error: (err) => {
                log.error(`Error process set Event for [${node.propSetTemperature.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    );

    node.propMode.onSetMessage$.pipe(takeUntil(node.propMode.onDestroy$)).subscribe(
        {
            next: event => {

                const mode = event.valueStr as ThermostatMode;

                if (mode === 'manual') {
                    conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { ['MANU_MODE']: node.propSetTemperature.value }).then(() => {
                        event.property.value = event.valueStr;
                    }).catch((err) => {
                        log.error(`${node.propSetTemperature.pointer}: error setting value to ${mode} -- ${typeof mode}`, err)

                    })

                } else if (mode === 'auto') {
                    conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { ['AUTO_MODE']: true }).then(() => {
                        event.property.value = event.valueStr;
                    }).catch((err) => {
                        log.error(`${node.propSetTemperature.pointer}: error setting value to ${mode} -- ${typeof mode}`, err)
                    })
                } else if (mode === 'boost') {
                    conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { ['BOOST_MODE']: true }).then(() => {
                        event.property.value = event.valueStr;
                    }).catch((err) => {
                        log.error(`${node.propSetTemperature.pointer}: error setting value to ${mode} -- ${typeof mode}`, err)
                    })

                }
            },
            error: (err) => {
                log.error(`Error process set Event for [${node.propSetTemperature.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    );

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: message => {
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_Control_Mode) {
                    node.opMode = getMode(message.value);
                }
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_Boost_State) {
                    node.boostState = message.value;
                }
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_WindowOpen) {
                    node.windowopen = message.value;
                }
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_SetTemperature) {
                    node.setTemperature = message.value;
                }
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_Valve) {
                    node.valve = message.value;
                }

            },
            error: (err) => {
                log.error(`Error process hm message for [${node.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )
}


function getMode(ctlmode: number): ThermostatMode {
    if (ctlmode === 0) { return 'auto'; }
    if (ctlmode === 1) { return 'manual'; }
    if (ctlmode === 2) { return 'party'; }
    if (ctlmode === 3) { return 'boost'; }
}