import { ButtonState } from "hc-node-homie-smarthome/model";
import { ButtonNode, DimmerNode, SwitchNode } from "hc-node-homie-smarthome";
import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo } from "../../ccu/CCU";
import { Channel } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";
import { VirtualKeyNode } from "../nodes/VirtualKeyNode";
import { log } from "./logging";
import { getIndexFromChannelAddress } from "./util.func";

export function HMVirtualKeyToNode(device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) {
    if (channels.length === 1) {
        createVirtualKeyNode(device, channels[0], conn);
    } else {
        channels.forEach(channel => {
            const channelIndex = getIndexFromChannelAddress(channel.definition.ADDRESS);
            createVirtualKeyNode(device, channel, conn, channelIndex);
        })
    }

}

function createVirtualKeyNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo, index?: string) {

    
    const param_PressShort = 'PRESS_SHORT';
    const param_PressLong = 'PRESS_LONG';
    const param_Level = 'LEVEL';

    const hasLevel = !!channel.readings[param_Level];

    const node = device.add(new VirtualKeyNode(device, index ? { id: `virtualkey-${index}`, name: `Virtualkey ${index}` } : undefined, hasLevel));
    // Set current state
    if (hasLevel){
        node.level = channel.readings[param_Level]?.value;
    }

    // homie -> hm eventstream
    if (hasLevel){
        node.propLevel.onSetMessage$.pipe(takeUntil(node.propLevel.onDestroy$)).subscribe(
            {
                next: event => {
                    const val = (event.value as number) / 100.0;
    
                    log.verbose(`${node.propLevel.pointer}: setting value to ${event.value} --> ${val} -- ${typeof val}`)
                    conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { [param_Level]: val }).then(() => {
                        event.property.value = event.valueStr;
                    }).catch((err) => {
                        log.error(`${node.propLevel.pointer}: error setting value to ${val} -- ${typeof val}`, err)
                    })
                },
                error: (err) => {
                    log.error(`Error process set Event for [${node.propLevel.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
                }
            }
        );
    }

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: message => {
                if (message.deviceAddress === channel.definition.ADDRESS) {

        
                    if (message.datapoint === param_PressShort) {
                        node.action = "press"
                        log.info(`Received CCU Value update for [${node.propAction.pointer}]: press`);
        
                    } else if (message.datapoint === param_PressLong) {
                        node.action = "long-press";
                        log.info(`Received CCU Value update for [${node.propAction.pointer}]: long-press`);
        
                    }else if (message.datapoint === param_Level) {
                        node.level = Math.floor((message.value as number) * 100);
                        log.info(`Received CCU Value update for [${node.propLevel.pointer}]: ${node.level}`);
        
                    }
                }
            },
            error: (err) => {
                log.error(`Error process hm message for [${node.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )


}