import { PowermeterNode, SwitchNode } from "hc-node-homie-smarthome";
import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo } from "../../ccu/CCU";
import { Channel } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";
import { log } from "./logging";
import { getIndexFromChannelAddress } from "../../ccu";


export function HMPowermeterToNode(device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) {
    if (channels.length === 1) {
        createPowermeterNode(device, channels[0], conn);
    } else {
        channels.forEach(channel => {
            const channelIndex = getIndexFromChannelAddress(channel.definition.ADDRESS);
            createPowermeterNode(device, channel, conn, `powermeter-${channelIndex}`, `Powermeter ${channelIndex}`);
        })
    }

}

function createPowermeterNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo, id?: string, name?: string,) {

    const node = device.add(new PowermeterNode(device, id ? { id, name } : undefined));
    const powermeterChannel_Param_Current = 'CURRENT';
    const powermeterChannel_Param_Energy_Counter = 'ENERGY_COUNTER';
    const powermeterChannel_Param_Frequency = 'FREQUENCY';
    const powermeterChannel_Param_Power = 'POWER';
    const powermeterChannel_Param_VOLTAGE = 'VOLTAGE';

    // Set current state
    node.current = channel.readings[powermeterChannel_Param_Current]?.value;
    node.energy_counter = channel.readings[powermeterChannel_Param_Energy_Counter]?.value;
    node.frequency = channel.readings[powermeterChannel_Param_Frequency]?.value;
    node.power = channel.readings[powermeterChannel_Param_Power]?.value;
    node.voltage = channel.readings[powermeterChannel_Param_VOLTAGE]?.value;

    // homie -> hm eventstream



    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: message => {
                if (message.deviceAddress === channel.definition.ADDRESS) {
                    switch (message.datapoint) {
                        case powermeterChannel_Param_Current:
                            node.current = message.value;
                            break;
                        case powermeterChannel_Param_Energy_Counter:
                            node.energy_counter = message.value;
                            break;
                        case powermeterChannel_Param_Frequency:
                            node.frequency = message.value;
                            break;

                        case powermeterChannel_Param_Power:
                            node.power = message.value;
                            break;

                        case powermeterChannel_Param_VOLTAGE:
                            node.voltage = message.value;
                            break;
                        default:
                            break;
                    }
                }
            },
            error: (err) => {
                log.error(`Error process hm message for [${node.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )


}