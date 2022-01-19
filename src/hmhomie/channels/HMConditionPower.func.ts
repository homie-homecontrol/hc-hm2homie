import { TiltSensorNode } from "hc-node-homie-smarthome";
import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo } from "../../ccu/CCU";
import { Channel } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";
import { ConditionalNode } from "../nodes/ConditionalNode";
import { log } from "./logging";

export function HMConditionPowerToNode(device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) {
    if (channels.length === 1) {
        createConditionPowerNode(device, channels[0], conn);
    } 

}

function createConditionPowerNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo) {

    const node = device.get('conditions') ? device.get('conditions') as ConditionalNode : device.add(new ConditionalNode(device));
    
    const conditionChannel_Param_DecisionValue = 'DECISION_VALUE';


    // Set current state
    node.conditionPower = channel.readings[conditionChannel_Param_DecisionValue]?.value;

    // homie -> hm eventstream

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: message => {
                if (message.deviceAddress === channel.definition.ADDRESS){
                    node.conditionPower=message.value;
        
                } 

                // else if (message.deviceAddress === conditionVoltageChannel.definition.ADDRESS){
                //     conditionNode.properties['condition-voltage'].value=String(message.value);
                    
                // } else if (message.deviceAddress === conditionCurrentChannel.definition.ADDRESS){
                //     conditionNode.properties['condition-current'].value=String(message.value);
                    
                // } else if (message.deviceAddress === conditionFrequencyChannel.definition.ADDRESS){
                //     conditionNode.properties['condition-frequency'].value=String(message.value);
                    
                // }
            },
            error: (err) => {
                log.error(`Error process hm message for [${node.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )


}