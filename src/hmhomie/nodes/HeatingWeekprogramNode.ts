import { HomieDevice, HomieNode, HomieProperty } from "node-homie";
import { HomieNodeAtrributes, HOMIE_TYPE_INT, HOMIE_TYPE_ENUM } from "node-homie/model";
import { H_SMARTHOME_TYPE_EXTENSTION, ButtonState } from "hc-node-homie-smarthome/model";
import { WeekPrograms } from "./HMWeekProgram.model";

export const H_SMARTHOME_TYPE_EXTENSTION_WEEKPROGRAM = H_SMARTHOME_TYPE_EXTENSTION + "=hm2homie/heatingweekprogram";
const schema = require.main.require('./HMWeekProgram.Schema.json');



export class HeatingWeekProgramNode extends HomieNode {

    public readonly propActiveProgram: HomieProperty;

    public set activeProgram(value: number) {
        this.propActiveProgram.value = String(value);
    }
    public get activeProgram(): number {
        return Number.parseInt(this.propActiveProgram.value);
    }

    public readonly propWeekPrograms: HomieProperty;

    public set weekPrograms(value: WeekPrograms) {
        if (!this.hasProgramSpecs) { return; }
        this.propWeekPrograms.value = String(value);
    }
    public get weekPrograms(): WeekPrograms {
        if (!this.hasProgramSpecs) { return; }
        return JSON.parse(this.propWeekPrograms.value);
    }

    constructor(device: HomieDevice, attrs: Partial<HomieNodeAtrributes> = {}, protected hasProgramSpecs = true) {
        super(device, {
            ...{
                id: 'weekprogram',
                name: 'Control active weekprogram',
                type: H_SMARTHOME_TYPE_EXTENSTION_WEEKPROGRAM
            },
            ...attrs
        });

        this.propActiveProgram = this.add(new HomieProperty(this, {
            id: 'active-program',
            name: 'Active Weekprogram',
            datatype: "integer",
            retained: true,
            settable: true,
        }));

        if (hasProgramSpecs) {
            this.propWeekPrograms = this.add(new HomieProperty(this, {
                id: 'week-programs',
                name: 'JSON week programs',
                datatype: "string",
                retained: true,
                settable: true,
                format: `jsonschema:${JSON.stringify(schema)}`
            }));
        }
    }
}