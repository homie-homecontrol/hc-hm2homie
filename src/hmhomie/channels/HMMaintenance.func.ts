import { MaintenanceNode } from "hc-node-homie-smarthome";
import { takeUntil } from "rxjs";
import { CCUConnectionInfo, Channel } from "../../ccu";
import { FactoryDevice } from "../FactoryDevice";
import { log } from "./logging";

const maintenanceChannel_Param_LowBatt = 'LOWBAT';
const maintenanceChannel_Param_Unreach = 'UNREACH';

export function HMMaintenanceToNode(device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) {
    if (channels.length === 1) {
        const channel = channels[0];

        if (!!channel.readings[maintenanceChannel_Param_LowBatt] || !!channel.readings[maintenanceChannel_Param_Unreach]) {
            createMaintenanceNode(device, channel, conn);
        }
    }
}

function createMaintenanceNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo) {

    const hasLowBatt = !!channel.readings[maintenanceChannel_Param_LowBatt];
    const hasUnreach = !!channel.readings[maintenanceChannel_Param_Unreach];

    const node = device.add(new MaintenanceNode(device, undefined, {
        batteryLevel: false,
        lowBattery: hasLowBatt,
        lastUpdate: false,
        reachable: hasUnreach
    }));


    // Set current state
    if (hasLowBatt) {
        node.lowBattery = channel.readings[maintenanceChannel_Param_LowBatt]?.value;
    }
    if (hasUnreach) {
        node.reachable = channel.readings[maintenanceChannel_Param_Unreach]?.value === false;
    }



    // homie -> hm eventstream
    // none - sensor only

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: message => {
                if (hasLowBatt && message.deviceAddress === channel.definition.ADDRESS && message.datapoint === maintenanceChannel_Param_LowBatt) {
                    node.lowBattery = message.value;
                }

                if (hasUnreach && message.deviceAddress === channel.definition.ADDRESS && message.datapoint === maintenanceChannel_Param_Unreach) {
                    node.reachable = message.value === false;
                }
            },
            error: (err) => {
                log.error(`Error process hm message for [${node.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )


}