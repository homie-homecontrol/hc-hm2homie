import { SwitchNode } from "hc-node-homie-smarthome";
import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo } from "../../ccu/CCU";
import { Channel } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";
import { log } from "./logging";
import { getIndexFromChannelAddress } from "../../ccu";


export function HMSwitchToNode(device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) {
    if (channels.length === 1) {
        createSwitchNode(device, channels[0], conn);
    } else {
        channels.forEach(channel => {
            const channelIndex = getIndexFromChannelAddress(channel.definition.ADDRESS);
            createSwitchNode(device, channel, conn, `switch-${channelIndex}`, `Switch ${channelIndex}`);
        })
    }

}

function createSwitchNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo, id?: string, name?: string,) {

    const node = device.add(new SwitchNode(device, id ? { id, name } : undefined));
    const switchChannelParamState = 'STATE';

    // Set current state
    node.state = channel.readings[switchChannelParamState]?.value;

    // homie -> hm eventstream
    node.propState.onSetMessage$.pipe(takeUntil(node.propState.onDestroy$)).subscribe(
        {
            next: event => {
                const val = event.value;

                log.verbose(`${node.propState.pointer}: setting value to ${event.value} --> ${val} -- ${typeof val}`)
                conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { [switchChannelParamState]: val }).then(() => {
                    event.property.value = event.valueStr;
                }).catch((err) => {
                    log.error(`${node.propState.pointer}: error setting value to ${val} -- ${typeof val}`, err)
                })
            },
            error: (err) => {
                log.error(`Error process set Event for [${node.propState.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    );


    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.propState.onDestroy$)).subscribe(
        {
            next: message => {
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === switchChannelParamState) {
                    log.info(`Received CCU Value update for [${message.deviceAddress} - ${message.datapoint}] [${node.propState.topic}]: ${message.value} -- ${typeof message.value}`);
                    node.state = message.value;
                }
            },
            error: (err) => {
                log.error(`Error process hm message for [${node.propState.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )


}