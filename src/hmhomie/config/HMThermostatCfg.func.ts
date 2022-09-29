import { Validator } from "jsonschema";
import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo } from "../../ccu/CCU";
import { CCUMultiCallParams, CCU_DEV_WEEKDAYS, Device, Paramset } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";
import { HomieNode, HomieProperty } from "node-homie";
import { WeekPrograms, WeekProgram, DayProgram, BoostTimeValue, boostTimeValues } from "./HMThermostatCfg.model";
import { log } from "./logging";
import { H_SMARTHOME_TYPE_EXTENSTION } from "hc-node-homie-smarthome/model";

const schema = require.main.require('./HMWeekProgram.Schema.json');

const Param_WeekProgramPointer = 'WEEK_PROGRAM_POINTER';
const Param_BoostPosition = 'BOOST_POSITION';
const Param_BoostTimePeriod = 'BOOST_TIME_PERIOD';
const Param_BoostAfterWindowOpen = 'BOOST_AFTER_WINDOW_OPEN';


export function HMThermostatCfgFromConfig(device: FactoryDevice, hmDevice: Device, conn: CCUConnectionInfo) {
    const node = device.add(new HomieNode(device, { id: 'hm-config', name: 'Thermostat config', type: `${H_SMARTHOME_TYPE_EXTENSTION}=hmthermostat-config`}));

    createWeekProgramProps(device, node, hmDevice, conn);
    createBoostAfterWindowOpenProp(device, node, hmDevice, conn);
    createBoostTimePeriodProp(device, node, hmDevice, conn);
    createBoostValveOpeningProp(device, node, hmDevice, conn);

}


function createWeekProgramProps(device: FactoryDevice, node: HomieNode, hmDevice: Device, conn: CCUConnectionInfo) {
    const propProgramNumber = node.add(new HomieProperty(node,
        {
            id: 'active-program',
            name: 'Active Program Number',
            datatype: "integer",
            retained: true,
            settable: true
        }));
    const propProgram = node.add(new HomieProperty(node,
        {
            id: 'week-programs',
            name: 'JSON week programs',
            datatype: "string",
            retained: true,
            settable: true,
            format: `jsonschema:${JSON.stringify(schema)}`
        }));

    const programs: WeekPrograms = [];

    if (hmDevice.config[Param_WeekProgramPointer]) {
        // console.log(`DeviceConfig: ${JSON.stringify(hmDevice.config)}`);
        propProgramNumber.value = String(hmDevice.config[Param_WeekProgramPointer]?.value)
        for (let progNo = 1; progNo < 4; progNo++) {
            const weekProgram = getWeekProgramFromConfig(hmDevice.config, `P${progNo}_`);
            // log.info(`WeekProgram No [${progNo}] for ${hmDevice.name}:`, {weekProgram})   
            programs.push(weekProgram);
        }
    } else {
        // console.log(`DeviceConfig: ${JSON.stringify(hmDevice.config)}`);
        propProgramNumber.value = "0"
        propProgramNumber.setAttribute('settable', false);
        const weekProgram = getWeekProgramFromConfig(hmDevice.config);
        // log.info(`WeekProgram for ${hmDevice.name}:`, {weekProgram})
        programs.push(weekProgram);
    }
    propProgram.value = JSON.stringify(programs);


    propProgram.onSetMessage$.pipe(takeUntil(device.onDestroy$)).subscribe({
        next: async (msg) => {
            const newWeekPrograms: WeekPrograms = JSON.parse(msg.valueStr);
            const validator = new Validator();
            const result = validator.validate(newWeekPrograms, schema, { nestedErrors: true })
            if (!result.valid) {
                result.errors.forEach(error => {
                    log.error(`Error parsing input: ${error.toString()}`);
                })
                return;
            }

            const currentWeekPrograms: WeekPrograms = JSON.parse(msg.property.value);
            if (newWeekPrograms.length !== currentWeekPrograms.length) {
                log.error(`Cannot extend amount of week programs supported by the device!`);
                return;
            }

            const methodCalls: CCUMultiCallParams = [];
            for (let progNo = 0; progNo < newWeekPrograms.length; progNo++) {
                const prefix = newWeekPrograms.length > 1 ? `P${progNo + 1}_` : '';
                const newWeekProgram = newWeekPrograms[progNo];
                const currentWeekProgram = currentWeekPrograms[progNo];

                for (const weekday of CCU_DEV_WEEKDAYS) {
                    for (let slot = 0; slot < 13; slot++) {
                        const newEndtime = newWeekProgram[weekday][slot].endtime;
                        const newTemp = newWeekProgram[weekday][slot].temp;
                        const currentEndtime = currentWeekProgram[weekday][slot].endtime;
                        const currentTemp = currentWeekProgram[weekday][slot].temp;

                        if (newEndtime !== currentEndtime) {
                            methodCalls.push({ methodName: 'putParamset', params: [hmDevice.definition.ADDRESS, "MASTER", { [`${prefix}ENDTIME_${weekday}_${slot + 1}`]: newEndtime }] });
                        }
                        if (newTemp !== currentTemp) {
                            methodCalls.push({ methodName: 'putParamset', params: [hmDevice.definition.ADDRESS, "MASTER", { [`${prefix}TEMPERATURE_${weekday}_${slot + 1}`]: String(newTemp) }] });
                        }
                    }
                }
            }
            log.info('Changed params: ', { methodCalls });
            conn.ccu.methodCall(conn.clientId, 'system.multicall', [methodCalls]).then(() => {
                msg.property.value = msg.valueStr;
            }).catch((err) => {
                log.error(`${msg.property.pointer}: error setting value to ${msg.value} -- ${typeof msg.value}`, { err, methodCalls })
            });

        }
    })

    propProgramNumber.onSetMessage$.pipe(takeUntil(device.onDestroy$)).subscribe({
        next: async (msg) => {
            const num = msg.value as number;
            if (num >= 0 && num <= 2) {
                await conn.ccu.putParamset(conn.clientId, hmDevice.definition.ADDRESS, "MASTER", { [Param_WeekProgramPointer]: msg.value }).then(() => {
                    msg.property.value = msg.valueStr;
                }).catch((err) => {
                    log.error(`${msg.property.pointer}: error setting value to ${msg.value} -- ${typeof msg.value}`, err)
                })
            }
        }
    })


}


