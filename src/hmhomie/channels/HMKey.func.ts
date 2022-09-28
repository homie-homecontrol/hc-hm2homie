import { ButtonState } from "hc-node-homie-smarthome/model";
import { ButtonNode, SwitchNode } from "hc-node-homie-smarthome";
import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo } from "../../ccu/CCU";
import { Channel } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";
import { log } from "./logging";
import { getIndexFromChannelAddress } from "../../ccu";

export function HMKeyToNode(device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) {
    if (channels.length === 1) {
        createKeyNode(device, channels[0], conn);
    } else {
        channels.forEach(channel => {
            const channelIndex = getIndexFromChannelAddress(channel.definition.ADDRESS);
            createKeyNode(device, channel, conn, `button-${channelIndex}`, `Button ${channelIndex}`);
        })
    }

}

function createKeyNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo, id?: string, name?: string,) {

    
    const param_PressShort = 'PRESS_SHORT';
    const param_PressLong = 'PRESS_LONG';
    const param_PressLongRelease = 'PRESS_LONG_RELEASE';
    const param_PressCont = 'PRESS_CONT';

    const buttonStates: ButtonState[] = [];

    if (!!channel.readings[param_PressShort]){
        buttonStates.push('press');
    }
    if (!!channel.readings[param_PressLong]){
        buttonStates.push('long-press');
    }
    if (!!channel.readings[param_PressLongRelease]){
        buttonStates.push('long-release');
    }
    if (!!channel.readings[param_PressCont]){
        buttonStates.push('continuous');
    }

    const node = device.add(new ButtonNode(device, id ? { id, name } : undefined, {buttonStates}));

    // Set current state
    // none - not retained

    // homie -> hm eventstream
    // none - no input

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.propAction.onDestroy$)).subscribe(
        {
            next: message => {
                if (message.deviceAddress === channel.definition.ADDRESS) {

        
                    if (message.datapoint === param_PressShort) {
                        node.action = "press"
                        log.info(`Received CCU Value update for [${node.propAction.pointer}]: press`);
        
                    } else if (message.datapoint === param_PressLong) {
                        node.action = "long-press";
                        log.info(`Received CCU Value update for [${node.propAction.pointer}]: long-press`);
        
                    }else if (message.datapoint === param_PressLongRelease) {
                        node.action = "long-release";
                        log.info(`Received CCU Value update for [${node.propAction.pointer}]: long-press`);
        
                    }else if (message.datapoint === param_PressCont) {
                        node.action = "continuous";
                        log.info(`Received CCU Value update for [${node.propAction.pointer}]: long-press`);
        
                    }
                }
            },
            error: (err) => {
                log.error(`Error process hm message for [${node.propAction.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )


}