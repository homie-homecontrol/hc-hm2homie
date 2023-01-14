import { CCUConnectionInfo } from "../../ccu";
import { CCUChannelTypes, Channel, Device } from "../../ccu";
import { FactoryDevice } from "../FactoryDevice";
import { ConfigNodeCreatorMap } from "./hmhomiecfg.model";
import { HMThermostatCfgFromConfig } from "./HMThermostatCfg.func";
import { log } from "./logging";


const configNodeMap: ConfigNodeCreatorMap = {
    'HM-TC-IT-WM-W-EU': HMThermostatCfgFromConfig,
    'HM-CC-RT-DN': HMThermostatCfgFromConfig,
    // 'HmIP-WTH-1': HMThermostatCfgFromConfig
}

export function createCfgNodesForDevice(device: FactoryDevice, hmDevice: Device, conn: CCUConnectionInfo): boolean {
    let created = false;

    const cfgNodeCreator = configNodeMap[hmDevice.definition.TYPE]
    if (cfgNodeCreator) {
        cfgNodeCreator(device, hmDevice, conn);
    }
    return created;
}