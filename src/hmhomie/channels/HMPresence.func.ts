import { MotionSensorNode } from "hc-node-homie-smarthome";
import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo, Channel } from "../../ccu";
import { FactoryDevice } from "../FactoryDevice";
import { log } from "./logging";
import { getIndexFromChannelAddress } from "../../ccu";


export function HMPresenceToNode(device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) {
    if (channels.length === 1) {
        createMotionSensorNode(device, channels[0], conn);
    } else {
        channels.forEach(channel => {
            const channelIndex = getIndexFromChannelAddress(channel.definition.ADDRESS);
            createMotionSensorNode(device, channel, conn, `motion-${channelIndex}`, `Motion detection ${channelIndex}`);
        })
    }

}

function createMotionSensorNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo, id?: string, name?: string,) {

    const node = device.add(new MotionSensorNode(device, id ? { id, name } : undefined, { lux: true, noMotion: false, noMotionIntervals: [] }));
    const presenceChannel_Param_Presence = 'PRESENCE_DETECTION_STATE';
    const presenceChannel_Param_Illumination = 'ILLUMINATION';

    // Set current state
    node.motion = channel.readings[presenceChannel_Param_Presence]?.value;
    node.lux = channel.readings[presenceChannel_Param_Illumination]?.value;

    // homie -> hm eventstream
    // none - sensor only

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: message => {
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === presenceChannel_Param_Presence) {
                    node.motion = message.value;
                }

                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === presenceChannel_Param_Illumination) {
                    node.lux = message.value;
                }
            },
            error: (err) => {
                log.error(`Error process hm message for [${node.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )


}
