import { HomieDevice, HomieNode, HomieProperty } from "node-homie";
import { HomieNodeAtrributes, HOMIE_TYPE_INT } from "node-homie/model";
import { H_SMARTHOME_TYPE_EXTENSTION } from "hc-node-homie-smarthome/model";
export const H_SMARTHOME_TYPE_EXTENSTION_CONDITION = H_SMARTHOME_TYPE_EXTENSTION + "=hm2homie/condition";

export class ConditionalNode extends HomieNode {

    public readonly propConditionPower: HomieProperty;
    public readonly propConditionCurrent: HomieProperty;
    public readonly propConditionVoltage: HomieProperty;
    public readonly propConditionFrequency: HomieProperty;

    public set conditionPower(value: number) {
        this.propConditionPower!.value = String(value);
    }
    public get conditionPower(): number {
        return this.propConditionPower!.value ? parseInt(this.propConditionPower!.value) : 0;
    }

    public set conditionCurrent(value: number) {
        this.propConditionCurrent!.value = String(value);
    }
    public get conditionCurrent(): number {
        return this.propConditionCurrent!.value ? parseInt(this.propConditionCurrent!.value) : 0;
    }

    public set conditionVoltage(value: number) {
        this.propConditionVoltage!.value = String(value);
    }
    public get conditionVoltage(): number {
        return this.propConditionVoltage!.value ? parseInt(this.propConditionVoltage!.value) : 0;
    }

    public set conditionFrequency(value: number) {
        this.propConditionFrequency!.value = String(value);
    }
    public get conditionFrequency(): number {
        return this.propConditionFrequency!.value ? parseInt(this.propConditionFrequency!.value) : 0;
    }



    constructor(device: HomieDevice, attrs: Partial<HomieNodeAtrributes> = {}) {
        super(device, {
            ...{
                id: 'conditions',
                name: 'Conditions',
                type: H_SMARTHOME_TYPE_EXTENSTION_CONDITION
            },
            ...attrs
        });

        this.propConditionPower = this.add(new HomieProperty(this, {
            id: 'condition-power',
            name: 'Decision value power',
            datatype: HOMIE_TYPE_INT,
            retained: true,
            settable: false,
            unit: "0:2"
        }));

        this.propConditionCurrent = this.add(new HomieProperty(this, {
            id: 'condition-current',
            name: 'Decision value current',
            datatype: HOMIE_TYPE_INT,
            retained: true,
            settable: false,
            unit: "0:2"
        }));

        this.propConditionVoltage = this.add(new HomieProperty(this, {
            id: 'condition-voltage',
            name: 'Decision value voltage',
            datatype: HOMIE_TYPE_INT,
            retained: true,
            settable: false,
            unit: "0:2"
        }));

        this.propConditionFrequency = this.add(new HomieProperty(this, {
            id: 'condition-frequency',
            name: 'Decision value frequency',
            datatype: HOMIE_TYPE_INT,
            retained: true,
            settable: false,
            unit: "0:2"
        }));


    }
}