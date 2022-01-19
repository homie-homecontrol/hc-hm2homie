import { HomieDevice, HomieNode, HomieProperty } from "node-homie";
import { HomieNodeAtrributes, HOMIE_TYPE_INT, HOMIE_TYPE_ENUM } from "node-homie/model";
import { H_SMARTHOME_TYPE_EXTENSTION, ButtonState } from "hc-node-homie-smarthome/model";

export const H_SMARTHOME_TYPE_EXTENSTION_VIRTUALKEY = H_SMARTHOME_TYPE_EXTENSTION + "=hm2homie/virtualkey";

export class VirtualKeyNode extends HomieNode {

    public readonly propAction: HomieProperty;

    public set action(value: ButtonState) {
        this.propAction.value = value;
    }
    public get action(): ButtonState {
        return this.propAction.value as ButtonState;
    }

    public readonly propLevel: HomieProperty;

    public set level(value: number) {
        this.propLevel.value = String(value);

    }
    public get level(): number {
        return this.propLevel.value ? parseInt(this.propLevel.value) : 0;
    }


    constructor(device: HomieDevice, attrs: Partial<HomieNodeAtrributes> = {}, protected hasLevel = true) {
        super(device, {
            ...{
                id: 'virtualkey',
                name: 'Virtualkey',
                type: H_SMARTHOME_TYPE_EXTENSTION_VIRTUALKEY
            },
            ...attrs
        });

        this.propAction = this.add(new HomieProperty(this, {
            id: 'action',
            name: 'Button action event',
            datatype: HOMIE_TYPE_ENUM,
            retained: false,
            settable: true,
            format: ['press', 'long-press'].join(',')
        }));

        if (hasLevel) {

            this.propLevel = this.add(new HomieProperty(this, {
                id: 'level',
                name: 'Level',
                datatype: HOMIE_TYPE_INT,
                retained: true,
                settable: true,
                unit: '%'
            }));
        }

    }
}