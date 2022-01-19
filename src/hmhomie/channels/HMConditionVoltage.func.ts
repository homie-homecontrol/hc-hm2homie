import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo } from "../../ccu/CCU";
import { Channel } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";
import { ConditionalNode } from "../nodes/ConditionalNode";
import { log } from "./logging";

export function HMConditionVoltageToNode(device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) {
    if (channels.length === 1) {
        createConditionVoltageNode(device, channels[0], conn);
    } 

}

function createConditionVoltageNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo) {

    const node = device.get('conditions') ? device.get('conditions') as ConditionalNode : device.add(new ConditionalNode(device));
    
    const conditionChannel_Param_DecisionValue = 'DECISION_VALUE';


    // Set current state
    node.conditionVoltage = channel.readings[conditionChannel_Param_DecisionValue]?.value;

    // homie -> hm eventstream

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: message => {
                if (message.deviceAddress === channel.definition.ADDRESS){
                    node.conditionVoltage=message.value;
        
                } 
            },
            error: (err) => {
                log.error(`Error process hm message for [${node.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )


}