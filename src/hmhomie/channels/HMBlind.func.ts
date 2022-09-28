import { ShutterNode, SwitchNode } from "hc-node-homie-smarthome";
import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo } from "../../ccu/CCU";
import { Channel } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";
import { log } from "./logging";
import { getIndexFromChannelAddress } from "../../ccu";

export function HMBlindToNode(device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) {
    if (channels.length === 1) {
        createBlindNode(device, channels[0], conn);
    } else {
        channels.forEach(channel => {
            const channelIndex = getIndexFromChannelAddress(channel.definition.ADDRESS);
            createBlindNode(device, channel, conn, `shutter-${channelIndex}`, `Shutter ${channelIndex}`);
        })
    }

}

function createBlindNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo, id?: string, name?: string,) {

    const node = device.add(new ShutterNode(device, id ? { id, name } : undefined));
    const blindChannel_Param_Level = 'LEVEL';
    const blindChannel_Param_Stop = 'STOP';

    // Set current state
    node.position = blindsPositionToHomiePostion(channel.readings[blindChannel_Param_Level]?.value);

    // homie -> hm eventstream
    node.propPosition.onSetMessage$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: event => {
                const val = homiePositionToBlindsPosition(event.value);

                conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { [blindChannel_Param_Level]: val }).then(() => {
                    event.property.value = event.valueStr;
                }).catch((err) => {
                    log.error(`${node.propPosition.pointer}: error setting value to ${val} -- ${typeof val}`, err)
                })
            },
            error: (err) => {
                log.error(`Error process set Event for [${node.propPosition.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    );


    // node.propUp.onSetMessage$.pipe(takeUntil(node.onDestroy$)).subscribe(
    //     {
    //         next: event => {

    //             conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { [blindChannel_Param_Level]: "100" }).then(() => {
    //                 event.property.value = event.valueStr;
    //             }).catch((err) => {
    //                 log.error(`${node.propUp.pointer}: error setting level value to "100"`, err)
    //             })
    //         },
    //         error: (err) => {
    //             log.error(`Error process set Event for [${node.propUp.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
    //         }
    //     }
    // );

    // node.propDown.onSetMessage$.pipe(takeUntil(node.onDestroy$)).subscribe(
    //     {
    //         next: event => {

    //             conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { [blindChannel_Param_Level]: "0" }).then(() => {
    //                 event.property.value = event.valueStr;
    //             }).catch((err) => {
    //                 log.error(`${node.propDown.pointer}: error setting level value to "100"`, err)
    //             })
    //         },
    //         error: (err) => {
    //             log.error(`Error process set Event for [${node.propDown.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
    //         }
    //     }
    // );

    node.propAction.onSetMessage$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: event => {
                if (event.valueStr === 'stop') {
                    conn.ccu.putParamset(conn.clientId, channel.definition.ADDRESS, 'VALUES', { [blindChannel_Param_Stop]: true }).then(() => {
                        event.property.value = event.valueStr;
                    }).catch((err) => {
                        log.error(`${node.propAction.pointer}: error sending stop command`, err)
                    })
                }
            },
            error: (err) => {
                log.error(`Error process set Event for [${node.propAction.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    );

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: message => {
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === blindChannel_Param_Level) {
                    node.position = blindsPositionToHomiePostion(message.value);
                }
            },
            error: (err) => {
                log.error(`Error process hm message for [${node.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )


}

function blindsPositionToHomiePostion(pos: any): number {
    return Math.floor((1 - parseFloat(pos)) * 100);
}

function homiePositionToBlindsPosition(pos: any): string {
    return String((100 - (pos as number)) / 100);
}