function createBoostAfterWindowOpenProp(device: FactoryDevice, node: HomieNode, hmDevice: Device, conn: CCUConnectionInfo) {
    const propBoostAfterWindowOpen = node.add(new HomieProperty(node,
        {
            id: 'boost-after-window-open',
            name: 'Trigger boost after window is closed',
            datatype: "boolean",
            retained: true,
            settable: true
        }));

    propBoostAfterWindowOpen.value = hmDevice.config[Param_BoostAfterWindowOpen]?.value ? "true" : "false";

    propBoostAfterWindowOpen.onSetMessage$.pipe(takeUntil(device.onDestroy$)).subscribe({
        next: (msg) => {
            conn.ccu.putParamset(conn.clientId, hmDevice.definition.ADDRESS, "MASTER", { [Param_BoostAfterWindowOpen]: msg.value }).then(() => {
                msg.property.value = msg.valueStr;
            }).catch((err) => {
                log.error(`${msg.property.pointer}: error setting value to ${msg.value} -- ${typeof msg.value}`, err)
            })
        }
    })
}

function createBoostTimePeriodProp(device: FactoryDevice, node: HomieNode, hmDevice: Device, conn: CCUConnectionInfo) {
    const propBoostTimePeriod = node.add(new HomieProperty(node,
        {
            id: 'boost-duration',
            name: 'Boost duration',
            datatype: "enum",
            format: boostTimeValues.join(','),
            retained: true,
            settable: true
        }));
    propBoostTimePeriod.value = numberToboostTimeValue(hmDevice.config[Param_BoostTimePeriod]?.value);

    propBoostTimePeriod.onSetMessage$.pipe(takeUntil(device.onDestroy$)).subscribe({
        next: (msg) => {
            const num = boostTimeValueToNumber(msg.valueStr as BoostTimeValue);
            conn.ccu.putParamset(conn.clientId, hmDevice.definition.ADDRESS, "MASTER", { [Param_BoostTimePeriod]: num }).then(() => {
                msg.property.value = msg.valueStr;
            }).catch((err) => {
                log.error(`${msg.property.pointer}: error setting value to ${num} -- ${typeof num}`, err)
            })

        }
    })
}

function createBoostValveOpeningProp(device: FactoryDevice, node: HomieNode, hmDevice: Device, conn: CCUConnectionInfo) {
    if (!hmDevice.config[Param_BoostPosition]){
        return;
    }

    const propBoostValveOpening = node.add(new HomieProperty(node,
        {
            id: 'boost-valve-opening',
            name: 'Valve opening during boost mode',
            datatype: "integer",
            unit: "%",
            retained: true,
            settable: true
        }));

    propBoostValveOpening.value = String(hmDevice.config[Param_BoostPosition]?.value);
    propBoostValveOpening.onSetMessage$.pipe(takeUntil(device.onDestroy$)).subscribe({
        next: (msg) => {
            if (msg.value >= 0 && msg.value <= 100) {
                conn.ccu.putParamset(conn.clientId, hmDevice.definition.ADDRESS, "MASTER", { [Param_BoostPosition]: msg.value }).then(() => {
                    msg.property.value = msg.valueStr;
                }).catch((err) => {
                    log.error(`${msg.property.pointer}: error setting value to ${msg.value} -- ${typeof msg.value}`, err)
                })
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

function boostTimeValueToNumber(value: BoostTimeValue): number {
    return boostTimeValues.indexOf(value);
}

function numberToboostTimeValue(num: number): BoostTimeValue {
    return boostTimeValues[Math.min(Math.max(num, 0), boostTimeValues.length)];
}