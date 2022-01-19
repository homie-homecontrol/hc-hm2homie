import { ContactNode, SwitchNode } from "hc-node-homie-smarthome";
import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo } from "../../ccu/CCU";
import { Channel } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";
import { log } from "./logging";
import { getIndexFromChannelAddress } from "./util.func";

export function HMShutterContactToNode(device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) {
    if (channels.length === 1) {
        createShutterContacthNode(device, channels[0], conn);
    } else {
        channels.forEach(channel => {
            const channelIndex = getIndexFromChannelAddress(channel.definition.ADDRESS);
            createShutterContacthNode(device, channel, conn, `contact-${channelIndex}`, `Contact ${channelIndex}`);
        })
    }

}

function createShutterContacthNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo, id?: string, name?: string,) {

    const node = device.add(new ContactNode(device, id ? { id, name } : undefined));
    const contactChannel_Param_State = 'STATE';

    // Set current state
    node.state = channel.readings[contactChannel_Param_State]?.value;

    // homie -> hm eventstream

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.propState.onDestroy$)).subscribe(
        {
            next: message => {
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === contactChannel_Param_State) {
                    node.state = message.value;
                }
            },
            error: (err) => {
                log.error(`Error process hm message for [${node.propState.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )


}