import { CCUConnectionInfo } from "../../ccu";
import { CCUChannelTypes, Channel, Device } from "../../ccu";
import { FactoryDevice } from "../FactoryDevice";
import { HMKeyToNode } from "./HMKey.func";
import { HMShutterContactToNode } from "./HMShutterContact.func";
import { HMMaintenanceToNode } from "./HMMaintenance.func";
import { HMSwitchToNode } from "./HMSwitch.func";
import { HMThermalControlToNode } from "./HMThermalControl.func";
import { HMWeatherToNode } from "./HMWeather.func";
import { log } from "./logging";
import { HMTiltToNode } from "./HMTilt.func";
import { HMBlindToNode } from "./HMBlind.func";
import { HMPowermeterToNode } from "./HMPowermeter.func";
import { HMConditionCurrentToNode } from "./HMConditionCurrent.func";
import { HMConditionPowerToNode } from "./HMConditionPower.func";
import { HMConditionFrequencyToNode } from "./HMConditionFrequency.func";
import { HMConditionVoltageToNode } from "./HMConditionVoltage.func";
import { HMVirtualKeyToNode } from "./HMVirtualKey.func";
import { NodeCreatorMap } from "./hmhomie.model";
import { HMHeatingClimatecontrolToNode } from "./HMHeatingClimatecontrol.func";

const nodeMap: NodeCreatorMap = {
    'MAINTENANCE': HMMaintenanceToNode,
    'SWITCH': HMSwitchToNode,
    'WEATHER': HMWeatherToNode,
    'KEY': HMKeyToNode,
    'WEATHER_TRANSMIT': HMWeatherToNode,
    'THERMALCONTROL_TRANSMIT': HMThermalControlToNode,
    'CLIMATECONTROL_RT_TRANSCEIVER': HMThermalControlToNode,
    'HEATING_CLIMATECONTROL_TRANSCEIVER': HMHeatingClimatecontrolToNode,
    'SHUTTER_CONTACT': HMShutterContactToNode,
    'TILT_SENSOR': HMTiltToNode,
    'BLIND': HMBlindToNode,
    'POWERMETER': HMPowermeterToNode,
    'CONDITION_CURRENT': HMConditionCurrentToNode,
    'CONDITION_POWER': HMConditionPowerToNode,
    'CONDITION_FREQUENCY': HMConditionFrequencyToNode,
    'CONDITION_VOLTAGE': HMConditionVoltageToNode,
    'VIRTUAL_KEY': HMVirtualKeyToNode
}

type ChannelGrouping = {
    [type in CCUChannelTypes]?: Channel[]
}

export function createNodesForDevice(device: FactoryDevice, hmDevice: Device, conn: CCUConnectionInfo): boolean {
    let created = false;
    log.verbose(`Creating nodes for device [${hmDevice.name} | ${hmDevice.definition.ADDRESS} | ${conn.protocol}]`);
    const cg: ChannelGrouping = {};
    hmDevice.channels.forEach(channel => {
        if (cg[channel.definition.TYPE as CCUChannelTypes]) {
            cg[channel.definition.TYPE as CCUChannelTypes].push(channel)
        } else {
            cg[channel.definition.TYPE as CCUChannelTypes] = [channel];
        }
    });

    for (const type in cg) {
        if (Object.prototype.hasOwnProperty.call(cg, type)) {
            const channels = cg[type as CCUChannelTypes];
            const creator = nodeMap[type as CCUChannelTypes];
            if (creator) {
                if (type !== 'MAINTENANCE') { created = true; }
                creator(device, channels, conn);
            }

        }
    }

    return created;
}