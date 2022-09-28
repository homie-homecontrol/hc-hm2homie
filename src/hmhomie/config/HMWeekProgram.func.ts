import { Validator } from "jsonschema";
import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo } from "../../ccu/CCU";
import { CCU_DEV_WEEKDAYS, Device, Paramset } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";
import { HomieNode, HomieProperty } from "node-homie";
import { WeekPrograms, WeekProgram, DayProgram } from "./HMWeekProgram.model";
import { log } from "./logging";

const schema = require.main.require('./HMWeekProgram.Schema.json');

export function HMWeekProgramFromConfig(device: FactoryDevice, hmDevice: Device, conn: CCUConnectionInfo) {
    const node = device.add(new HomieNode(device, { id: 'weekprogram', name: 'weekprogram' }));
    const propProgramNumber = node.add(new HomieProperty(node, { id: 'active-program', name: 'Active Program Number', datatype: "integer", retained: true, settable: true }));
    const propProgram = node.add(new HomieProperty(node, { id: 'week-programs', name: 'JSON week programs', datatype: "string", retained: true, settable: true, format: `jsonschema:${JSON.stringify(schema)}` }));

    const Param_WeekProgramPointer = 'WEEK_PROGRAM_POINTER';

    const programs: WeekPrograms = [];

    if (hmDevice.config[Param_WeekProgramPointer]) {
        console.log(JSON.stringify(hmDevice.config[Param_WeekProgramPointer]));
        propProgramNumber.value = String(hmDevice.config[Param_WeekProgramPointer].value)
        for (let progNo = 1; progNo < 4; progNo++) {
            const weekProgram = getWeekProgramFromConfig(hmDevice.config, `P${progNo}_`);
            // log.info(`WeekProgram No [${progNo}] for ${hmDevice.name}:`, {weekProgram})   
            programs.push(weekProgram);
        }
    } else {
        propProgramNumber.value = "0"
        propProgramNumber.setAttribute('settable', false);
        const weekProgram = getWeekProgramFromConfig(hmDevice.config);
        // log.info(`WeekProgram for ${hmDevice.name}:`, {weekProgram})
        programs.push(weekProgram);
    }
    propProgram.value = JSON.stringify(programs);


    propProgram.onSetMessage$.pipe(takeUntil(device.onDestroy$)).subscribe({
        next: (msg) => {
            const weekPrograms: WeekPrograms = JSON.parse(msg.valueStr);
            const validator = new Validator();
            const result = validator.validate(weekPrograms, schema, { nestedErrors: true })
            if (!result.valid) {
                result.errors.forEach(error => {
                    log.error(`Error parsing input: ${error.toString()}`);
                })
                return;
            }

            // TODO: Actually updating the device config
            msg.property.value = msg.valueStr;

        }
    })

    propProgramNumber.onSetMessage$.pipe(takeUntil(device.onDestroy$)).subscribe({
        next: (msg) => {
            const num = msg.value as number;
            if (num >= 0 && num <= 2) {
                msg.property.value = msg.valueStr;
                conn.ccu.putParamset(conn.clientId, hmDevice.definition.ADDRESS, "MASTER", { Param_WeekProgramPointer : msg.value })
            }
        }
    })

}

function getWeekProgramFromConfig(config: Paramset, prefix = ""): WeekProgram {
    const weekprogram: Partial<WeekProgram> = {};

    for (const weekday of CCU_DEV_WEEKDAYS) {
        const dayProgram: Partial<DayProgram> = [];
        for (let slot = 1; slot < 14; slot++) {
            const endtimeDP = config[`${prefix}ENDTIME_${weekday}_${slot}`]
            const tempDP = config[`${prefix}TEMPERATURE_${weekday}_${slot}`]
            if (endtimeDP && tempDP) {
                const endtime = endtimeDP.value;
                const temp = tempDP.value;
                dayProgram.push({ endtime, temp });
            }
        }
        if (dayProgram.length != 13) {
            throw Error('Could not find complete dayprogram');
        }
        weekprogram[weekday] = dayProgram as DayProgram;
    }



    return weekprogram as WeekProgram;
}

