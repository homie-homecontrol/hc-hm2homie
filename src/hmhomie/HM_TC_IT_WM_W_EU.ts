
import { inspect } from "util";
import { CCUConnectionInfo } from "../ccu/CCU";
import { CCUDeviceMessage, Device } from "../ccu/homematic.model";
import { GenericHMDevice } from "./GenericHMDevice";
import { createNodeFromChannel, homieID2hmID, isChannelAddr, makeSetHandler, paramsetToProperties, validParameter } from "./utils";
import { takeUntil, tap } from 'rxjs/operators'
import { HomieNode, HomieProperty } from "node-homie";
import { HomieDeviceAtrributes, HOMIE_TYPE_STRING } from "node-homie/model";
import { MQTTConnectOpts } from "node-homie/model";




export class HM_TC_IT_WM_W_EU extends GenericHMDevice {

    constructor(attrs: HomieDeviceAtrributes, mqttOptions: MQTTConnectOpts, conn: CCUConnectionInfo, device: Device) {
        super(attrs, mqttOptions, conn, device);
        this.tags.add('HM_TC_IT_WM_W_EU-hm-device');
    }


    public async create() {
        if (this.created) { return Promise.resolve(); }

        this.log.debug(`Device: ${this.device.name}`);

        Object.keys(this.device.config).forEach(dp => {
            this.log.debug(`${dp} --> ${this.device.config[dp].value}`);
        });

        const program = [];
        for (let p = 1; p <= 3; p++) {
            const programEntry = {};

            ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].forEach(day => {
                const daySchedule = [];
                for (let slot = 1; slot <= 13; slot++) {
                    daySchedule.push({
                        endtime: this.device.config[`P${p}_ENDTIME_${day}_${slot}`].value,
                        temp: this.device.config[`P${p}_TEMPERATURE_${day}_${slot}`].value,
                    })
                }
                programEntry[day] = daySchedule;
            })
            program.push(programEntry);

        }
        this.log.debug(`${this.id} -- ${inspect(program, { showHidden: false, depth: null })}`);

        const configNode = this.add(new HomieNode(this, { id: 'config', name: 'Device configuration node', type: 'config' }));
        const week_program_prop = configNode.add(new HomieProperty(configNode, { id: 'WEEK_PROGRAMS', name: 'Weekly heating programs', datatype: HOMIE_TYPE_STRING, settable: true, retained: true, unit: '', format: 'json' }));
        week_program_prop.value = JSON.stringify(program);

        week_program_prop.onSetMessage$.pipe(
            takeUntil(this.onDestroy$),
            tap(event => {
                this.log.verbose(`on set for weekprogram prop...`);
                const data = JSON.parse(event.valueStr);
                const paramSet = {};
                data.forEach((programEntry, programNo) => {
                    Object.keys(programEntry).forEach((weekday) => {
                        const daySchedule = programEntry[weekday];
                        // debug('Dayschedule: ', daySchedule);
                        daySchedule.forEach((slot, slotIndex) => {
                            paramSet[`P${programNo + 1}_TEMPERATURE_${weekday}_${slotIndex + 1}`] = "" + slot.temp;
                            paramSet[`P${programNo + 1}_ENDTIME_${weekday}_${slotIndex + 1}`] = Number(slot.endtime);
                        })
                    })
                });
                // debug('PARAMSET: ', paramSet);
                this.conn.ccu.putParamset(this.conn.clientId, homieID2hmID(this.id), 'MASTER', paramSet, true).then((ret) => {
                    this.log.verbose('completed set %s', ret);
                    event.property.value=event.valueStr;
                }).catch((err) => {
                    this.log.error(`${this.attributes.name}.config.${event.property.pointer}: error setting value to ${paramSet}`, err)
                })
            })
        ).subscribe(
            {
                error: (err) => {
                    this.log.error(`Error process set Event for [${this.pointer}].`, { error: err });
                }
            }
        );


        paramsetToProperties(configNode, this.device.config,
            makeSetHandler(configNode, this.device.definition.ADDRESS, this.conn, 'MASTER'),
            (nodeType, datapoint) => (validParameter(nodeType, datapoint) && !datapoint.id.startsWith('P1_') && !datapoint.id.startsWith('P2_') && !datapoint.id.startsWith('P3_'))
        )

        this.device.channels.forEach(channel => {
            createNodeFromChannel(this, channel);
        });
        this.created = true;
    }


    public handleEventMessage(message: CCUDeviceMessage) {
        // it appears there are no events for device configs.... so this is most likely pointless...
        if (!isChannelAddr(message.deviceAddress) && (message.datapoint.startsWith('P1_') || message.datapoint.startsWith('P2_') || message.datapoint.startsWith('P3_'))) {
            const tokens = message.datapoint.split('_');
            const program = Number(tokens[0].replace('P', ''));
            const weekday = tokens[2];
            const slot = Number(tokens[3]);
            const prop = this.get('config').get('WEEK_PROGRAMS')
            const data = JSON.parse(prop.value);
            if (message.datapoint.includes('ENDTIME')) {
                data[program][weekday][slot]['endtime'] = Number(message.value);
            } else {
                data[program][weekday][slot]['temp'] = Number(message.value);
            }
            prop.value = JSON.stringify(data);
        } else {
            super.handleEventMessage(message);
        }
    }


}


