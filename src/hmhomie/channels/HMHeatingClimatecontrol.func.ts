import { ThermostatNode, WeatherNode } from "hc-node-homie-smarthome";
import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo } from "../../ccu/CCU";
import { Channel } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";
import { log } from "./logging";
import { getIndexFromChannelAddress } from "../../ccu";
import { ThermostatMode } from "hc-node-homie-smarthome/model";
import { HeatingWeekProgramNode } from "../nodes/HeatingWeekprogramNode";

export function HMHeatingClimatecontrolToNode(device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) {
    if (channels.length === 1) {
        createWeatherNode(device, channels[0], conn);
        createWeekProgramNode(device, channels[0], conn);
        createThermalControlNode(device, channels[0], conn);
    } else {
        channels.forEach(channel => {
            const channelIndex = getIndexFromChannelAddress(channel.definition.ADDRESS);
            createWeatherNode(device, channel, conn, channelIndex);
            createWeekProgramNode(device, channel, conn, channelIndex);
            createThermalControlNode(device, channel, conn, channelIndex);
        })
    }

}

function createWeatherNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo, index?: string) {

    const thermostatChannel_Param_Temperature = 'ACTUAL_TEMPERATURE';
    const thermostatChannel_Param_Humidity = 'HUMIDITY';

    const hasHumidity = !!channel.readings[thermostatChannel_Param_Humidity];

    const node = device.add(new WeatherNode(device, index ? { id: `weather-${index}`, name: `Weather ${index}` } : undefined, { temperature: true, humidity: hasHumidity, tempUnit: 'C', pressure: false }));
    node.temperature = channel.readings[thermostatChannel_Param_Temperature].value;
    if (hasHumidity) {
        node.humidity = channel.readings[thermostatChannel_Param_Humidity].value
    };

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: message => {
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_Temperature) {
                    node.temperature = message.value;
                }
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_Humidity) {
                    node.humidity = message.value;
                }
            },
            error: (err) => {
                log.error(`Error updating weather information for [${node.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )


}


function createWeekProgramNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo, index?: string) {

    const thermostatChannel_Param_Active_Profile = 'ACTIVE_PROFILE';

    const node = device.add(new HeatingWeekProgramNode(device, index ? { id: `weekprogram-${index}`, name: `Control active weekprogram ${index}` } : undefined,false));
    node.activeProgram = channel.readings[thermostatChannel_Param_Active_Profile].value;

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: message => {
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_Active_Profile) {
                    node.activeProgram = message.value;
                }
            },
            error: (err) => {
                log.error(`Error updating weekprogram information for [${node.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    );

    // homie -> hm eventstream
    node.propActiveProgram.onSetMessage$.pipe(takeUntil(node.propActiveProgram.onDestroy$)).subscribe(
        {
            next: event => {

                log.verbose(`${event.property.pointer}: setting value to ${event.value} --> ${event.valueStr} -- ${typeof event.valueStr}`)
                conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { [thermostatChannel_Param_Active_Profile]: event.value }).then(() => {
                    event.property.value = event.valueStr;
                }).catch((err) => {
                    log.error(`${event.property.pointer}: error setting value to ${event.valueStr} -- ${typeof event.valueStr}`, err)
                })

            },
            error: (err) => {
                log.error(`Error process set Event for [${node.propActiveProgram.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    );


}



function createThermalControlNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo, index?: string) {

    const thermostatChannel_Param_SetPointTemperature = 'SET_POINT_TEMPERATURE';
    const thermostatChannel_Param_Level = 'LEVEL';
    const thermostatChannel_Param_Boost_Time = 'BOOST_TIME';
    const thermostatChannel_Param_SetPoint_Mode = 'SET_POINT_MODE';

    const hasValve = !!channel.readings[thermostatChannel_Param_Level];

    const node = device.add(new ThermostatNode(device, index ? { id: `thermostat-${index}`, name: `Thermostat ${index}` } : undefined, {
        boost_state: true, mode: true, modes: ['auto', 'manual', 'boost'], tempUnit: 'C',
        valve: hasValve,
        windowopen: false // Not supported at the moment (TODO: need to add later when paired device is available)
    }));
    node.setTemperature = channel.readings[thermostatChannel_Param_SetPointTemperature]?.value;

    // Valve
    if (hasValve) {
        node.valve = channel.readings[thermostatChannel_Param_Level].value * 100;
    }

    // // window open
    // if (channel.definition.TYPE === CCU_CH_TYPE_THERMALCONTROL_TRANSMIT) {
    //     node.windowopen = channel.readings[thermostatChannel_Param_WindowOpen].value;
    // }

    node.boostState = channel.readings[thermostatChannel_Param_Boost_Time]?.value;
    node.opMode = getMode(channel.readings[thermostatChannel_Param_SetPoint_Mode].value);

    // homie -> hm eventstream
    node.propSetTemperature.onSetMessage$.pipe(takeUntil(node.propSetTemperature.onDestroy$)).subscribe(
        {
            next: event => {

                log.verbose(`${node.propSetTemperature.pointer}: --> ${event.value} (${typeof event.value})`)

                conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { [thermostatChannel_Param_SetPointTemperature]: event.value }).then(() => {
                    event.property.value = event.valueStr;
                }).catch((err) => {
                    log.error(`${node.propSetTemperature.pointer}: error setting temperature value to ${event.value} -- ${typeof event.value}`, err)
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

                if (mode === 'boost') {
                    conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { ['BOOST_MODE']: true }).then(() => {
                        event.property.value = event.valueStr;
                    }).catch((err) => {
                        log.error(`${node.propMode.pointer}: error setting value to ${mode} -- ${typeof mode}`, err)
                    })
                } else {
                    const modeNum = { 'auto': 0, 'manual': 1, 'party': 3, }[event.valueStr];

                    conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { ['CONTROL_MODE']: modeNum }).then(() => {
                        event.property.value = event.valueStr;
                    }).catch((err) => {
                        log.error(`${node.propMode.pointer}: error setting value to ${mode}(${modeNum}) -- ${typeof mode}`, err)
                    })
                }

            },
            error: (err) => {
                log.error(`Error process set Event for [${node.propMode.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    );

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: message => {

                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_SetPoint_Mode) {
                    node.opMode = getMode(message.value);
                }
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_Boost_Time) {
                    node.boostState = message.value;
                }
                // if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_WindowOpen) {
                //     node.windowopen = message.value;
                // }
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_SetPointTemperature) {
                    node.setTemperature = message.value;
                }

                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === thermostatChannel_Param_Level) {
                    node.valve = message.value * 100;
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
